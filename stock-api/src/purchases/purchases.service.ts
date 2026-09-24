import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  BankTransactionType,
  CreditStatus,
  DocumentStatus,
  PaymentMethod,
  StockMovementSourceType,
} from '../common/enums';
import {
  applyDateRangeToQb,
  applyRelatedIlikeSearch,
  paginatedQueryBuilder,
  sumFilteredQueryBuilder,
} from '../common/utils/query.util';
import { PurchaseListQueryDto } from './dto/purchase-list-query.dto';
import { BankLedgerService } from '../banks/bank-ledger.service';
import { BanksService } from '../banks/banks.service';
import { BankTransaction } from '../database/entities/bank-transaction.entity';
import { PurchaseLine } from '../database/entities/purchase-line.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { SupplierCredit } from '../database/entities/supplier-credit.entity';
import { StockService } from '../inventory/stock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePurchaseDto, PurchaseLineDto } from './dto/purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { CreditsService } from '../credits/credits.service';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
    private readonly bankLedger: BankLedgerService,
    private readonly banksService: BanksService,
    private readonly notifications: NotificationsService,
    private readonly creditsService: CreditsService,
  ) {}

  async findAll(query: PurchaseListQueryDto) {
    const filteredQb = this.buildPurchaseFilterQb(query);
    const [totals, page] = await Promise.all([
      sumFilteredQueryBuilder(filteredQb, [
        {
          key: 'subtotal',
          sql: 'COALESCE(SUM(purchase.subtotal::numeric), 0)',
        },
        { key: 'total', sql: 'COALESCE(SUM(purchase.total::numeric), 0)' },
        {
          key: 'paidAmount',
          sql: 'COALESCE(SUM(purchase.paid_amount::numeric), 0)',
        },
      ]),
      paginatedQueryBuilder(
        filteredQb
          .clone()
          .leftJoinAndSelect('purchase.supplier', 'supplier')
          .leftJoinAndSelect('purchase.location', 'location')
          .leftJoinAndSelect('purchase.lines', 'lines')
          .leftJoinAndSelect('lines.item', 'item')
          .leftJoinAndSelect('purchase.credit', 'credit')
          .leftJoinAndSelect('purchase.bankAccount', 'bankAccount')
          .orderBy('purchase.created_at', 'DESC'),
        query.page,
        query.limit,
      ),
    ]);

    return {
      ...page,
      data: page.data.map((p) => this.serializeListRow(p)),
      totals,
    };
  }

  private buildPurchaseFilterQb(query: PurchaseListQueryDto) {
    const includeVoided = query.includeVoided === 'true';
    const qb = this.purchaseRepo.createQueryBuilder('purchase');

    if (!includeVoided) {
      qb.andWhere('purchase.status = :status', {
        status: DocumentStatus.ACTIVE,
      });
    }
    if (query.supplierId) {
      qb.andWhere('purchase.supplier_id = :supplierId', {
        supplierId: query.supplierId,
      });
    }
    if (query.locationId) {
      qb.andWhere('purchase.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.paymentMethod) {
      qb.andWhere('purchase.paymentMethod = :paymentMethod', {
        paymentMethod: query.paymentMethod,
      });
    }
    applyRelatedIlikeSearch(qb, query.search, ['purchase.notes'], {
      table: 'suppliers',
      alias: 'supplier_filter',
      parentKey: 'purchase.supplier_id',
      relatedKey: 'id',
      columns: ['name', 'phone'],
    });
    applyDateRangeToQb(qb, 'purchase.created_at', query.from, query.to);

    return qb;
  }

  async findOne(id: string) {
    const purchase = await this.purchaseRepo.findOne({
      where: { id },
      relations: {
        supplier: true,
        location: true,
        lines: { item: true },
        credit: true,
        bankAccount: true,
      },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    const hasCreditPayments = purchase.credit
      ? await this.hasSubsequentCreditPayments(purchase.credit.id)
      : false;
    return this.serialize(purchase, hasCreditPayments);
  }

  private serializeListRow(purchase: Purchase) {
    const total = parseFloat(purchase.total);
    const paid = parseFloat(purchase.paidAmount ?? '0');
    const outstanding = this.outstandingFor(purchase, total, paid);
    return {
      ...purchase,
      outstandingAmount: outstanding.toFixed(2),
      creditDueDate: purchase.credit?.dueDate ?? null,
      supplierCredit: purchase.credit ?? null,
    };
  }

  private serialize(purchase: Purchase, hasCreditPayments: boolean) {
    const total = parseFloat(purchase.total);
    const paid = parseFloat(purchase.paidAmount ?? '0');
    const outstanding = this.outstandingFor(purchase, total, paid);
    return {
      ...purchase,
      outstandingAmount: outstanding.toFixed(2),
      creditDueDate: purchase.credit?.dueDate ?? null,
      supplierCredit: purchase.credit ?? null,
      hasCreditPayments,
    };
  }

  private outstandingFor(purchase: Purchase, total: number, paid: number) {
    if (
      purchase.paymentMethod === PaymentMethod.CREDIT ||
      purchase.paymentMethod === PaymentMethod.PARTIAL
    ) {
      if (purchase.credit) {
        return parseFloat(purchase.credit.balance);
      }
      return Math.max(0, total - paid);
    }
    return 0;
  }

  private isNotesOnlyUpdate(dto: UpdatePurchaseDto): boolean {
    const keys = (Object.keys(dto) as (keyof UpdatePurchaseDto)[]).filter(
      (k) => dto[k] !== undefined,
    );
    return keys.length === 1 && keys[0] === 'notes';
  }

  private resolveLines(
    purchase: Purchase,
    dto: UpdatePurchaseDto,
  ): PurchaseLineDto[] {
    if (dto.lines) return dto.lines;
    return purchase.lines.map((l) => ({
      itemId: l.itemId,
      quantity: parseFloat(l.quantity),
      unitPrice: parseFloat(l.unitPrice),
    }));
  }

  /** Cash, bank transfer, or partial deposit — posts a bank ledger outflow. */
  private paysViaBank(method: PaymentMethod): boolean {
    return (
      method === PaymentMethod.BANK ||
      method === PaymentMethod.CASH ||
      method === PaymentMethod.PARTIAL
    );
  }

  private createsSupplierCredit(method: PaymentMethod): boolean {
    return (
      method === PaymentMethod.CREDIT || method === PaymentMethod.PARTIAL
    );
  }

  private resolveAmountPaid(
    method: PaymentMethod,
    total: number,
    amountPaid?: number,
  ): number {
    if (method === PaymentMethod.CREDIT) return 0;
    if (method === PaymentMethod.CASH || method === PaymentMethod.BANK) {
      return total;
    }
    if (method === PaymentMethod.PARTIAL) {
      if (amountPaid === undefined || amountPaid === null) {
        throw new BadRequestException(
          'amountPaid is required for partially paid purchases',
        );
      }
      if (!(amountPaid > 0) || !(amountPaid < total)) {
        throw new BadRequestException(
          'amountPaid must be greater than 0 and less than the purchase total',
        );
      }
      return amountPaid;
    }
    return total;
  }

  private async hasSubsequentCreditPayments(
    creditId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = manager
      ? manager.getRepository(BankTransaction)
      : this.dataSource.getRepository(BankTransaction);
    const count = await repo.count({
      where: { refType: 'supplier_credit_payment', refId: creditId },
    });
    return count > 0;
  }

  private assertBankAccountRequired(
    method: PaymentMethod,
    bankAccountId: string | null | undefined,
  ) {
    if (this.paysViaBank(method) && !bankAccountId) {
      throw new BadRequestException(
        method === PaymentMethod.CASH
          ? 'bankAccountId (cash till) required for CASH payments'
          : 'bankAccountId required for bank transfer and partially paid purchases',
      );
    }
  }

  private stockMeta(purchaseId: string, userId?: string) {
    return {
      sourceType: StockMovementSourceType.PURCHASE,
      referenceType: 'purchase',
      referenceId: purchaseId,
      createdById: userId ?? null,
    };
  }

  async update(id: string, dto: UpdatePurchaseDto, userId?: string) {
    if (this.isNotesOnlyUpdate(dto)) {
      const purchase = await this.purchaseRepo.findOne({ where: { id } });
      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.status === DocumentStatus.VOIDED) {
        throw new BadRequestException('Cannot update a voided purchase');
      }
      purchase.notes = dto.notes ?? null;
      await this.purchaseRepo.save(purchase);
      return this.findOne(id);
    }

    const hasFields = (Object.keys(dto) as (keyof UpdatePurchaseDto)[]).some(
      (k) => dto[k] !== undefined,
    );
    if (!hasFields) return this.findOne(id);

    await this.dataSource.transaction(async (manager) => {
      const purchaseRepo = manager.getRepository(Purchase);
      const lineRepo = manager.getRepository(PurchaseLine);
      const creditRepo = manager.getRepository(SupplierCredit);

      const purchase = await purchaseRepo.findOne({
        where: { id },
        relations: { lines: true, credit: true },
      });
      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.status === DocumentStatus.VOIDED) {
        throw new BadRequestException('Cannot update a voided purchase');
      }

      if (purchase.credit) {
        const locked = await this.hasSubsequentCreditPayments(
          purchase.credit.id,
          manager,
        );
        if (locked) {
          throw new BadRequestException(
            'Cannot change purchase after supplier credit payments; only notes may be updated',
          );
        }
      }

      const supplierId = dto.supplierId ?? purchase.supplierId;
      const locationId = dto.locationId ?? purchase.locationId;
      const paymentMethod = dto.paymentMethod ?? purchase.paymentMethod;
      const bankAccountId =
        dto.bankAccountId !== undefined
          ? dto.bankAccountId
          : purchase.bankAccountId;
      const notes =
        dto.notes !== undefined ? (dto.notes ?? null) : purchase.notes;
      const creditDueDate =
        dto.creditDueDate !== undefined
          ? dto.creditDueDate
          : (purchase.credit?.dueDate ?? undefined);
      const lines = this.resolveLines(purchase, dto);

      this.assertBankAccountRequired(paymentMethod, bankAccountId);
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
      const amountPaid = this.resolveAmountPaid(
        paymentMethod,
        subtotal,
        dto.amountPaid !== undefined
          ? dto.amountPaid
          : paymentMethod === PaymentMethod.PARTIAL
            ? parseFloat(purchase.paidAmount)
            : undefined,
      );

      const oldLocationId = purchase.locationId;
      const oldPaymentMethod = purchase.paymentMethod;
      const oldBankAccountId = purchase.bankAccountId;

      for (const line of purchase.lines) {
        await this.stockService.adjust(
          {
            locationId: oldLocationId,
            itemId: line.itemId,
            quantityDelta: -parseFloat(line.quantity),
            meta: {
              ...this.stockMeta(purchase.id, userId),
              notes: 'Purchase adjustment (reverse)',
            },
          },
          manager,
        );
      }

      if (this.paysViaBank(oldPaymentMethod) && oldBankAccountId) {
        await this.bankLedger.reverseByReference(
          'purchase',
          purchase.id,
          `Adjust purchase ${purchase.id}`,
          userId,
          manager,
        );
      }

      if (purchase.credit) {
        await creditRepo.remove(purchase.credit);
      }

      await lineRepo.delete({ purchaseId: purchase.id });

      purchase.supplierId = supplierId;
      purchase.locationId = locationId;
      purchase.paymentMethod = paymentMethod;
      purchase.bankAccountId = bankAccountId ?? null;
      purchase.subtotal = subtotal.toFixed(2);
      purchase.total = subtotal.toFixed(2);
      purchase.paidAmount = amountPaid.toFixed(2);
      purchase.notes = notes;
      purchase.lines = lines.map((l) => {
        const lineTotal = l.quantity * l.unitPrice;
        return Object.assign(new PurchaseLine(), {
          itemId: l.itemId,
          quantity: l.quantity.toFixed(3),
          unitPrice: l.unitPrice.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
        });
      });

      await purchaseRepo.save(purchase);

      for (const line of lines) {
        await this.stockService.adjust(
          {
            locationId,
            itemId: line.itemId,
            quantityDelta: line.quantity,
            purchasePrice: line.unitPrice,
            meta: this.stockMeta(purchase.id, userId),
          },
          manager,
        );
      }

      if (this.paysViaBank(paymentMethod) && bankAccountId && amountPaid > 0) {
        await this.bankLedger.recordTransaction(
          {
            bankAccountId,
            type: BankTransactionType.PURCHASE,
            amount: amountPaid,
            direction: 'out',
            description:
              paymentMethod === PaymentMethod.PARTIAL
                ? `Purchase ${purchase.id} (partial payment)`
                : `Purchase ${purchase.id}`,
            refType: 'purchase',
            refId: purchase.id,
            createdById: userId,
          },
          manager,
        );
      }

      if (this.createsSupplierCredit(paymentMethod)) {
        const balance = Math.max(0, subtotal - amountPaid);
        await creditRepo.save(
          creditRepo.create({
            supplierId,
            purchaseId: purchase.id,
            amount: subtotal.toFixed(2),
            paidAmount: amountPaid.toFixed(2),
            balance: balance.toFixed(2),
            status:
              balance <= 0
                ? CreditStatus.PAID
                : amountPaid > 0
                  ? CreditStatus.PARTIAL
                  : CreditStatus.OPEN,
            dueDate: creditDueDate ?? null,
          }),
        );
      }
    });

    return this.findOne(id);
  }

  async void(id: string, userId?: string) {
    await this.dataSource.transaction(async (manager) => {
      const purchaseRepo = manager.getRepository(Purchase);
      const creditRepo = manager.getRepository(SupplierCredit);

      const purchase = await purchaseRepo.findOne({
        where: { id },
        relations: { lines: true, credit: true },
      });
      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.status === DocumentStatus.VOIDED) {
        throw new BadRequestException('Purchase already voided');
      }

      if (purchase.credit) {
        const locked = await this.hasSubsequentCreditPayments(
          purchase.credit.id,
          manager,
        );
        if (locked) {
          throw new BadRequestException(
            'Cannot void purchase with additional supplier credit payments applied',
          );
        }
        await creditRepo.remove(purchase.credit);
      }

      for (const line of purchase.lines) {
        await this.stockService.adjust(
          {
            locationId: purchase.locationId,
            itemId: line.itemId,
            quantityDelta: -parseFloat(line.quantity),
            meta: {
              ...this.stockMeta(purchase.id, userId),
              notes: 'Purchase void',
            },
          },
          manager,
        );
      }

      if (this.paysViaBank(purchase.paymentMethod) && purchase.bankAccountId) {
        await this.bankLedger.reverseByReference(
          'purchase',
          purchase.id,
          `Void purchase ${purchase.id}`,
          userId,
          manager,
        );
      }

      purchase.status = DocumentStatus.VOIDED;
      purchase.voidedAt = new Date();
      await purchaseRepo.save(purchase);
    });

    return this.findOne(id);
  }

  async create(dto: CreatePurchaseDto, userId?: string) {
    this.assertBankAccountRequired(dto.paymentMethod, dto.bankAccountId);

    const subtotal = dto.lines.reduce(
      (sum, l) => sum + l.quantity * l.unitPrice,
      0,
    );
    const amountPaid = this.resolveAmountPaid(
      dto.paymentMethod,
      subtotal,
      dto.amountPaid,
    );

    if (this.createsSupplierCredit(dto.paymentMethod)) {
      const creditPortion = subtotal - amountPaid;
      if (creditPortion > 0) {
        await this.creditsService.assertSupplierWithinLimit(
          dto.supplierId,
          creditPortion,
        );
      }
    }

    const purchaseId = await this.dataSource.transaction(async (manager) => {
      if (this.paysViaBank(dto.paymentMethod) && dto.bankAccountId) {
        await this.banksService.assertPaymentAccount(
          dto.paymentMethod,
          dto.bankAccountId,
          manager,
        );
      }

      const purchaseRepo = manager.getRepository(Purchase);
      const creditRepo = manager.getRepository(SupplierCredit);

      const lines = dto.lines.map((l) => {
        const lineTotal = l.quantity * l.unitPrice;
        return Object.assign(new PurchaseLine(), {
          itemId: l.itemId,
          quantity: l.quantity.toFixed(3),
          unitPrice: l.unitPrice.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
        });
      });

      const purchase = await purchaseRepo.save(
        purchaseRepo.create({
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          paymentMethod: dto.paymentMethod,
          bankAccountId: dto.bankAccountId ?? null,
          subtotal: subtotal.toFixed(2),
          total: subtotal.toFixed(2),
          paidAmount: amountPaid.toFixed(2),
          notes: dto.notes ?? null,
          status: DocumentStatus.ACTIVE,
          createdById: userId ?? null,
          lines,
        }),
      );

      for (const line of dto.lines) {
        await this.stockService.adjust(
          {
            locationId: dto.locationId,
            itemId: line.itemId,
            quantityDelta: line.quantity,
            purchasePrice: line.unitPrice,
            meta: this.stockMeta(purchase.id, userId),
          },
          manager,
        );
      }

      if (
        this.paysViaBank(dto.paymentMethod) &&
        dto.bankAccountId &&
        amountPaid > 0
      ) {
        await this.bankLedger.recordTransaction(
          {
            bankAccountId: dto.bankAccountId,
            type: BankTransactionType.PURCHASE,
            amount: amountPaid,
            direction: 'out',
            description:
              dto.paymentMethod === PaymentMethod.PARTIAL
                ? `Purchase ${purchase.id} (partial payment)`
                : `Purchase ${purchase.id}`,
            refType: 'purchase',
            refId: purchase.id,
            createdById: userId,
          },
          manager,
        );
      }

      if (this.createsSupplierCredit(dto.paymentMethod)) {
        const balance = Math.max(0, subtotal - amountPaid);
        await creditRepo.save(
          creditRepo.create({
            supplierId: dto.supplierId,
            purchaseId: purchase.id,
            amount: subtotal.toFixed(2),
            paidAmount: amountPaid.toFixed(2),
            balance: balance.toFixed(2),
            status:
              balance <= 0
                ? CreditStatus.PAID
                : amountPaid > 0
                  ? CreditStatus.PARTIAL
                  : CreditStatus.OPEN,
            dueDate: dto.creditDueDate ?? null,
          }),
        );
      }

      return purchase.id;
    });

    await this.notifications.onPurchaseRecorded({
      purchaseId,
      total: subtotal.toFixed(2),
      actorUserId: userId,
      creditDueDate: dto.creditDueDate ?? null,
    });

    return this.findOne(purchaseId);
  }
}
