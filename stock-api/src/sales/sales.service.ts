import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  BankTransactionType,
  CommissionBasis,
  CreditStatus,
  DEFAULT_COMMISSION_PERCENT,
  CoffeeForm,
  DocumentStatus,
  LotEventType,
  LotStatus,
  PaymentMethod,
  SaleChannel,
  StockMovementSourceType,
} from '../common/enums';
import { computeCommissionAmount } from '../common/utils/commission.util';
import { isSellableStock } from '../common/utils/sale-stock.util';
import {
  applyDateRangeToQb,
  applyRelatedIlikeSearch,
  paginatedQueryBuilder,
  sumFilteredQueryBuilder,
} from '../common/utils/query.util';
import { SalesListQueryDto } from './dto/sales-list-query.dto';
import { BankLedgerService } from '../banks/bank-ledger.service';
import { BanksService } from '../banks/banks.service';
import { CustomerCredit } from '../database/entities/customer-credit.entity';
import { Item } from '../database/entities/item.entity';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { SaleLine } from '../database/entities/sale-line.entity';
import { SaleReturnLine } from '../database/entities/sale-return-line.entity';
import { SaleReturn } from '../database/entities/sale-return.entity';
import { Sale } from '../database/entities/sale.entity';
import { User } from '../database/entities/user.entity';
import { StockService } from '../inventory/stock.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  LowStockService,
  StockQuantityChange,
} from '../notifications/low-stock.service';
import { CommissionSummaryQueryDto } from './dto/commission-summary-query.dto';
import { CreateSaleDto, SaleLineDto } from './dto/sale.dto';
import { CreateSaleReturnDto } from './dto/sale-return.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { CreditsService } from '../credits/credits.service';

type SaleCommissionLineInput = Pick<
  SaleLine,
  'quantity' | 'lineTotal' | 'purchaseCost' | 'unitPrice'
>;

type SaleLineDraft = Pick<
  SaleLine,
  'itemId' | 'quantity' | 'unitPrice' | 'purchaseCost' | 'lineTotal'
> & { lotId?: string | null };

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
    private readonly bankLedger: BankLedgerService,
    private readonly banksService: BanksService,
    private readonly notifications: NotificationsService,
    private readonly lowStockService: LowStockService,
    private readonly creditsService: CreditsService,
  ) {}

  async findAll(query: SalesListQueryDto) {
    const filteredQb = this.buildSalesFilterQb(query);
    const [totals, page] = await Promise.all([
      sumFilteredQueryBuilder(filteredQb, [
        { key: 'subtotal', sql: 'COALESCE(SUM(sale.subtotal::numeric), 0)' },
        { key: 'total', sql: 'COALESCE(SUM(sale.total::numeric), 0)' },
        {
          key: 'commission',
          sql: 'COALESCE(SUM(sale.commission_amount::numeric), 0)',
        },
      ]),
      paginatedQueryBuilder(
        filteredQb
          .clone()
          .leftJoinAndSelect('sale.customer', 'customer')
          .leftJoinAndSelect('sale.location', 'location')
          .leftJoinAndSelect('sale.lines', 'lines')
          .leftJoinAndSelect('lines.item', 'item')
          .leftJoinAndSelect('lines.lot', 'lot')
          .leftJoinAndSelect('sale.credit', 'credit')
          .leftJoinAndSelect('sale.soldByUser', 'soldByUser')
          .orderBy('sale.created_at', 'DESC'),
        query.page,
        query.limit,
      ),
    ]);

    return { ...page, totals };
  }

  private buildSalesFilterQb(query: SalesListQueryDto) {
    const includeVoided = query.includeVoided === 'true';
    const qb = this.saleRepo.createQueryBuilder('sale');

    if (!includeVoided) {
      qb.andWhere('sale.status = :status', { status: DocumentStatus.ACTIVE });
    }
    if (query.soldByUserId) {
      qb.andWhere('sale.sold_by_user_id = :soldByUserId', {
        soldByUserId: query.soldByUserId,
      });
    }
    if (query.customerId) {
      qb.andWhere('sale.customer_id = :customerId', {
        customerId: query.customerId,
      });
    }
    if (query.locationId) {
      qb.andWhere('sale.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.paymentMethod) {
      qb.andWhere('sale.paymentMethod = :paymentMethod', {
        paymentMethod: query.paymentMethod,
      });
    }
    if (query.channel) {
      qb.andWhere('sale.channel = :channel', { channel: query.channel });
    }
    applyRelatedIlikeSearch(qb, query.search, ['sale.notes'], {
      table: 'customers',
      alias: 'customer_filter',
      parentKey: 'sale.customer_id',
      relatedKey: 'id',
      columns: ['name', 'phone'],
    });
    applyDateRangeToQb(qb, 'sale.created_at', query.from, query.to);

    return qb;
  }

  async findOne(id: string) {
    const sale = await this.saleRepo.findOne({
      where: { id },
      relations: {
        customer: true,
        location: true,
        lines: { item: true, lot: true },
        credit: true,
        soldByUser: true,
        bankAccount: true,
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    const total = parseFloat(sale.total);
    const paid = parseFloat(sale.paidAmount ?? '0');
    const creditBalance = sale.credit
      ? parseFloat(sale.credit.balance)
      : Math.max(0, total - paid);
    const outstanding =
      sale.paymentMethod === PaymentMethod.CREDIT ? creditBalance : 0;
    return {
      ...sale,
      outstandingAmount: outstanding.toFixed(2),
    };
  }

  async commissionSummary(query: CommissionSummaryQueryDto) {
    const qb = this.saleRepo
      .createQueryBuilder('sale')
      .leftJoin('sale.soldByUser', 'rep')
      .select('sale.sold_by_user_id', 'soldByUserId')
      .addSelect('rep.full_name', 'soldByUserName')
      .addSelect('COUNT(sale.id)', 'saleCount')
      .addSelect('COALESCE(SUM(sale.subtotal), 0)', 'totalSubtotal')
      .addSelect('COALESCE(SUM(sale.commission_amount), 0)', 'totalCommission')
      .where('sale.status = :status', { status: DocumentStatus.ACTIVE })
      .groupBy('sale.sold_by_user_id')
      .addGroupBy('rep.full_name')
      .orderBy('SUM(sale.commission_amount)', 'DESC');

    applyDateRangeToQb(qb, 'sale.created_at', query.from, query.to);

    if (query.soldByUserId) {
      qb.andWhere('sale.sold_by_user_id = :soldByUserId', {
        soldByUserId: query.soldByUserId,
      });
    }

    const rows = await qb.getRawMany<{
      soldByUserId: string | null;
      soldByUserName: string | null;
      saleCount: string;
      totalSubtotal: string;
      totalCommission: string;
    }>();

    return rows.map((row) => ({
      soldByUserId: row.soldByUserId,
      soldByUserName: row.soldByUserName,
      saleCount: parseInt(row.saleCount, 10),
      totalSubtotal: parseFloat(row.totalSubtotal).toFixed(2),
      totalCommission: parseFloat(row.totalCommission).toFixed(2),
    }));
  }

  private readonly structuralUpdateKeys: (keyof UpdateSaleDto)[] = [
    'customerId',
    'locationId',
    'paymentMethod',
    'bankAccountId',
    'allowNegativeStock',
    'creditDueDate',
    'lines',
  ];

  private isMetadataOnlyUpdate(dto: UpdateSaleDto): boolean {
    const keys = (Object.keys(dto) as (keyof UpdateSaleDto)[]).filter(
      (k) => dto[k] !== undefined,
    );
    return (
      keys.length > 0 &&
      !keys.some((k) => this.structuralUpdateKeys.includes(k))
    );
  }

  private lineProfit(lines: SaleCommissionLineInput[]): number {
    return lines.reduce((total, line) => {
      const qty = parseFloat(line.quantity);
      const purchaseCost = parseFloat(line.purchaseCost);
      const revenue = parseFloat(line.lineTotal);
      return total + revenue - qty * purchaseCost;
    }, 0);
  }

  private commissionFields(
    subtotal: number,
    lines: SaleCommissionLineInput[],
    opts: {
      commissionPercent?: number;
      existingPercent?: string;
      commissionBasis?: CommissionBasis;
      existingBasis?: CommissionBasis;
    },
  ) {
    const pct =
      opts.commissionPercent ??
      (opts.existingPercent !== undefined
        ? parseFloat(opts.existingPercent)
        : DEFAULT_COMMISSION_PERCENT);
    const basis: CommissionBasis =
      opts.commissionBasis ?? opts.existingBasis ?? CommissionBasis.PROFIT;
    const profit: number = this.lineProfit(lines);
    return {
      commissionPercent: pct.toFixed(2),
      commissionBasis: basis,
      commissionAmount: computeCommissionAmount(basis, subtotal, profit, pct),
    };
  }

  private async resolveSoldByUserId(
    requested: string | undefined,
    actorId: string | undefined,
    canOnBehalf: boolean,
    manager?: EntityManager,
  ): Promise<string | null> {
    const userRepo = manager ? manager.getRepository(User) : this.userRepo;
    const targetId = requested ?? actorId ?? null;
    if (!targetId) return null;

    if (requested && requested !== actorId && !canOnBehalf) {
      throw new ForbiddenException(
        'sales.on_behalf permission required to sell for another user',
      );
    }

    const user = await userRepo.findOne({
      where: { id: targetId, isActive: true },
    });
    if (!user) {
      throw new BadRequestException('Sold-by user not found or inactive');
    }
    return targetId;
  }

  private resolveLines(sale: Sale, dto: UpdateSaleDto): SaleLineDto[] {
    if (dto.lines) return dto.lines;
    return sale.lines.map((l) => ({
      itemId: l.itemId,
      quantity: parseFloat(l.quantity),
      unitPrice: parseFloat(l.unitPrice),
    }));
  }

  /** Processed/finished coffee and reject lots. Raw purchased coffee is refused. */
  private async assertSellableSaleLine(
    manager: EntityManager,
    line: { itemId: string; lotId?: string | null },
  ) {
    const item = await manager.getRepository(Item).findOne({
      where: { id: line.itemId },
    });
    if (!item) {
      throw new BadRequestException(`Item not found: ${line.itemId}`);
    }

    let lot: Lot | null = null;
    if (line.lotId) {
      lot = await manager.getRepository(Lot).findOne({
        where: { id: line.lotId },
      });
      if (!lot) throw new BadRequestException('Lot not found');
      const rejectOnHold =
        lot.status === LotStatus.HOLD && lot.form === CoffeeForm.REJECT;
      if (lot.status !== LotStatus.ACTIVE && !rejectOnHold) {
        throw new BadRequestException(`Lot ${lot.code} is not available for sale`);
      }
      if (lot.itemId && lot.itemId !== line.itemId) {
        throw new BadRequestException(
          `Lot ${lot.code} does not match sale line item`,
        );
      }
    } else if (this.stockService.isCoffeeItem(item)) {
      throw new BadRequestException(
        `Coffee item ${item.sku ?? item.description} requires lotId on sale line`,
      );
    }

    if (
      !isSellableStock({
        sku: item.sku,
        itemType: item.itemType,
        lotCode: lot?.code,
        form: lot?.form,
        processMethod: lot?.processMethod,
      })
    ) {
      const name = lot?.code ?? item.description ?? item.sku;
      throw new BadRequestException(
        `${name} is unprocessed coffee and cannot be sold. Select processed coffee or reject stock.`,
      );
    }
  }

  private paysViaBank(method: PaymentMethod): boolean {
    return method === PaymentMethod.BANK || method === PaymentMethod.CASH;
  }

  async update(
    id: string,
    dto: UpdateSaleDto,
    userId?: string,
    canNegativeStock = false,
    canOnBehalf = false,
  ) {
    if (this.isMetadataOnlyUpdate(dto)) {
      const sale = await this.findOne(id);
      if (sale.status === DocumentStatus.VOIDED) {
        throw new BadRequestException('Cannot update a voided sale');
      }
      if (sale.credit) {
        const paid = parseFloat(sale.credit.paidAmount);
        if (paid > 0) {
          const keys = (Object.keys(dto) as (keyof UpdateSaleDto)[]).filter(
            (k) => dto[k] !== undefined,
          );
          if (keys.some((k) => k !== 'notes')) {
            throw new BadRequestException(
              'Cannot change sale after customer credit payments; only notes may be updated',
            );
          }
        }
      }

      if (dto.notes !== undefined) {
        sale.notes = dto.notes ?? null;
      }

      const subtotal = parseFloat(sale.subtotal);
      if (
        dto.soldByUserId !== undefined ||
        dto.commissionPercent !== undefined ||
        dto.commissionBasis !== undefined
      ) {
        sale.soldByUserId = await this.resolveSoldByUserId(
          dto.soldByUserId ?? sale.soldByUserId ?? undefined,
          userId,
          canOnBehalf,
        );
        const commission = this.commissionFields(subtotal, sale.lines, {
          commissionPercent: dto.commissionPercent,
          existingPercent: sale.commissionPercent,
          commissionBasis: dto.commissionBasis,
          existingBasis: sale.commissionBasis,
        });
        sale.commissionPercent = commission.commissionPercent;
        sale.commissionBasis = commission.commissionBasis;
        sale.commissionAmount = commission.commissionAmount;
      }

      await this.saleRepo.save(sale);
      return this.findOne(id);
    }

    const hasFields = (Object.keys(dto) as (keyof UpdateSaleDto)[]).some(
      (k) => dto[k] !== undefined,
    );
    if (!hasFields) return this.findOne(id);

    const allowNegative =
      dto.allowNegativeStock !== undefined
        ? dto.allowNegativeStock === true
        : undefined;

    if (allowNegative === true && !canNegativeStock) {
      throw new ForbiddenException(
        'sales.negative_stock permission required for negative stock sales',
      );
    }

    let stockWarnings: string[] = [];
    const stockChanges: StockQuantityChange[] = [];

    await this.dataSource.transaction(async (manager) => {
      const saleRepo = manager.getRepository(Sale);
      const lineRepo = manager.getRepository(SaleLine);
      const creditRepo = manager.getRepository(CustomerCredit);

      const sale = await saleRepo.findOne({
        where: { id },
        relations: { lines: true, credit: true },
      });
      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status === DocumentStatus.VOIDED) {
        throw new BadRequestException('Cannot update a voided sale');
      }

      if (sale.credit) {
        const paid = parseFloat(sale.credit.paidAmount);
        if (paid > 0) {
          throw new BadRequestException(
            'Cannot change sale after customer credit payments; only notes may be updated',
          );
        }
      }

      const customerId =
        dto.customerId !== undefined ? dto.customerId : sale.customerId;
      const locationId = dto.locationId ?? sale.locationId;
      const paymentMethod = dto.paymentMethod ?? sale.paymentMethod;
      const bankAccountId =
        dto.bankAccountId !== undefined
          ? dto.bankAccountId
          : sale.bankAccountId;
      const allowNeg =
        allowNegative !== undefined ? allowNegative : sale.allowNegativeStock;
      const notes = dto.notes !== undefined ? (dto.notes ?? null) : sale.notes;
      const creditDueDate =
        dto.creditDueDate !== undefined
          ? dto.creditDueDate
          : (sale.credit?.dueDate ?? undefined);
      const lines = this.resolveLines(sale, dto);

      if (this.paysViaBank(paymentMethod) && !bankAccountId) {
        throw new BadRequestException(
          'bankAccountId required for BANK and CASH payments',
        );
      }
      if (paymentMethod === PaymentMethod.CREDIT && !customerId) {
        throw new BadRequestException('customerId required for credit sales');
      }
      if (this.paysViaBank(paymentMethod) && bankAccountId) {
        await this.banksService.assertPaymentAccount(
          paymentMethod,
          bankAccountId,
          manager,
        );
      }

      const subtotal = lines.reduce(
        (sum, l) => sum + l.quantity * l.unitPrice,
        0,
      );

      if (paymentMethod === PaymentMethod.CREDIT && customerId) {
        await this.creditsService.assertCustomerWithinLimit(
          customerId,
          subtotal,
          { excludeCreditId: sale.credit?.id },
        );
      }

      const oldLocationId = sale.locationId;
      const oldPaymentMethod = sale.paymentMethod;
      const oldBankAccountId = sale.bankAccountId;

      for (const line of sale.lines) {
        await this.stockService.adjust(
          {
            locationId: oldLocationId,
            itemId: line.itemId,
            quantityDelta: parseFloat(line.quantity),
          },
          manager,
        );
      }

      for (const line of lines) {
        await this.assertSellableSaleLine(manager, line);
      }

      stockWarnings = await this.stockService.checkAvailability(
        locationId,
        lines,
        allowNeg,
        manager,
      );

      if (this.paysViaBank(oldPaymentMethod) && oldBankAccountId) {
        await this.bankLedger.reverseByReference(
          'sale',
          sale.id,
          `Adjust sale ${sale.id}`,
          userId,
          manager,
        );
      }

      if (sale.credit) {
        await creditRepo.remove(sale.credit);
      }

      await lineRepo.delete({ saleId: sale.id });

      const saleLines: SaleLineDraft[] = [];
      for (const line of lines) {
        const stock = await this.stockService.getStock(
          locationId,
          line.itemId,
          manager,
        );
        const purchaseCost = stock ? parseFloat(stock.purchasePrice) : 0;
        const lineTotal = line.quantity * line.unitPrice;
        saleLines.push({
          itemId: line.itemId,
          lotId: line.lotId ?? null,
          quantity: line.quantity.toFixed(3),
          unitPrice: line.unitPrice.toFixed(2),
          purchaseCost: purchaseCost.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
        });
      }

      sale.customerId = customerId ?? null;
      sale.locationId = locationId;
      sale.paymentMethod = paymentMethod;
      sale.bankAccountId = bankAccountId ?? null;
      sale.allowNegativeStock = allowNeg;
      sale.subtotal = subtotal.toFixed(2);
      sale.total = subtotal.toFixed(2);
      sale.notes = notes;
      sale.stockWarnings = stockWarnings.length ? stockWarnings : null;
      sale.lines = saleLines.map((l) => Object.assign(new SaleLine(), l));
      sale.soldByUserId = await this.resolveSoldByUserId(
        dto.soldByUserId ?? sale.soldByUserId ?? undefined,
        userId,
        canOnBehalf,
        manager,
      );
      const commission = this.commissionFields(subtotal, saleLines, {
        commissionPercent: dto.commissionPercent,
        existingPercent: sale.commissionPercent,
        commissionBasis: dto.commissionBasis,
        existingBasis: sale.commissionBasis,
      });
      sale.commissionPercent = commission.commissionPercent;
      sale.commissionBasis = commission.commissionBasis;
      sale.commissionAmount = commission.commissionAmount;

      await saleRepo.save(sale);

      for (const line of lines) {
        const previousQuantity = await this.stockService.getQuantity(
          locationId,
          line.itemId,
          manager,
        );
        await this.stockService.adjust(
          {
            locationId,
            itemId: line.itemId,
            quantityDelta: -line.quantity,
          },
          manager,
        );
        stockChanges.push({
          locationId,
          itemId: line.itemId,
          previousQuantity,
        });
      }

      if (this.paysViaBank(paymentMethod) && bankAccountId) {
        await this.bankLedger.recordTransaction(
          {
            bankAccountId,
            type: BankTransactionType.SALE,
            amount: subtotal,
            direction: 'in',
            description: `Sale ${sale.id}`,
            refType: 'sale',
            refId: sale.id,
            createdById: userId,
          },
          manager,
        );
      }

      if (paymentMethod === PaymentMethod.CREDIT && customerId) {
        await creditRepo.save(
          creditRepo.create({
            customerId,
            saleId: sale.id,
            amount: subtotal.toFixed(2),
            paidAmount: '0',
            balance: subtotal.toFixed(2),
            status: CreditStatus.OPEN,
            dueDate: creditDueDate ?? null,
          }),
        );
      }
    });

    const sale = await this.findOne(id);
    await this.lowStockService.evaluateChanges(stockChanges);
    await this.notifications.onSaleRecorded({
      saleId: id,
      total: sale.total,
      actorUserId: userId,
      soldByUserId: sale.soldByUserId,
      stockWarnings: stockWarnings.length ? stockWarnings : undefined,
      creditDueDate: sale.credit?.dueDate ?? null,
    });
    if (stockWarnings.length) {
      return { ...sale, stockWarnings };
    }
    return sale;
  }

  async void(id: string, userId?: string) {
    await this.dataSource.transaction(async (manager) => {
      const saleRepo = manager.getRepository(Sale);
      const creditRepo = manager.getRepository(CustomerCredit);

      const sale = await saleRepo.findOne({
        where: { id },
        relations: { lines: true, credit: true },
      });
      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status === DocumentStatus.VOIDED) {
        throw new BadRequestException('Sale already voided');
      }

      if (sale.credit) {
        const paid = parseFloat(sale.credit.paidAmount);
        if (paid > 0) {
          throw new BadRequestException(
            'Cannot void sale with customer credit payments applied',
          );
        }
        await creditRepo.remove(sale.credit);
      }

      for (const line of sale.lines) {
        await this.stockService.adjust(
          {
            locationId: sale.locationId,
            itemId: line.itemId,
            quantityDelta: parseFloat(line.quantity),
          },
          manager,
        );
      }

      const paysViaBank =
        sale.paymentMethod === PaymentMethod.BANK ||
        sale.paymentMethod === PaymentMethod.CASH;
      if (paysViaBank && sale.bankAccountId) {
        await this.bankLedger.reverseByReference(
          'sale',
          sale.id,
          `Void sale ${sale.id}`,
          userId,
          manager,
        );
      }

      sale.status = DocumentStatus.VOIDED;
      sale.voidedAt = new Date();
      await saleRepo.save(sale);
    });

    return this.findOne(id);
  }

  async create(
    dto: CreateSaleDto,
    userId?: string,
    canNegativeStock = false,
    canOnBehalf = false,
  ) {
    const allowNegative = dto.allowNegativeStock === true;
    if (allowNegative && !canNegativeStock) {
      throw new ForbiddenException(
        'sales.negative_stock permission required for negative stock sales',
      );
    }

    const paysViaBank =
      dto.paymentMethod === PaymentMethod.BANK ||
      dto.paymentMethod === PaymentMethod.CASH;
    if (paysViaBank && !dto.bankAccountId) {
      throw new BadRequestException(
        'bankAccountId required for BANK and CASH payments',
      );
    }
    if (dto.paymentMethod === PaymentMethod.CREDIT && !dto.customerId) {
      throw new BadRequestException('customerId required for credit sales');
    }

    const stockChanges: StockQuantityChange[] = [];

    // Pre-calc subtotal for credit-limit check
    const estimatedTotal = dto.lines.reduce(
      (sum, l) => sum + l.quantity * l.unitPrice,
      0,
    );
    if (dto.paymentMethod === PaymentMethod.CREDIT && dto.customerId) {
      await this.creditsService.assertCustomerWithinLimit(
        dto.customerId,
        estimatedTotal,
      );
    }

    const result = await this.dataSource.transaction(async (manager) => {
      if (paysViaBank && dto.bankAccountId) {
        await this.banksService.assertPaymentAccount(
          dto.paymentMethod,
          dto.bankAccountId,
          manager,
        );
      }

      const saleRepo = manager.getRepository(Sale);
      const creditRepo = manager.getRepository(CustomerCredit);

      for (const line of dto.lines) {
        await this.assertSellableSaleLine(manager, line);
      }

      const stockWarnings = await this.stockService.checkAvailability(
        dto.locationId,
        dto.lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          lotId: l.lotId ?? null,
        })),
        allowNegative,
        manager,
      );

      const saleLines: SaleLineDraft[] = [];
      let subtotal = 0;
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);
      const channel = dto.channel ?? SaleChannel.LOCAL;

      for (const line of dto.lines) {
        const stock = await this.stockService.getStock(
          dto.locationId,
          line.itemId,
          manager,
          line.lotId ?? null,
        );
        const purchaseCost = stock ? parseFloat(stock.purchasePrice) : 0;
        const lineTotal = line.quantity * line.unitPrice;
        subtotal += lineTotal;
        saleLines.push({
          itemId: line.itemId,
          lotId: line.lotId ?? null,
          quantity: line.quantity.toFixed(3),
          unitPrice: line.unitPrice.toFixed(2),
          purchaseCost: purchaseCost.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
        });
      }

      const soldByUserId = await this.resolveSoldByUserId(
        dto.soldByUserId,
        userId,
        canOnBehalf,
        manager,
      );
      const commission = this.commissionFields(subtotal, saleLines, {
        commissionPercent: dto.commissionPercent,
        commissionBasis: dto.commissionBasis,
      });

      const sale = await saleRepo.save(
        saleRepo.create({
          invoiceNumber: `INV-${new Date().getFullYear()}-${String((await saleRepo.count()) + 1).padStart(5, '0')}`,
          customerId: dto.customerId ?? null,
          locationId: dto.locationId,
          channel,
          currencyCode: (dto.currencyCode ?? 'ETB').toUpperCase(),
          fxRate: dto.fxRate !== undefined ? dto.fxRate.toFixed(6) : null,
          exportContractId: dto.exportContractId ?? null,
          paymentMethod: dto.paymentMethod,
          bankAccountId: dto.bankAccountId ?? null,
          allowNegativeStock: allowNegative,
          subtotal: subtotal.toFixed(2),
          total: subtotal.toFixed(2),
          paidAmount:
            dto.paymentMethod === PaymentMethod.CREDIT
              ? '0.00'
              : subtotal.toFixed(2),
          notes: dto.notes ?? null,
          stockWarnings: stockWarnings.length ? stockWarnings : null,
          status: DocumentStatus.ACTIVE,
          createdById: userId ?? null,
          soldByUserId,
          commissionPercent: commission.commissionPercent,
          commissionBasis: commission.commissionBasis,
          commissionAmount: commission.commissionAmount,
          lines: saleLines.map((l) => Object.assign(new SaleLine(), l)),
        }),
      );

      for (const line of dto.lines) {
        const lotId = line.lotId ?? null;
        const previousQuantity = await this.stockService.getQuantity(
          dto.locationId,
          line.itemId,
          manager,
          lotId,
        );
        await this.stockService.adjust(
          {
            locationId: dto.locationId,
            itemId: line.itemId,
            quantityDelta: -line.quantity,
            lotId,
            meta: {
              sourceType:
                channel === SaleChannel.LOCAL
                  ? StockMovementSourceType.SALE_LOCAL
                  : StockMovementSourceType.SALE_EXPORT,
              referenceType: 'sale',
              referenceId: sale.id,
              reference: sale.invoiceNumber ?? sale.id.slice(0, 8),
              createdById: userId ?? null,
              notes: `Sale ${sale.invoiceNumber ?? sale.id.slice(0, 8)}`,
            },
          },
          manager,
        );
        if (lotId) {
          const lot = await lotRepo.findOne({ where: { id: lotId } });
          if (lot) {
            const nextQty = Math.max(
              0,
              parseFloat(lot.quantity) - line.quantity,
            );
            lot.quantity = nextQty.toFixed(3);
            await lotRepo.save(lot);
            const eventType =
              channel === SaleChannel.LOCAL
                ? LotEventType.SOLD_LOCAL
                : LotEventType.SHIPPED;
            await eventRepo.save(
              eventRepo.create({
                lotId,
                eventType,
                quantity: line.quantity.toFixed(3),
                fromLocationId: dto.locationId,
                notes: `Sale ${sale.id.slice(0, 8)} · ${channel}`,
                createdById: userId ?? null,
                metadata: { saleId: sale.id, channel },
              }),
            );
          }
        }
        stockChanges.push({
          locationId: dto.locationId,
          itemId: line.itemId,
          previousQuantity,
          lotId,
        });
      }

      if (paysViaBank && dto.bankAccountId) {
        await this.bankLedger.recordTransaction(
          {
            bankAccountId: dto.bankAccountId,
            type: BankTransactionType.SALE,
            amount: subtotal,
            direction: 'in',
            description: `Sale ${sale.id}`,
            refType: 'sale',
            refId: sale.id,
            createdById: userId,
          },
          manager,
        );
      }

      if (dto.paymentMethod === PaymentMethod.CREDIT && dto.customerId) {
        await creditRepo.save(
          creditRepo.create({
            customerId: dto.customerId,
            saleId: sale.id,
            amount: subtotal.toFixed(2),
            paidAmount: '0',
            balance: subtotal.toFixed(2),
            status: CreditStatus.OPEN,
            dueDate: dto.creditDueDate ?? null,
          }),
        );
      }

      return {
        saleId: sale.id,
        stockWarnings,
        soldByUserId,
        subtotal: subtotal.toFixed(2),
        creditDueDate: dto.creditDueDate ?? null,
      };
    });

    const sale = await this.findOne(result.saleId);
    await this.lowStockService.evaluateChanges(stockChanges);
    await this.notifications.onSaleRecorded({
      saleId: result.saleId,
      total: result.subtotal,
      actorUserId: userId,
      soldByUserId: result.soldByUserId,
      stockWarnings: result.stockWarnings,
      creditDueDate: result.creditDueDate,
    });

    return {
      ...sale,
      stockWarnings: result.stockWarnings,
    };
  }

  async createReturn(saleId: string, dto: CreateSaleReturnDto, userId?: string) {
    const sale = await this.findOne(saleId);
    if (sale.status === DocumentStatus.VOIDED) {
      throw new BadRequestException('Cannot return a voided sale');
    }
    if (sale.channel !== SaleChannel.LOCAL) {
      throw new BadRequestException('Sales returns are for local sales only');
    }

    const paysViaBank =
      dto.refundMethod === PaymentMethod.BANK ||
      dto.refundMethod === PaymentMethod.CASH;
    if (paysViaBank && !dto.bankAccountId) {
      throw new BadRequestException(
        'bankAccountId required for BANK and CASH refunds',
      );
    }

    const returnId = await this.dataSource.transaction(async (manager) => {
      if (paysViaBank && dto.bankAccountId) {
        await this.banksService.assertPaymentAccount(
          dto.refundMethod,
          dto.bankAccountId,
          manager,
        );
      }

      const returnRepo = manager.getRepository(SaleReturn);
      const lineRepo = manager.getRepository(SaleReturnLine);
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);
      const creditRepo = manager.getRepository(CustomerCredit);
      const saleRepo = manager.getRepository(Sale);

      let total = 0;
      const lineDrafts: Array<{
        saleLineId: string | null;
        itemId: string;
        lotId: string | null;
        quantity: string;
        unitPrice: string;
        lineTotal: string;
      }> = [];

      for (const line of dto.lines) {
        const lineTotal = line.quantity * line.unitPrice;
        total += lineTotal;
        lineDrafts.push({
          saleLineId: line.saleLineId ?? null,
          itemId: line.itemId,
          lotId: line.lotId ?? null,
          quantity: line.quantity.toFixed(3),
          unitPrice: line.unitPrice.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
        });
      }

      const returnNumber = `SR-${new Date().getFullYear()}-${String((await returnRepo.count()) + 1).padStart(5, '0')}`;
      const saleReturn = await returnRepo.save(
        returnRepo.create({
          returnNumber,
          saleId: sale.id,
          locationId: sale.locationId,
          totalAmount: total.toFixed(2),
          refundMethod: dto.refundMethod,
          bankAccountId: dto.bankAccountId ?? null,
          notes: dto.notes ?? null,
          status: 'ACTIVE',
          createdById: userId ?? null,
        }),
      );

      for (const draft of lineDrafts) {
        await lineRepo.save(
          lineRepo.create({
            saleReturnId: saleReturn.id,
            ...draft,
          }),
        );
        await this.stockService.adjust(
          {
            locationId: sale.locationId,
            itemId: draft.itemId,
            quantityDelta: parseFloat(draft.quantity),
            lotId: draft.lotId,
            meta: {
              sourceType: StockMovementSourceType.SALE_RETURN,
              referenceType: 'sale_return',
              referenceId: saleReturn.id,
              reference: returnNumber,
              createdById: userId ?? null,
              notes: `Return against ${sale.invoiceNumber ?? sale.id.slice(0, 8)}`,
            },
          },
          manager,
        );
        if (draft.lotId) {
          const lot = await lotRepo.findOne({ where: { id: draft.lotId } });
          if (lot) {
            lot.quantity = (
              parseFloat(lot.quantity) + parseFloat(draft.quantity)
            ).toFixed(3);
            if (lot.status === LotStatus.VOIDED) {
              lot.status = LotStatus.ACTIVE;
            }
            await lotRepo.save(lot);
            await eventRepo.save(
              eventRepo.create({
                lotId: lot.id,
                eventType: LotEventType.SALE_RETURNED,
                quantity: draft.quantity,
                toLocationId: sale.locationId,
                notes: `Sale return ${returnNumber}`,
                createdById: userId ?? null,
                metadata: {
                  saleId: sale.id,
                  saleReturnId: saleReturn.id,
                },
              }),
            );
          }
        }
      }

      if (paysViaBank && dto.bankAccountId) {
        await this.bankLedger.recordTransaction(
          {
            bankAccountId: dto.bankAccountId,
            type: BankTransactionType.ADJUSTMENT,
            amount: total,
            direction: 'out',
            description: `Sale return ${returnNumber}`,
            refType: 'sale_return',
            refId: saleReturn.id,
            createdById: userId,
          },
          manager,
        );
        const paid = Math.max(0, parseFloat(sale.paidAmount) - total);
        sale.paidAmount = paid.toFixed(2);
        await saleRepo.save(sale);
      } else if (
        dto.refundMethod === PaymentMethod.CREDIT &&
        sale.customerId
      ) {
        const credit = await creditRepo.findOne({
          where: { saleId: sale.id },
        });
        if (credit) {
          const newBalance = Math.max(
            0,
            parseFloat(credit.balance) - total,
          );
          const newAmount = Math.max(0, parseFloat(credit.amount) - total);
          credit.amount = newAmount.toFixed(2);
          credit.balance = newBalance.toFixed(2);
          credit.status =
            newBalance <= 0.001
              ? CreditStatus.PAID
              : parseFloat(credit.paidAmount) > 0
                ? CreditStatus.PARTIAL
                : CreditStatus.OPEN;
          await creditRepo.save(credit);
        }
      }

      return saleReturn.id;
    });

    return managerFindReturn(this.dataSource, returnId);
  }
}

async function managerFindReturn(ds: DataSource, id: string) {
  return ds.getRepository(SaleReturn).findOne({
    where: { id },
    relations: {
      lines: { item: true, lot: true },
      sale: true,
      location: true,
      bankAccount: true,
      createdBy: true,
    },
  });
}
