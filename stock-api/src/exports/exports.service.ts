import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  BankTransactionType,
  DocumentStatus,
  ExportContractStatus,
  Incoterm,
  LotEventType,
  LotStatus,
  PaymentMethod,
  SaleChannel,
  StockMovementSourceType,
} from '../common/enums';
import {
  applyDateRangeToQb,
  applyIlikeSearch,
  paginatedQueryBuilder,
} from '../common/utils/query.util';
import { BankLedgerService } from '../banks/bank-ledger.service';
import { ExportAllocation } from '../database/entities/export-allocation.entity';
import {
  ExportContract,
  ExportDocCheckItem,
  ExportPackingLine,
} from '../database/entities/export-contract.entity';
import { Item } from '../database/entities/item.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { ProcessRun } from '../database/entities/process-run.entity';
import { SaleLine } from '../database/entities/sale-line.entity';
import { Sale } from '../database/entities/sale.entity';
import { StockService } from '../inventory/stock.service';
import {
  AllocateExportLotDto,
  CreateExportContractDto,
  ExportContractListQueryDto,
  ShipExportContractDto,
  UpdateDocChecklistDto,
  AttachExportLotDto,
  UpdateExportContractDto,
} from './dto/export-contract.dto';

const OPEN_RESERVE_STATUSES = [
  ExportContractStatus.DRAFT,
  ExportContractStatus.ALLOCATED,
  ExportContractStatus.STAGED,
];

type ExportLotStage = {
  stage?: string;
  outputLotId?: string | null;
  kgPerDoniya?: string | null;
  doniyaCount?: number | null;
  remainderKg?: string | null;
  documents?: Array<{
    key: string;
    label: string;
    reference?: string | null;
    notes?: string | null;
  }>;
  postEcta?: {
    grade?: string | null;
    certificateNumber?: string | null;
    moisturePercent?: string | null;
    cuppingScore?: string | null;
    testedAt?: string | null;
    notes?: string | null;
  } | null;
};

const DEFAULT_DOC_CHECKLIST: ExportDocCheckItem[] = [
  { key: 'COO', label: 'Certificate of Origin', done: false },
  { key: 'PHYTO', label: 'Phytosanitary certificate', done: false },
  { key: 'QC', label: 'QC / cupping certificate', done: false },
  { key: 'PACKING', label: 'Packing list', done: false },
  { key: 'INVOICE', label: 'Commercial invoice', done: false },
  { key: 'BOL', label: 'Bill of lading / AWB', done: false },
  { key: 'WEIGHT', label: 'Weight / quality certificate', done: false },
];

@Injectable()
export class ExportsService {
  constructor(
    @InjectRepository(ExportContract)
    private readonly contractRepo: Repository<ExportContract>,
    @InjectRepository(ExportAllocation)
    private readonly allocationRepo: Repository<ExportAllocation>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(ProcessRun)
    private readonly runRepo: Repository<ProcessRun>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
    private readonly bankLedger: BankLedgerService,
  ) {}

  async findAll(query: ExportContractListQueryDto) {
    const qb = this.contractRepo
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.customer', 'customer')
      .leftJoinAndSelect('contract.stagingLocation', 'stagingLocation')
      .orderBy('contract.created_at', 'DESC');

    if (query.status) {
      qb.andWhere('contract.status = :status', { status: query.status });
    }
    applyIlikeSearch(qb, query.search, [
      'contract.contract_number',
      'contract.order_number',
      'contract.buyer_name',
      'contract.buyer_country',
      'contract.destination',
      'contract.container_number',
      'contract.grade',
      'contract.notes',
    ]);
    applyDateRangeToQb(qb, 'contract.created_at', query.from, query.to);
    const page = await paginatedQueryBuilder(qb, query.page, query.limit);
    return {
      ...page,
      data: (page.data as ExportContract[]).map((c) => ({
        ...c,
        stockState:
          c.status === ExportContractStatus.DELIVERED ||
          c.status === ExportContractStatus.CLOSED
            ? 'DELIVERED'
            : c.status === ExportContractStatus.SHIPPED
              ? 'SHIPPED'
              : c.status === ExportContractStatus.STAGED ||
                  c.status === ExportContractStatus.ALLOCATED
                ? 'RESERVED'
                : 'NONE',
      })),
    };
  }

  async exportStore() {
    const lots = await this.lotRepo
      .createQueryBuilder('lot')
      .leftJoinAndSelect('lot.location', 'location')
      .leftJoinAndSelect('lot.item', 'item')
      .where('lot.process_method = :method', { method: 'Export store' })
      .orderBy('lot.created_at', 'DESC')
      .getMany();
    if (lots.length === 0) return [];
    const runs = await this.runsForLots(lots.map((lot) => lot.id));
    const allocations = await this.allocationRepo.find({
      where: { lotId: In(lots.map((lot) => lot.id)) },
      relations: { contract: true },
    });
    return lots.map((lot) => {
      const rows = allocations.filter((row) => row.lotId === lot.id);
      const trace = this.traceForLot(runs, lot.id);
      const onHand = parseFloat(lot.quantity);
      const reserved = rows
        .filter((row) =>
          [
            ExportContractStatus.DRAFT,
            ExportContractStatus.ALLOCATED,
            ExportContractStatus.STAGED,
          ].includes(row.contract?.status),
        )
        .reduce((sum, row) => sum + parseFloat(row.quantityKg), 0);
      const shipped = rows
        .filter((row) =>
          [
            ExportContractStatus.SHIPPED,
            ExportContractStatus.DELIVERED,
            ExportContractStatus.CLOSED,
          ].includes(row.contract?.status),
        )
        .reduce((sum, row) => sum + parseFloat(row.quantityKg), 0);
      return {
        lotId: lot.id,
        lotCode: lot.code,
        grade: lot.grade,
        quantityKg: lot.quantity,
        locationName: lot.location?.name ?? null,
        itemDescription: lot.item?.description ?? null,
        parentLotId: lot.parentLotId,
        ectaGrade: lot.ectaGrade,
        ectaCertificateNumber: lot.ectaCertificateNumber,
        ectaMoisturePercent: lot.ectaMoisturePercent,
        ectaCuppingScore: lot.ectaCuppingScore,
        ectaTestedAt: lot.ectaTestedAt,
        runId: trace?.run.id ?? null,
        runNumber: trace?.run.runNumber ?? null,
        kgPerDoniya: trace?.stage.kgPerDoniya ?? null,
        doniyaCount: trace?.stage.doniyaCount ?? null,
        remainderKg: trace?.stage.remainderKg ?? null,
        documents: trace?.stage.documents ?? [],
        status:
          onHand <= 0.0005 && shipped > 0
            ? 'SHIPPED'
            : reserved > 0.0005
              ? 'RESERVED'
              : 'IN_STORE',
        reservedKg: reserved.toFixed(3),
        shippedKg: shipped.toFixed(3),
        contracts: rows.map((row) => ({
          id: row.contractId,
          contractNumber: row.contract?.contractNumber ?? null,
          status: row.contract?.status ?? null,
          quantityKg: row.quantityKg,
        })),
      };
    }).filter(
      (row) =>
        parseFloat(row.quantityKg) > 0.0005 ||
        parseFloat(row.reservedKg) > 0.0005 ||
        parseFloat(row.shippedKg) > 0.0005,
    );
  }

  async attachLot(lotId: string, dto: AttachExportLotDto, userId?: string) {
    const lot = await this.lotRepo.findOne({ where: { id: lotId } });
    if (!lot || lot.processMethod !== 'Export store') {
      throw new NotFoundException('Export lot not found');
    }
    if (!dto.contractId && !dto.postEcta && !dto.documents) {
      throw new BadRequestException('Choose a contract, documents, or an ECTA result');
    }
    if (dto.contractId) {
      const quantityKg = dto.quantityKg ?? parseFloat(lot.quantity);
      if (!(quantityKg > 0)) {
        throw new BadRequestException('This lot has no kilograms left to attach');
      }
      await this.allocate(
        dto.contractId,
        { lotId, quantityKg, notes: dto.notes },
        userId,
      );
    }
    if (dto.postEcta) {
      await this.lotRepo.update(lotId, {
        ectaGrade: dto.postEcta.grade?.trim() || null,
        ectaCertificateNumber: dto.postEcta.certificateNumber?.trim() || null,
        ectaMoisturePercent:
          dto.postEcta.moisturePercent != null
            ? dto.postEcta.moisturePercent.toFixed(2)
            : null,
        ectaCuppingScore:
          dto.postEcta.cuppingScore != null
            ? dto.postEcta.cuppingScore.toFixed(2)
            : null,
        ectaTestedAt: dto.postEcta.testedAt?.trim() || null,
        ectaNotes: dto.postEcta.notes?.trim() || null,
      });
    }
    if (dto.documents || dto.postEcta) {
      await this.saveLotTrace(lotId, dto);
    }
    const rows = await this.exportStore();
    return rows.find((row) => row.lotId === lotId) ?? null;
  }

  private async runsForLots(lotIds: string[]) {
    if (lotIds.length === 0) return [];
    return this.runRepo
      .createQueryBuilder('run')
      .where('run.output_lot_id IN (:...lotIds)', { lotIds })
      .orWhere(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(run.stage_results, '[]'::jsonb)) elem
          WHERE elem->>'outputLotId' IN (:...lotIds)
        )`,
        { lotIds },
      )
      .getMany();
  }

  private traceForLot(runs: ProcessRun[], lotId: string) {
    for (const run of runs) {
      const stages = (run.stageResults ?? []) as ExportLotStage[];
      const stage =
        stages.find(
          (row) =>
            row.outputLotId === lotId &&
            (row.stage === 'Export Store' || row.stage === 'Packaging & Export Store'),
        ) ??
        stages.find((row) => row.outputLotId === lotId) ??
        (run.outputLotId === lotId ? stages.find((row) => row.stage === 'Export Store') : undefined);
      if (stage || run.outputLotId === lotId) {
        return { run, stage: stage ?? ({} as ExportLotStage) };
      }
    }
    return null;
  }

  private async saveLotTrace(lotId: string, dto: AttachExportLotDto) {
    const runs = await this.runsForLots([lotId]);
    const trace = this.traceForLot(runs, lotId);
    if (!trace) {
      if (dto.documents?.length) {
        throw new BadRequestException(
          'Documents need the process run that created this export lot',
        );
      }
      return;
    }
    const stages = [...((trace.run.stageResults ?? []) as ExportLotStage[])];
    const index = stages.findIndex(
      (row) =>
        row.outputLotId === lotId ||
        row.stage === 'Export Store' ||
        row.stage === 'Packaging & Export Store',
    );
    if (index < 0) return;
    const current = stages[index];
    stages[index] = {
      ...current,
      postEcta: dto.postEcta
        ? {
            grade: dto.postEcta.grade?.trim() || null,
            certificateNumber: dto.postEcta.certificateNumber?.trim() || null,
            moisturePercent:
              dto.postEcta.moisturePercent != null
                ? dto.postEcta.moisturePercent.toFixed(2)
                : null,
            cuppingScore:
              dto.postEcta.cuppingScore != null
                ? dto.postEcta.cuppingScore.toFixed(2)
                : null,
            testedAt: dto.postEcta.testedAt?.trim() || null,
            notes: dto.postEcta.notes?.trim() || null,
          }
        : current.postEcta,
      documents: dto.documents
        ? dto.documents.map((doc) => ({
            key: doc.key,
            label: doc.label,
            reference: doc.reference?.trim() || null,
            notes: doc.notes?.trim() || null,
          }))
        : current.documents,
    };
    trace.run.stageResults = stages as ProcessRun['stageResults'];
    await this.runRepo.save(trace.run);
  }

  async findOne(id: string) {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: {
        customer: true,
        stagingLocation: true,
        allocations: { lot: true },
        sale: { credit: true },
        createdBy: true,
      },
    });
    if (!contract) throw new NotFoundException('Export contract not found');
    return this.withPaymentMeta(contract);
  }

  private withPaymentMeta(contract: ExportContract) {
    const sale = contract.sale;
    const invoiceTotal = sale ? parseFloat(sale.total) : null;
    const paidAmount = sale
      ? parseFloat(sale.paidAmount ?? '0')
      : null;
    const outstanding =
      invoiceTotal == null
        ? null
        : Math.max(0, invoiceTotal - (paidAmount ?? 0));
    let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'NONE' = 'NONE';
    if (sale) {
      if ((paidAmount ?? 0) <= 0) paymentStatus = 'UNPAID';
      else if (outstanding != null && outstanding > 1e-6)
        paymentStatus = 'PARTIAL';
      else paymentStatus = 'PAID';
    }

    const stockState =
      contract.status === ExportContractStatus.DELIVERED ||
      contract.status === ExportContractStatus.CLOSED
        ? 'DELIVERED'
        : contract.status === ExportContractStatus.SHIPPED
          ? 'SHIPPED'
          : contract.status === ExportContractStatus.STAGED ||
              contract.status === ExportContractStatus.ALLOCATED
            ? 'RESERVED'
            : 'NONE';

    return {
      ...contract,
      paymentStatus,
      paidAmount:
        paidAmount != null ? paidAmount.toFixed(2) : null,
      outstandingAmount:
        outstanding != null ? outstanding.toFixed(2) : null,
      invoiceTotal:
        invoiceTotal != null ? invoiceTotal.toFixed(2) : null,
      stockState,
    };
  }

  async create(dto: CreateExportContractDto, userId?: string) {
    const year = new Date().getFullYear();
    const count = await this.contractRepo.count();
    const contractNumber =
      dto.contractNumber?.trim() ||
      `EXP-${year}-${String(count + 1).padStart(4, '0')}`;

    const existing = await this.contractRepo.findOne({
      where: { contractNumber },
    });
    if (existing) {
      throw new BadRequestException(
        `Contract number ${contractNumber} already exists`,
      );
    }

    if (dto.stagingLocationId) {
      const loc = await this.locationRepo.findOne({
        where: { id: dto.stagingLocationId },
      });
      if (!loc) throw new BadRequestException('Staging location not found');
    }

    const saved = await this.contractRepo.save(
      this.contractRepo.create({
        contractNumber,
        orderNumber: dto.orderNumber?.trim() || null,
        buyerName: dto.buyerName.trim(),
        buyerCountry: dto.buyerCountry?.trim() || null,
        customerId: dto.customerId ?? null,
        volumeKg: dto.volumeKg.toFixed(3),
        grade: dto.grade?.trim() || null,
        coffeeType: dto.coffeeType?.trim() || null,
        origin: dto.origin?.trim() || null,
        pricePerKg: dto.pricePerKg.toFixed(4),
        currencyCode: (dto.currencyCode ?? 'USD').toUpperCase(),
        incoterm: dto.incoterm ?? Incoterm.FOB,
        windowStart: dto.windowStart ?? null,
        windowEnd: dto.windowEnd ?? null,
        destination: dto.destination?.trim() || null,
        containerNumber: dto.containerNumber?.trim() || null,
        shippingDate: dto.shippingDate ?? null,
        expectedArrival: dto.expectedArrival ?? null,
        status: ExportContractStatus.DRAFT,
        allocatedKg: '0.000',
        shippedKg: '0.000',
        stagingLocationId: dto.stagingLocationId ?? null,
        bankAccountId: dto.bankAccountId ?? null,
        packingList: [],
        docChecklist: DEFAULT_DOC_CHECKLIST.map((d) => ({ ...d })),
        notes: dto.notes?.trim() || null,
        createdById: userId ?? null,
      }),
    );
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateExportContractDto) {
    const contract = await this.contractRepo.findOne({ where: { id } });
    if (!contract) throw new NotFoundException('Export contract not found');
    if (
      contract.status === ExportContractStatus.SHIPPED ||
      contract.status === ExportContractStatus.DELIVERED ||
      contract.status === ExportContractStatus.CLOSED ||
      contract.status === ExportContractStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot edit a shipped/closed contract');
    }

    if (dto.orderNumber !== undefined) {
      contract.orderNumber = dto.orderNumber?.trim() || null;
    }
    if (dto.buyerName !== undefined) contract.buyerName = dto.buyerName.trim();
    if (dto.buyerCountry !== undefined) {
      contract.buyerCountry = dto.buyerCountry?.trim() || null;
    }
    if (dto.customerId !== undefined) contract.customerId = dto.customerId;
    if (dto.volumeKg !== undefined) {
      contract.volumeKg = dto.volumeKg.toFixed(3);
    }
    if (dto.grade !== undefined) {
      contract.grade = dto.grade?.trim() || null;
    }
    if (dto.coffeeType !== undefined) {
      contract.coffeeType = dto.coffeeType?.trim() || null;
    }
    if (dto.origin !== undefined) {
      contract.origin = dto.origin?.trim() || null;
    }
    if (dto.pricePerKg !== undefined) {
      contract.pricePerKg = dto.pricePerKg.toFixed(4);
    }
    if (dto.currencyCode !== undefined) {
      contract.currencyCode = dto.currencyCode.toUpperCase();
    }
    if (dto.incoterm !== undefined) contract.incoterm = dto.incoterm;
    if (dto.windowStart !== undefined) contract.windowStart = dto.windowStart;
    if (dto.windowEnd !== undefined) contract.windowEnd = dto.windowEnd;
    if (dto.destination !== undefined) {
      contract.destination = dto.destination?.trim() || null;
    }
    if (dto.containerNumber !== undefined) {
      contract.containerNumber = dto.containerNumber?.trim() || null;
    }
    if (dto.shippingDate !== undefined) {
      contract.shippingDate = dto.shippingDate;
    }
    if (dto.expectedArrival !== undefined) {
      contract.expectedArrival = dto.expectedArrival;
    }
    if (dto.stagingLocationId !== undefined) {
      contract.stagingLocationId = dto.stagingLocationId;
    }
    if (dto.bankAccountId !== undefined) {
      contract.bankAccountId = dto.bankAccountId;
    }
    if (dto.notes !== undefined) contract.notes = dto.notes?.trim() || null;

    await this.contractRepo.save(contract);
    return this.findOne(id);
  }

  private async reservedOnLot(
    lotId: string,
    manager: EntityManager,
    excludeContractId?: string,
  ): Promise<number> {
    const qb = manager
      .getRepository(ExportAllocation)
      .createQueryBuilder('a')
      .innerJoin('a.contract', 'c')
      .select('COALESCE(SUM(a.quantity_kg::numeric), 0)', 'qty')
      .where('a.lot_id = :lotId', { lotId })
      .andWhere('c.status IN (:...statuses)', {
        statuses: OPEN_RESERVE_STATUSES,
      });
    if (excludeContractId) {
      qb.andWhere('c.id != :excludeContractId', { excludeContractId });
    }
    const raw = await qb.getRawOne<{ qty: string }>();
    return parseFloat(raw?.qty ?? '0');
  }

  async allocate(id: string, dto: AllocateExportLotDto, userId?: string) {
    const contract = await this.findOne(id);
    if (
      contract.status === ExportContractStatus.SHIPPED ||
      contract.status === ExportContractStatus.DELIVERED ||
      contract.status === ExportContractStatus.CLOSED ||
      contract.status === ExportContractStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot allocate to this contract');
    }

    const lot = await this.lotRepo.findOne({
      where: { id: dto.lotId },
      relations: { item: true },
    });
    if (!lot) throw new BadRequestException('Lot not found');
    if (lot.status !== LotStatus.ACTIVE) {
      throw new BadRequestException('Lot is not active');
    }
    if (!lot.locationId || !lot.itemId) {
      throw new BadRequestException('Lot missing location/item');
    }
    if (contract.grade && lot.grade && contract.grade !== lot.grade) {
      throw new BadRequestException(
        `Lot grade ${lot.grade} does not match contract grade ${contract.grade}`,
      );
    }

    const nextAllocated = parseFloat(contract.allocatedKg) + dto.quantityKg;
    if (nextAllocated > parseFloat(contract.volumeKg) + 1e-6) {
      throw new BadRequestException(
        `Allocation would exceed contract volume (${contract.volumeKg} kg)`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const available = await this.stockService.getAvailableQuantity(
        lot.locationId!,
        lot.itemId!,
        manager,
        lot.id,
      );
      if (available + 1e-9 < dto.quantityKg) {
        throw new BadRequestException(
          `Insufficient available stock (excludes export-reserved). Available: ${available.toFixed(3)} kg`,
        );
      }

      const alreadyReservedElsewhere = await this.reservedOnLot(
        lot.id,
        manager,
        contract.id,
      );
      const onHand = parseFloat(lot.quantity);
      if (alreadyReservedElsewhere + dto.quantityKg > onHand + 1e-6) {
        throw new BadRequestException(
          `Lot over-allocated. On hand ${onHand}, already reserved elsewhere ${alreadyReservedElsewhere}`,
        );
      }

      await this.stockService.reserve(
        lot.locationId!,
        lot.itemId!,
        dto.quantityKg,
        manager,
        lot.id,
      );

      const allocationRepo = manager.getRepository(ExportAllocation);
      const contractRepo = manager.getRepository(ExportContract);
      const eventRepo = manager.getRepository(LotEvent);

      await allocationRepo.save(
        allocationRepo.create({
          contractId: contract.id,
          lotId: lot.id,
          quantityKg: dto.quantityKg.toFixed(3),
          notes: dto.notes?.trim() || null,
        }),
      );

      const c = await contractRepo.findOne({ where: { id: contract.id } });
      if (!c) throw new NotFoundException('Export contract not found');
      c.allocatedKg = nextAllocated.toFixed(3);
      if (
        c.status === ExportContractStatus.DRAFT ||
        c.status === ExportContractStatus.ALLOCATED
      ) {
        c.status = ExportContractStatus.ALLOCATED;
      }
      await contractRepo.save(c);

      await eventRepo.save(
        eventRepo.create({
          lotId: lot.id,
          eventType: LotEventType.ALLOCATED_EXPORT,
          quantity: dto.quantityKg.toFixed(3),
          notes: `Reserved for export ${contract.contractNumber}`,
          createdById: userId ?? null,
          metadata: {
            exportContractId: contract.id,
            contractNumber: contract.contractNumber,
            reserved: true,
          },
        }),
      );
    });

    return this.findOne(id);
  }

  async deallocate(id: string, allocationId: string, userId?: string) {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: { allocations: { lot: true } },
    });
    if (!contract) throw new NotFoundException('Export contract not found');
    if (
      contract.status !== ExportContractStatus.DRAFT &&
      contract.status !== ExportContractStatus.ALLOCATED
    ) {
      throw new BadRequestException(
        'Deallocate only while DRAFT or ALLOCATED (unstage first if needed)',
      );
    }

    const alloc = contract.allocations?.find((a) => a.id === allocationId);
    if (!alloc) throw new NotFoundException('Allocation not found');

    await this.dataSource.transaction(async (manager) => {
      await this.releaseAllocationReserve(alloc, manager, userId, contract);
      await manager.getRepository(ExportAllocation).delete(allocationId);

      const remaining = contract.allocations!
        .filter((a) => a.id !== allocationId)
        .reduce((s, a) => s + parseFloat(a.quantityKg), 0);
      contract.allocatedKg = remaining.toFixed(3);
      if (remaining <= 1e-9) {
        contract.status = ExportContractStatus.DRAFT;
        contract.allocatedKg = '0.000';
      }
      await manager.getRepository(ExportContract).save(contract);
    });

    return this.findOne(id);
  }

  private async releaseAllocationReserve(
    alloc: ExportAllocation,
    manager: EntityManager,
    userId: string | undefined,
    contract: ExportContract,
  ) {
    const lot =
      alloc.lot ??
      (await manager.getRepository(Lot).findOne({ where: { id: alloc.lotId } }));
    if (lot?.locationId && lot.itemId) {
      await this.stockService.releaseReserve(
        lot.locationId,
        lot.itemId,
        parseFloat(alloc.quantityKg),
        manager,
        lot.id,
      );
      await manager.getRepository(LotEvent).save(
        manager.getRepository(LotEvent).create({
          lotId: lot.id,
          eventType: LotEventType.RELEASED_EXPORT,
          quantity: alloc.quantityKg,
          notes: `Released from export ${contract.contractNumber}`,
          createdById: userId ?? null,
          metadata: {
            exportContractId: contract.id,
            contractNumber: contract.contractNumber,
          },
        }),
      );
    }
  }

  async updateChecklist(id: string, dto: UpdateDocChecklistDto) {
    const contract = await this.contractRepo.findOne({ where: { id } });
    if (!contract) throw new NotFoundException('Export contract not found');
    if (
      contract.status === ExportContractStatus.CLOSED ||
      contract.status === ExportContractStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot update checklist');
    }
    contract.docChecklist = dto.docChecklist.map((d) => ({
      key: d.key,
      label: d.label,
      done: d.done,
      reference: d.reference?.trim() || null,
      url: d.url?.trim() || null,
    }));
    await this.contractRepo.save(contract);
    return this.findOne(id);
  }

  async stage(id: string, userId?: string) {
    const contract = await this.findOne(id);
    if (contract.status !== ExportContractStatus.ALLOCATED) {
      throw new BadRequestException(
        'Only ALLOCATED contracts can be staged',
      );
    }
    if (parseFloat(contract.allocatedKg) <= 0) {
      throw new BadRequestException('Allocate lots before staging');
    }
    if (!contract.stagingLocationId) {
      throw new BadRequestException('Set staging location first');
    }

    await this.dataSource.transaction(async (manager) => {
      const contractRepo = manager.getRepository(ExportContract);
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);

      for (const alloc of contract.allocations ?? []) {
        const lot = await lotRepo.findOne({ where: { id: alloc.lotId } });
        if (!lot || !lot.locationId || !lot.itemId) continue;
        const qty = parseFloat(alloc.quantityKg);
        const fromLocationId = lot.locationId;
        if (fromLocationId !== contract.stagingLocationId) {
          await this.stockService.transfer(
            fromLocationId,
            contract.stagingLocationId!,
            lot.itemId,
            qty,
            manager,
            lot.id,
            {
              reservedQty: qty,
              createdById: userId ?? null,
              notes: `Staged for ${contract.contractNumber}`,
              referenceType: 'export_contract',
              referenceId: contract.id,
              reference: contract.contractNumber,
              outSourceType: StockMovementSourceType.TRANSFER_OUT,
              inSourceType: StockMovementSourceType.TRANSFER_IN,
            },
          );
          lot.locationId = contract.stagingLocationId;
          await lotRepo.save(lot);
          await eventRepo.save(
            eventRepo.create({
              lotId: lot.id,
              eventType: LotEventType.TRANSFERRED,
              quantity: alloc.quantityKg,
              fromLocationId,
              toLocationId: contract.stagingLocationId,
              notes: `Staged (reserved) for ${contract.contractNumber}`,
              createdById: userId ?? null,
              metadata: { exportContractId: contract.id, stage: true },
            }),
          );
        }
      }

      const c = await contractRepo.findOne({ where: { id: contract.id } });
      if (!c) throw new NotFoundException('Export contract not found');
      c.status = ExportContractStatus.STAGED;
      await contractRepo.save(c);
    });

    return this.findOne(id);
  }

  async ship(id: string, dto: ShipExportContractDto, userId?: string) {
    const contract = await this.findOne(id);
    if (
      contract.status !== ExportContractStatus.STAGED &&
      contract.status !== ExportContractStatus.ALLOCATED
    ) {
      throw new BadRequestException(
        'Contract must be ALLOCATED or STAGED to ship',
      );
    }
    if (parseFloat(contract.allocatedKg) <= 0) {
      throw new BadRequestException('No allocations to ship');
    }

    const incomplete = (contract.docChecklist ?? []).filter((d) => !d.done);
    if (incomplete.length > 0) {
      throw new BadRequestException(
        `Complete dossier first: ${incomplete.map((d) => d.label).join(', ')}`,
      );
    }

    const bankAccountId = dto.bankAccountId ?? contract.bankAccountId;
    const createSale = dto.createSale !== false;

    await this.dataSource.transaction(async (manager) => {
      const contractRepo = manager.getRepository(ExportContract);
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);
      const saleRepo = manager.getRepository(Sale);
      const itemRepo = manager.getRepository(Item);

      const packingList: ExportPackingLine[] = [];
      let shippedKg = 0;

      for (const alloc of contract.allocations ?? []) {
        const lot = await lotRepo.findOne({
          where: { id: alloc.lotId },
          relations: { item: true },
        });
        if (!lot || !lot.itemId || !lot.locationId) {
          throw new BadRequestException(
            `Lot ${alloc.lotId} missing location/item for ship`,
          );
        }
        const qty = parseFloat(alloc.quantityKg);

        // Unlock reservation then ship physical OUT
        await this.stockService.releaseReserve(
          lot.locationId,
          lot.itemId,
          qty,
          manager,
          lot.id,
        );

        const onHand = await this.stockService.getQuantity(
          lot.locationId,
          lot.itemId,
          manager,
          lot.id,
        );
        if (onHand < qty - 1e-6) {
          throw new BadRequestException(
            `Insufficient stock for lot ${lot.code}: on hand ${onHand}`,
          );
        }

        await this.stockService.adjust(
          {
            locationId: lot.locationId,
            itemId: lot.itemId,
            quantityDelta: -qty,
            lotId: lot.id,
            meta: {
              sourceType: StockMovementSourceType.SALE_EXPORT,
              referenceType: 'export_contract',
              referenceId: contract.id,
              reference: contract.contractNumber,
              createdById: userId ?? null,
              notes: `Shipped ${contract.contractNumber}`,
            },
          },
          manager,
        );

        const remaining = Math.max(0, parseFloat(lot.quantity) - qty);
        lot.quantity = remaining.toFixed(3);
        await lotRepo.save(lot);

        await eventRepo.save(
          eventRepo.create({
            lotId: lot.id,
            eventType: LotEventType.SHIPPED,
            quantity: alloc.quantityKg,
            fromLocationId: lot.locationId,
            notes:
              dto.notes?.trim() ||
              `Shipped on ${contract.contractNumber}`,
            createdById: userId ?? null,
            metadata: {
              exportContractId: contract.id,
              contractNumber: contract.contractNumber,
              incoterm: contract.incoterm,
              containerNumber:
                dto.containerNumber ?? contract.containerNumber,
            },
          }),
        );

        packingList.push({
          lotId: lot.id,
          lotCode: lot.code,
          quantityKg: qty,
          grade: lot.grade,
        });
        shippedKg += qty;
      }

      let saleId: string | null = null;
      if (createSale) {
        const first = (contract.allocations ?? [])[0];
        const firstLot = await lotRepo.findOne({
          where: { id: first.lotId },
        });
        const locationId =
          contract.stagingLocationId ?? firstLot?.locationId;
        if (!locationId) {
          throw new BadRequestException('No location for export sale');
        }

        const saleLines: SaleLine[] = [];
        let subtotal = 0;
        for (const alloc of contract.allocations ?? []) {
          const lot = await lotRepo.findOne({
            where: { id: alloc.lotId },
          });
          if (!lot?.itemId) continue;
          const item = await itemRepo.findOne({ where: { id: lot.itemId } });
          const qty = parseFloat(alloc.quantityKg);
          const unitPrice = parseFloat(contract.pricePerKg);
          const lineTotal = qty * unitPrice;
          subtotal += lineTotal;
          const stock = await this.stockService.getStock(
            locationId,
            lot.itemId,
            manager,
            lot.id,
          );
          saleLines.push(
            Object.assign(new SaleLine(), {
              itemId: lot.itemId,
              lotId: lot.id,
              quantity: qty.toFixed(3),
              unitPrice: unitPrice.toFixed(2),
              purchaseCost: stock
                ? parseFloat(stock.purchasePrice).toFixed(2)
                : '0.00',
              lineTotal: lineTotal.toFixed(2),
              item,
            }),
          );
        }

        const paymentMethod = bankAccountId
          ? PaymentMethod.BANK
          : PaymentMethod.CREDIT;
        const sale = await saleRepo.save(
          saleRepo.create({
            customerId: contract.customerId,
            locationId,
            channel: SaleChannel.EXPORT,
            currencyCode: contract.currencyCode,
            fxRate:
              dto.fxRate !== undefined ? dto.fxRate.toFixed(6) : null,
            exportContractId: contract.id,
            paymentMethod,
            bankAccountId: bankAccountId ?? null,
            allowNegativeStock: false,
            subtotal: subtotal.toFixed(2),
            total: subtotal.toFixed(2),
            paidAmount:
              paymentMethod === PaymentMethod.CREDIT
                ? '0.00'
                : subtotal.toFixed(2),
            notes: `Export ${contract.contractNumber} · ${contract.incoterm}`,
            status: DocumentStatus.ACTIVE,
            createdById: userId ?? null,
            soldByUserId: userId ?? null,
            commissionPercent: '0.00',
            commissionAmount: '0.00',
            lines: saleLines,
          }),
        );
        saleId = sale.id;

        if (bankAccountId) {
          await this.bankLedger.recordTransaction(
            {
              bankAccountId,
              type: BankTransactionType.SALE,
              amount: subtotal,
              direction: 'in',
              description: `Export sale ${contract.contractNumber}`,
              refType: 'sale',
              refId: sale.id,
              createdById: userId,
            },
            manager,
          );
        }
      }

      const c = await contractRepo.findOne({ where: { id: contract.id } });
      if (!c) throw new NotFoundException('Export contract not found');
      c.packingList = packingList;
      c.shippedKg = shippedKg.toFixed(3);
      c.shippedAt = new Date();
      c.status = ExportContractStatus.SHIPPED;
      c.saleId = saleId;
      if (dto.containerNumber !== undefined) {
        c.containerNumber = dto.containerNumber.trim() || null;
      }
      if (dto.shippingDate !== undefined) {
        c.shippingDate = dto.shippingDate;
      } else if (!c.shippingDate) {
        c.shippingDate = new Date().toISOString().slice(0, 10);
      }
      if (dto.expectedArrival !== undefined) {
        c.expectedArrival = dto.expectedArrival;
      }
      if (dto.destination !== undefined) {
        c.destination = dto.destination.trim() || null;
      }
      if (dto.notes) c.notes = dto.notes.trim();
      await contractRepo.save(c);
    });

    return this.findOne(id);
  }

  async markDelivered(id: string, userId?: string) {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: { allocations: true },
    });
    if (!contract) throw new NotFoundException('Export contract not found');
    if (contract.status !== ExportContractStatus.SHIPPED) {
      throw new BadRequestException('Only SHIPPED contracts can be delivered');
    }
    contract.status = ExportContractStatus.DELIVERED;
    contract.deliveredAt = new Date();
    await this.contractRepo.save(contract);

    await this.dataSource.transaction(async (manager) => {
      const eventRepo = manager.getRepository(LotEvent);
      for (const alloc of contract.allocations ?? []) {
        await eventRepo.save(
          eventRepo.create({
            lotId: alloc.lotId,
            eventType: LotEventType.DELIVERED,
            quantity: alloc.quantityKg,
            notes: `Delivered ${contract.contractNumber}`,
            createdById: userId ?? null,
            metadata: {
              exportContractId: contract.id,
              contractNumber: contract.contractNumber,
            },
          }),
        );
      }
    });

    return this.findOne(id);
  }

  async close(id: string) {
    const contract = await this.contractRepo.findOne({ where: { id } });
    if (!contract) throw new NotFoundException('Export contract not found');
    if (
      contract.status !== ExportContractStatus.SHIPPED &&
      contract.status !== ExportContractStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Only SHIPPED or DELIVERED contracts can be closed',
      );
    }
    contract.status = ExportContractStatus.CLOSED;
    await this.contractRepo.save(contract);
    return this.findOne(id);
  }

  async cancel(id: string, userId?: string) {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: { allocations: { lot: true } },
    });
    if (!contract) throw new NotFoundException('Export contract not found');
    if (
      contract.status === ExportContractStatus.SHIPPED ||
      contract.status === ExportContractStatus.DELIVERED ||
      contract.status === ExportContractStatus.CLOSED
    ) {
      throw new BadRequestException('Cannot cancel shipped/closed contract');
    }

    await this.dataSource.transaction(async (manager) => {
      for (const alloc of contract.allocations ?? []) {
        await this.releaseAllocationReserve(alloc, manager, userId, contract);
      }
      if ((contract.allocations ?? []).length > 0) {
        await manager.getRepository(ExportAllocation).delete({
          id: In(contract.allocations!.map((a) => a.id)),
        });
      }
      contract.status = ExportContractStatus.CANCELLED;
      contract.allocatedKg = '0.000';
      await manager.getRepository(ExportContract).save(contract);
    });

    return this.findOne(id);
  }
}
