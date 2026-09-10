import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  BankTransactionType,
  DocumentStatus,
  ExportContractStatus,
  Incoterm,
  LotEventType,
  LotStatus,
  PaymentMethod,
  SaleChannel,
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
import { SaleLine } from '../database/entities/sale-line.entity';
import { Sale } from '../database/entities/sale.entity';
import { StockService } from '../inventory/stock.service';
import {
  AllocateExportLotDto,
  CreateExportContractDto,
  ExportContractListQueryDto,
  ShipExportContractDto,
  UpdateDocChecklistDto,
  UpdateExportContractDto,
} from './dto/export-contract.dto';

const DEFAULT_DOC_CHECKLIST: ExportDocCheckItem[] = [
  { key: 'COO', label: 'Certificate of Origin', done: false },
  { key: 'PHYTO', label: 'Phytosanitary certificate', done: false },
  { key: 'QC', label: 'QC / cupping certificate', done: false },
  { key: 'PACKING', label: 'Packing list', done: false },
  { key: 'INVOICE', label: 'Commercial invoice', done: false },
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
    private readonly bankLedger: BankLedgerService,
  ) {}

  findAll(query: ExportContractListQueryDto) {
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
      'contract.buyer_name',
      'contract.grade',
      'contract.notes',
    ]);
    applyDateRangeToQb(qb, 'contract.created_at', query.from, query.to);
    return paginatedQueryBuilder(qb, query.page, query.limit);
  }

  async findOne(id: string) {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: {
        customer: true,
        stagingLocation: true,
        allocations: { lot: true },
        sale: true,
        createdBy: true,
      },
    });
    if (!contract) throw new NotFoundException('Export contract not found');
    return contract;
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
        buyerName: dto.buyerName.trim(),
        customerId: dto.customerId ?? null,
        volumeKg: dto.volumeKg.toFixed(3),
        grade: dto.grade?.trim() || null,
        pricePerKg: dto.pricePerKg.toFixed(4),
        currencyCode: (dto.currencyCode ?? 'USD').toUpperCase(),
        incoterm: dto.incoterm ?? Incoterm.FOB,
        windowStart: dto.windowStart ?? null,
        windowEnd: dto.windowEnd ?? null,
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
    const contract = await this.findOne(id);
    if (
      contract.status === ExportContractStatus.SHIPPED ||
      contract.status === ExportContractStatus.CLOSED ||
      contract.status === ExportContractStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot edit a shipped/closed contract');
    }

    if (dto.buyerName !== undefined) contract.buyerName = dto.buyerName.trim();
    if (dto.customerId !== undefined) contract.customerId = dto.customerId;
    if (dto.volumeKg !== undefined) {
      contract.volumeKg = dto.volumeKg.toFixed(3);
    }
    if (dto.grade !== undefined) {
      contract.grade = dto.grade?.trim() || null;
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

  async allocate(id: string, dto: AllocateExportLotDto, userId?: string) {
    const contract = await this.findOne(id);
    if (
      contract.status === ExportContractStatus.SHIPPED ||
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
    if (parseFloat(lot.quantity) < dto.quantityKg) {
      throw new BadRequestException(
        `Insufficient lot qty. Available: ${lot.quantity}`,
      );
    }
    if (contract.grade && lot.grade && contract.grade !== lot.grade) {
      throw new BadRequestException(
        `Lot grade ${lot.grade} does not match contract grade ${contract.grade}`,
      );
    }

    const nextAllocated =
      parseFloat(contract.allocatedKg) + dto.quantityKg;
    if (nextAllocated > parseFloat(contract.volumeKg) + 1e-6) {
      throw new BadRequestException(
        `Allocation would exceed contract volume (${contract.volumeKg} kg)`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
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

      contract.allocatedKg = nextAllocated.toFixed(3);
      if (
        contract.status === ExportContractStatus.DRAFT ||
        contract.status === ExportContractStatus.ALLOCATED
      ) {
        contract.status = ExportContractStatus.ALLOCATED;
      }
      await contractRepo.save(contract);

      await eventRepo.save(
        eventRepo.create({
          lotId: lot.id,
          eventType: LotEventType.ALLOCATED_EXPORT,
          quantity: dto.quantityKg.toFixed(3),
          notes: `Allocated to ${contract.contractNumber}`,
          createdById: userId ?? null,
          metadata: {
            exportContractId: contract.id,
            contractNumber: contract.contractNumber,
          },
        }),
      );
    });

    return this.findOne(id);
  }

  async updateChecklist(id: string, dto: UpdateDocChecklistDto) {
    const contract = await this.findOne(id);
    if (
      contract.status === ExportContractStatus.CLOSED ||
      contract.status === ExportContractStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot update checklist');
    }
    contract.docChecklist = dto.docChecklist;
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

      for (const alloc of contract.allocations) {
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
              notes: `Staged for ${contract.contractNumber}`,
              createdById: userId ?? null,
              metadata: { exportContractId: contract.id, stage: true },
            }),
          );
        }
      }

      contract.status = ExportContractStatus.STAGED;
      await contractRepo.save(contract);
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

      for (const alloc of contract.allocations) {
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
        const available = await this.stockService.getQuantity(
          lot.locationId,
          lot.itemId,
          manager,
          lot.id,
        );
        if (available < qty - 1e-6) {
          throw new BadRequestException(
            `Insufficient stock for lot ${lot.code}: available ${available}`,
          );
        }

        await this.stockService.adjust(
          {
            locationId: lot.locationId,
            itemId: lot.itemId,
            quantityDelta: -qty,
            lotId: lot.id,
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
        const first = contract.allocations[0];
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
        for (const alloc of contract.allocations) {
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

        const sale = await saleRepo.save(
          saleRepo.create({
            customerId: contract.customerId,
            locationId,
            channel: SaleChannel.EXPORT,
            currencyCode: contract.currencyCode,
            fxRate:
              dto.fxRate !== undefined ? dto.fxRate.toFixed(6) : null,
            exportContractId: contract.id,
            paymentMethod: bankAccountId
              ? PaymentMethod.BANK
              : PaymentMethod.CREDIT,
            bankAccountId: bankAccountId ?? null,
            allowNegativeStock: false,
            subtotal: subtotal.toFixed(2),
            total: subtotal.toFixed(2),
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

      contract.packingList = packingList;
      contract.shippedKg = shippedKg.toFixed(3);
      contract.shippedAt = new Date();
      contract.status = ExportContractStatus.SHIPPED;
      contract.saleId = saleId;
      if (dto.notes) contract.notes = dto.notes.trim();
      await contractRepo.save(contract);
    });

    return this.findOne(id);
  }

  async close(id: string) {
    const contract = await this.findOne(id);
    if (contract.status !== ExportContractStatus.SHIPPED) {
      throw new BadRequestException('Only SHIPPED contracts can be closed');
    }
    contract.status = ExportContractStatus.CLOSED;
    await this.contractRepo.save(contract);
    return this.findOne(id);
  }

  async cancel(id: string) {
    const contract = await this.findOne(id);
    if (
      contract.status === ExportContractStatus.SHIPPED ||
      contract.status === ExportContractStatus.CLOSED
    ) {
      throw new BadRequestException('Cannot cancel shipped/closed contract');
    }
    contract.status = ExportContractStatus.CANCELLED;
    await this.contractRepo.save(contract);
    return this.findOne(id);
  }
}
