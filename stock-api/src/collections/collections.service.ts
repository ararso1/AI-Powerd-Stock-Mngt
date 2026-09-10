import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  BankTransactionType,
  CoffeeForm,
  CreditStatus,
  DocumentStatus,
  ItemType,
  LotEventType,
  LotStatus,
  PaymentMethod,
} from '../common/enums';
import {
  applyDateRangeToQb,
  applyRelatedIlikeSearch,
  paginatedQueryBuilder,
  sumFilteredQueryBuilder,
} from '../common/utils/query.util';
import { BankLedgerService } from '../banks/bank-ledger.service';
import { BanksService } from '../banks/banks.service';
import { CherryPrice } from '../database/entities/cherry-price.entity';
import { CollectionTicket } from '../database/entities/collection-ticket.entity';
import { Item } from '../database/entities/item.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { PurchaseLine } from '../database/entities/purchase-line.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { SupplierCredit } from '../database/entities/supplier-credit.entity';
import { StockService } from '../inventory/stock.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CherryPriceQueryDto,
  CollectionListQueryDto,
} from './dto/collection-list-query.dto';
import {
  CreateCollectionDto,
  UpsertCherryPriceDto,
} from './dto/collection.dto';

const CHERRY_SKU = 'COF-CHERRY';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(CollectionTicket)
    private readonly ticketRepo: Repository<CollectionTicket>,
    @InjectRepository(CherryPrice)
    private readonly priceRepo: Repository<CherryPrice>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
    private readonly bankLedger: BankLedgerService,
    private readonly banksService: BanksService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll(query: CollectionListQueryDto) {
    const filteredQb = this.buildFilterQb(query);
    return Promise.all([
      sumFilteredQueryBuilder(filteredQb, [
        {
          key: 'weightKg',
          sql: 'COALESCE(SUM(ticket.weight_kg::numeric), 0)',
        },
        {
          key: 'totalAmount',
          sql: 'COALESCE(SUM(ticket.total_amount::numeric), 0)',
        },
      ]),
      paginatedQueryBuilder(
        filteredQb
          .clone()
          .leftJoinAndSelect('ticket.supplier', 'supplier')
          .leftJoinAndSelect('ticket.location', 'location')
          .leftJoinAndSelect('ticket.lot', 'lot')
          .leftJoinAndSelect('ticket.item', 'item')
          .orderBy('ticket.created_at', 'DESC'),
        query.page,
        query.limit,
      ),
    ]).then(([totals, page]) => ({ ...page, totals }));
  }

  private buildFilterQb(query: CollectionListQueryDto) {
    const qb = this.ticketRepo.createQueryBuilder('ticket');
    if (query.status) {
      qb.andWhere('ticket.status = :status', { status: query.status });
    } else {
      qb.andWhere('ticket.status = :status', {
        status: DocumentStatus.ACTIVE,
      });
    }
    if (query.supplierId) {
      qb.andWhere('ticket.supplier_id = :supplierId', {
        supplierId: query.supplierId,
      });
    }
    if (query.locationId) {
      qb.andWhere('ticket.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.paymentMethod) {
      qb.andWhere('ticket.payment_method = :paymentMethod', {
        paymentMethod: query.paymentMethod,
      });
    }
    if (query.grade) {
      qb.andWhere('ticket.grade ILIKE :grade', { grade: `%${query.grade}%` });
    }
    applyRelatedIlikeSearch(qb, query.search, [
      'ticket.ticket_number',
      'ticket.grade',
      'ticket.region',
      'ticket.notes',
    ], {
      table: 'suppliers',
      alias: 'supplier_filter',
      parentKey: 'ticket.supplier_id',
      relatedKey: 'id',
      columns: ['name', 'phone'],
    });
    applyDateRangeToQb(qb, 'ticket.created_at', query.from, query.to);
    return qb;
  }

  async findOne(id: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: {
        supplier: true,
        location: true,
        item: true,
        lot: true,
        purchase: true,
        bankAccount: true,
        createdBy: true,
      },
    });
    if (!ticket) throw new NotFoundException('Collection ticket not found');
    return ticket;
  }

  listPrices(query: CherryPriceQueryDto) {
    const qb = this.priceRepo
      .createQueryBuilder('price')
      .where('price.is_active = true')
      .orderBy('price.crop_year', 'DESC')
      .addOrderBy('price.grade', 'ASC');
    if (query.grade) {
      qb.andWhere('price.grade ILIKE :grade', { grade: query.grade });
    }
    if (query.cropYear) {
      qb.andWhere('price.crop_year = :cropYear', { cropYear: query.cropYear });
    }
    return qb.getMany();
  }

  async upsertPrice(dto: UpsertCherryPriceDto) {
    let row = await this.priceRepo.findOne({
      where: { grade: dto.grade, cropYear: dto.cropYear },
    });
    if (!row) {
      row = this.priceRepo.create({
        grade: dto.grade,
        cropYear: dto.cropYear,
        pricePerKg: dto.pricePerKg.toFixed(2),
        notes: dto.notes ?? null,
        isActive: true,
      });
    } else {
      row.pricePerKg = dto.pricePerKg.toFixed(2);
      row.notes = dto.notes ?? row.notes;
      row.isActive = true;
    }
    return this.priceRepo.save(row);
  }

  async create(dto: CreateCollectionDto, userId?: string) {
    const needsBank =
      dto.paymentMethod === PaymentMethod.BANK ||
      dto.paymentMethod === PaymentMethod.CASH;
    if (needsBank && !dto.bankAccountId) {
      throw new BadRequestException(
        'bankAccountId required for BANK and CASH payments',
      );
    }

    const supplier = await this.supplierRepo.findOne({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new BadRequestException('Supplier (farmer) not found');

    const location = await this.locationRepo.findOne({
      where: { id: dto.locationId },
    });
    if (!location) throw new BadRequestException('Location not found');

    const item = await this.resolveCherryItem(dto.itemId);
    const total = dto.weightKg * dto.pricePerKg;

    const ticketId = await this.dataSource.transaction(async (manager) => {
      if (needsBank && dto.bankAccountId) {
        await this.banksService.assertPaymentAccount(
          dto.paymentMethod,
          dto.bankAccountId,
          manager,
        );
      }

      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);
      const purchaseRepo = manager.getRepository(Purchase);
      const creditRepo = manager.getRepository(SupplierCredit);
      const ticketRepo = manager.getRepository(CollectionTicket);

      const lotCode =
        dto.lotCode?.trim() ||
        `COL-${new Date().getFullYear()}-${String((await lotRepo.count()) + 1).padStart(4, '0')}`;
      const existingCode = await lotRepo.findOne({ where: { code: lotCode } });
      if (existingCode) {
        throw new BadRequestException(`Lot code ${lotCode} already exists`);
      }

      const lot = await lotRepo.save(
        lotRepo.create({
          code: lotCode,
          itemId: item.id,
          locationId: dto.locationId,
          form: CoffeeForm.CHERRY,
          grade: dto.grade ?? null,
          cropYear: dto.cropYear ?? null,
          variety: dto.variety ?? null,
          processMethod: null,
          region: dto.region ?? null,
          woreda: dto.woreda ?? null,
          kebele: dto.kebele ?? null,
          moisturePercent:
            dto.moisturePercent !== undefined
              ? dto.moisturePercent.toFixed(2)
              : null,
          quantity: dto.weightKg.toFixed(3),
          status: LotStatus.ACTIVE,
          notes: dto.notes ?? `Cherry collection from ${supplier.name}`,
          createdById: userId ?? null,
        }),
      );

      await eventRepo.save([
        eventRepo.create({
          lotId: lot.id,
          eventType: LotEventType.CREATED,
          quantity: lot.quantity,
          toLocationId: dto.locationId,
          notes: 'Lot opened from cherry intake',
          createdById: userId ?? null,
          metadata: { source: 'collection' },
        }),
        eventRepo.create({
          lotId: lot.id,
          eventType: LotEventType.COLLECTED,
          quantity: lot.quantity,
          toLocationId: dto.locationId,
          notes: `Collected ${dto.weightKg} kg @ ${dto.pricePerKg}/kg from ${supplier.name}`,
          createdById: userId ?? null,
          metadata: {
            supplierId: supplier.id,
            grade: dto.grade ?? null,
            pricePerKg: dto.pricePerKg,
          },
        }),
      ]);

      const purchase = await purchaseRepo.save(
        purchaseRepo.create({
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          paymentMethod: dto.paymentMethod,
          bankAccountId: dto.bankAccountId ?? null,
          subtotal: total.toFixed(2),
          total: total.toFixed(2),
          notes: `Cherry collection ${lot.code}`,
          status: DocumentStatus.ACTIVE,
          createdById: userId ?? null,
          lines: [
            Object.assign(new PurchaseLine(), {
              itemId: item.id,
              quantity: dto.weightKg.toFixed(3),
              unitPrice: dto.pricePerKg.toFixed(2),
              lineTotal: total.toFixed(2),
            }),
          ],
        }),
      );

      await this.stockService.adjust(
        {
          locationId: dto.locationId,
          itemId: item.id,
          quantityDelta: dto.weightKg,
          purchasePrice: dto.pricePerKg,
          lotId: lot.id,
        },
        manager,
      );

      if (needsBank && dto.bankAccountId) {
        await this.bankLedger.recordTransaction(
          {
            bankAccountId: dto.bankAccountId,
            type: BankTransactionType.PURCHASE,
            amount: total,
            direction: 'out',
            description: `Cherry collection ${lot.code}`,
            refType: 'purchase',
            refId: purchase.id,
            createdById: userId,
          },
          manager,
        );
      }

      if (dto.paymentMethod === PaymentMethod.CREDIT) {
        await creditRepo.save(
          creditRepo.create({
            supplierId: dto.supplierId,
            purchaseId: purchase.id,
            amount: total.toFixed(2),
            paidAmount: '0',
            balance: total.toFixed(2),
            status: CreditStatus.OPEN,
            dueDate: dto.creditDueDate ?? null,
          }),
        );
      }

      const ticketNumber = `TKT-${new Date().getFullYear()}-${String((await ticketRepo.count()) + 1).padStart(4, '0')}`;
      const ticket = await ticketRepo.save(
        ticketRepo.create({
          ticketNumber,
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          itemId: item.id,
          lotId: lot.id,
          purchaseId: purchase.id,
          weightKg: dto.weightKg.toFixed(3),
          grade: dto.grade ?? null,
          pricePerKg: dto.pricePerKg.toFixed(2),
          totalAmount: total.toFixed(2),
          paymentMethod: dto.paymentMethod,
          bankAccountId: dto.bankAccountId ?? null,
          moisturePercent:
            dto.moisturePercent !== undefined
              ? dto.moisturePercent.toFixed(2)
              : null,
          cropYear: dto.cropYear ?? null,
          region: dto.region ?? null,
          woreda: dto.woreda ?? null,
          kebele: dto.kebele ?? null,
          variety: dto.variety ?? null,
          notes: dto.notes ?? null,
          status: DocumentStatus.ACTIVE,
          createdById: userId ?? null,
        }),
      );

      return ticket.id;
    });

    const ticket = await this.findOne(ticketId);
    await this.notifications.onPurchaseRecorded({
      purchaseId: ticket.purchaseId!,
      total: ticket.totalAmount,
      actorUserId: userId,
      creditDueDate: dto.creditDueDate ?? null,
    });

    return ticket;
  }

  private async resolveCherryItem(itemId?: string): Promise<Item> {
    if (itemId) {
      const item = await this.itemRepo.findOne({ where: { id: itemId } });
      if (!item) throw new BadRequestException('Item not found');
      return item;
    }
    let item = await this.itemRepo.findOne({ where: { sku: CHERRY_SKU } });
    if (!item) {
      item = await this.itemRepo.save(
        this.itemRepo.create({
          sku: CHERRY_SKU,
          description: 'Coffee cherry',
          unit: 'kg',
          itemType: ItemType.RAW,
        }),
      );
    }
    return item;
  }
}
