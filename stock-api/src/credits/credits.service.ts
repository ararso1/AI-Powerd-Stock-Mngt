import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  BankTransactionType,
  CreditStatus,
  NotificationType,
} from '../common/enums';
import {
  applyDateRangeToQb,
  applyRelatedIlikeSearch,
  paginatedQueryBuilder,
  sumFilteredQueryBuilder,
} from '../common/utils/query.util';
import { CreditListQueryDto } from './dto/credit-list-query.dto';
import { BankLedgerService } from '../banks/bank-ledger.service';
import { BankTransaction } from '../database/entities/bank-transaction.entity';
import { Customer } from '../database/entities/customer.entity';
import { CustomerCredit } from '../database/entities/customer-credit.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Sale } from '../database/entities/sale.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { SupplierCredit } from '../database/entities/supplier-credit.entity';
import { CreditPaymentDto } from './dto/credit-payment.dto';
import { NotificationsService } from '../notifications/notifications.service';

export type CreditListTotals = {
  amount: string;
  paidAmount: string;
  balance: string;
};

const AGING_BUCKETS = [
  { key: 'current', label: 'Current', min: Number.NEGATIVE_INFINITY, max: 0 },
  { key: 'd1_30', label: '1–30 days', min: 1, max: 30 },
  { key: 'd31_60', label: '31–60 days', min: 31, max: 60 },
  { key: 'd61_90', label: '61–90 days', min: 61, max: 90 },
  { key: 'd90_plus', label: '90+ days', min: 91, max: Number.POSITIVE_INFINITY },
] as const;

@Injectable()
export class CreditsService implements OnModuleInit {
  private reminderTimer: ReturnType<typeof setInterval> | null = null;
  private lastReminderDay: string | null = null;

  constructor(
    @InjectRepository(CustomerCredit)
    private readonly customerCreditRepo: Repository<CustomerCredit>,
    @InjectRepository(SupplierCredit)
    private readonly supplierCreditRepo: Repository<SupplierCredit>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly bankLedger: BankLedgerService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    // Daily overdue / due-soon reminders (in-process; fine for single-instance deploy)
    void this.maybeSendDailyReminders();
    this.reminderTimer = setInterval(
      () => void this.maybeSendDailyReminders(),
      60 * 60 * 1000,
    );
  }

  async findCustomerCredits(query: CreditListQueryDto) {
    const filteredQb = this.buildCustomerCreditsQb(query);
    const [totals, page] = await Promise.all([
      this.computeTotals(filteredQb),
      paginatedQueryBuilder(
        filteredQb
          .clone()
          .leftJoinAndSelect('credit.customer', 'customer')
          .leftJoinAndSelect('credit.sale', 'sale')
          .orderBy('credit.created_at', 'DESC'),
        query.page,
        query.limit,
      ),
    ]);

    return {
      ...page,
      totals,
      data: (page.data as CustomerCredit[]).map((c) => this.withOverdueMeta(c)),
    };
  }

  async findSupplierCredits(query: CreditListQueryDto) {
    const filteredQb = this.buildSupplierCreditsQb(query);
    const [totals, page] = await Promise.all([
      this.computeTotals(filteredQb),
      paginatedQueryBuilder(
        filteredQb
          .clone()
          .leftJoinAndSelect('credit.supplier', 'supplier')
          .leftJoinAndSelect('credit.purchase', 'purchase')
          .orderBy('credit.created_at', 'DESC'),
        query.page,
        query.limit,
      ),
    ]);

    return {
      ...page,
      totals,
      data: (page.data as SupplierCredit[]).map((c) => this.withOverdueMeta(c)),
    };
  }

  async customerAccountSummary(customerId: string) {
    const customer = await this.dataSource
      .getRepository(Customer)
      .findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const raw = await this.customerCreditRepo
      .createQueryBuilder('credit')
      .select('COALESCE(SUM(credit.amount::numeric), 0)', 'invoiceTotal')
      .addSelect('COALESCE(SUM(credit.paid_amount::numeric), 0)', 'paidTotal')
      .addSelect('COALESCE(SUM(credit.balance::numeric), 0)', 'outstanding')
      .addSelect(
        `COALESCE(SUM(CASE WHEN credit.status != 'PAID' AND credit."dueDate" IS NOT NULL AND credit."dueDate" < CURRENT_DATE THEN credit.balance::numeric ELSE 0 END), 0)`,
        'overdue',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE credit.status != 'PAID')`,
        'openCount',
      )
      .where('credit.customer_id = :customerId', { customerId })
      .getRawOne<{
        invoiceTotal: string;
        paidTotal: string;
        outstanding: string;
        overdue: string;
        openCount: string;
      }>();

    const outstanding = parseFloat(raw?.outstanding ?? '0');
    const limit = customer.creditLimit
      ? parseFloat(customer.creditLimit)
      : null;

    return {
      customerId,
      customerName: customer.name,
      creditLimit: customer.creditLimit,
      invoiceTotal: parseFloat(raw?.invoiceTotal ?? '0').toFixed(2),
      paidTotal: parseFloat(raw?.paidTotal ?? '0').toFixed(2),
      outstanding: outstanding.toFixed(2),
      overdue: parseFloat(raw?.overdue ?? '0').toFixed(2),
      openCount: parseInt(raw?.openCount ?? '0', 10),
      availableCredit:
        limit == null ? null : Math.max(0, limit - outstanding).toFixed(2),
      overLimit: limit != null && outstanding > limit,
    };
  }

  async supplierAccountSummary(supplierId: string) {
    const supplier = await this.dataSource
      .getRepository(Supplier)
      .findOne({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const raw = await this.supplierCreditRepo
      .createQueryBuilder('credit')
      .select('COALESCE(SUM(credit.amount::numeric), 0)', 'invoiceTotal')
      .addSelect('COALESCE(SUM(credit.paid_amount::numeric), 0)', 'paidTotal')
      .addSelect('COALESCE(SUM(credit.balance::numeric), 0)', 'outstanding')
      .addSelect(
        `COALESCE(SUM(CASE WHEN credit.status != 'PAID' AND credit."dueDate" IS NOT NULL AND credit."dueDate" < CURRENT_DATE THEN credit.balance::numeric ELSE 0 END), 0)`,
        'overdue',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE credit.status != 'PAID')`,
        'openCount',
      )
      .where('credit.supplier_id = :supplierId', { supplierId })
      .getRawOne<{
        invoiceTotal: string;
        paidTotal: string;
        outstanding: string;
        overdue: string;
        openCount: string;
      }>();

    const outstanding = parseFloat(raw?.outstanding ?? '0');
    const limit = supplier.creditLimit
      ? parseFloat(supplier.creditLimit)
      : null;

    return {
      supplierId,
      supplierName: supplier.name,
      creditLimit: supplier.creditLimit,
      invoiceTotal: parseFloat(raw?.invoiceTotal ?? '0').toFixed(2),
      paidTotal: parseFloat(raw?.paidTotal ?? '0').toFixed(2),
      outstanding: outstanding.toFixed(2),
      overdue: parseFloat(raw?.overdue ?? '0').toFixed(2),
      openCount: parseInt(raw?.openCount ?? '0', 10),
      availableCredit:
        limit == null ? null : Math.max(0, limit - outstanding).toFixed(2),
      overLimit: limit != null && outstanding > limit,
    };
  }

  async findCustomerPayments(creditId: string) {
    const credit = await this.customerCreditRepo.findOne({
      where: { id: creditId },
    });
    if (!credit) throw new NotFoundException('Customer credit not found');
    return this.listPayments('customer_credit_payment', creditId);
  }

  async findSupplierPayments(creditId: string) {
    const credit = await this.supplierCreditRepo.findOne({
      where: { id: creditId },
    });
    if (!credit) throw new NotFoundException('Supplier credit not found');
    return this.listPayments('supplier_credit_payment', creditId);
  }

  async agingAnalysis() {
    const [customers, suppliers] = await Promise.all([
      this.ageCredits('customer'),
      this.ageCredits('supplier'),
    ]);
    return { currency: 'ETB', customers, suppliers };
  }

  async overdueAccounts() {
    const [customers, suppliers] = await Promise.all([
      this.findCustomerCredits({
        overdue: true,
        page: 1,
        limit: 100,
      } as CreditListQueryDto),
      this.findSupplierCredits({
        overdue: true,
        page: 1,
        limit: 100,
      } as CreditListQueryDto),
    ]);
    return {
      customers: {
        totals: customers.totals,
        count: customers.meta.total,
        rows: customers.data,
      },
      suppliers: {
        totals: suppliers.totals,
        count: suppliers.meta.total,
        rows: suppliers.data,
      },
    };
  }

  async sendPaymentReminders(force = false) {
    return this.runReminders(force);
  }

  private async maybeSendDailyReminders() {
    const day = new Date().toISOString().slice(0, 10);
    if (this.lastReminderDay === day) return;
    await this.runReminders(false);
    this.lastReminderDay = day;
  }

  private async runReminders(force: boolean) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 3);
    const soonIso = soon.toISOString().slice(0, 10);
    const todayIso = today.toISOString().slice(0, 10);

    const customerDue = await this.customerCreditRepo
      .createQueryBuilder('credit')
      .leftJoinAndSelect('credit.customer', 'customer')
      .leftJoinAndSelect('credit.sale', 'sale')
      .where('credit.status != :paid', { paid: CreditStatus.PAID })
      .andWhere('credit."dueDate" IS NOT NULL')
      .andWhere('credit."dueDate" <= :soon', { soon: soonIso })
      .getMany();

    const supplierDue = await this.supplierCreditRepo
      .createQueryBuilder('credit')
      .leftJoinAndSelect('credit.supplier', 'supplier')
      .leftJoinAndSelect('credit.purchase', 'purchase')
      .where('credit.status != :paid', { paid: CreditStatus.PAID })
      .andWhere('credit."dueDate" IS NOT NULL')
      .andWhere('credit."dueDate" <= :soon', { soon: soonIso })
      .getMany();

    let sent = 0;
    for (const credit of customerDue) {
      const overdue = (credit.dueDate as string) < todayIso;
      await this.notifications.notifyUsersWithPermission('credit.read', {
        module: 'credit',
        type: NotificationType.CREDIT_DUE,
        title: overdue
          ? 'Overdue customer receivable'
          : 'Customer payment due soon',
        message: `${credit.customer?.name ?? 'Customer'}: Br ${credit.balance} due ${credit.dueDate}${overdue ? ' (OVERDUE)' : ''}`,
        entityType: 'customer_credit',
        entityId: credit.id,
        metadata: {
          customerId: credit.customerId,
          saleId: credit.saleId,
          dueDate: credit.dueDate,
          balance: credit.balance,
          overdue,
          force,
        },
      });
      sent += 1;
    }
    for (const credit of supplierDue) {
      const overdue = (credit.dueDate as string) < todayIso;
      await this.notifications.notifyUsersWithPermission('credit.read', {
        module: 'credit',
        type: NotificationType.CREDIT_DUE,
        title: overdue ? 'Overdue supplier payable' : 'Supplier payment due soon',
        message: `${credit.supplier?.name ?? 'Supplier'}: Br ${credit.balance} due ${credit.dueDate}${overdue ? ' (OVERDUE)' : ''}`,
        entityType: 'supplier_credit',
        entityId: credit.id,
        metadata: {
          supplierId: credit.supplierId,
          purchaseId: credit.purchaseId,
          dueDate: credit.dueDate,
          balance: credit.balance,
          overdue,
          force,
        },
      });
      sent += 1;
    }
    return { sent, asOf: todayIso };
  }

  private buildCustomerCreditsQb(query: CreditListQueryDto) {
    const qb = this.customerCreditRepo.createQueryBuilder('credit');

    if (query.status) {
      qb.andWhere('credit.status = :status', { status: query.status });
    }
    if (query.customerId) {
      qb.andWhere('credit.customer_id = :customerId', {
        customerId: query.customerId,
      });
    }
    if (query.overdue) {
      qb.andWhere('credit.status != :paidStatus', {
        paidStatus: CreditStatus.PAID,
      });
      qb.andWhere('credit."dueDate" IS NOT NULL');
      qb.andWhere('credit."dueDate" < CURRENT_DATE');
    }
    applyRelatedIlikeSearch(qb, query.search, [], {
      table: 'customers',
      alias: 'customer_filter',
      parentKey: 'credit.customer_id',
      relatedKey: 'id',
      columns: ['name', 'phone'],
    });
    applyDateRangeToQb(qb, 'credit.created_at', query.from, query.to);

    return qb;
  }

  private buildSupplierCreditsQb(query: CreditListQueryDto) {
    const qb = this.supplierCreditRepo.createQueryBuilder('credit');

    if (query.status) {
      qb.andWhere('credit.status = :status', { status: query.status });
    }
    if (query.supplierId) {
      qb.andWhere('credit.supplier_id = :supplierId', {
        supplierId: query.supplierId,
      });
    }
    if (query.overdue) {
      qb.andWhere('credit.status != :paidStatus', {
        paidStatus: CreditStatus.PAID,
      });
      qb.andWhere('credit."dueDate" IS NOT NULL');
      qb.andWhere('credit."dueDate" < CURRENT_DATE');
    }
    applyRelatedIlikeSearch(qb, query.search, [], {
      table: 'suppliers',
      alias: 'supplier_filter',
      parentKey: 'credit.supplier_id',
      relatedKey: 'id',
      columns: ['name', 'phone'],
    });
    applyDateRangeToQb(qb, 'credit.created_at', query.from, query.to);

    return qb;
  }

  private async computeTotals(
    filteredQb: SelectQueryBuilder<ObjectLiteral>,
  ): Promise<CreditListTotals> {
    const raw = await sumFilteredQueryBuilder(filteredQb, [
      {
        key: 'totalAmount',
        sql: 'COALESCE(SUM(credit.amount::numeric), 0)',
      },
      {
        key: 'totalPaidAmount',
        sql: 'COALESCE(SUM(credit.paid_amount::numeric), 0)',
      },
      {
        key: 'totalBalance',
        sql: 'COALESCE(SUM(credit.balance::numeric), 0)',
      },
    ]);

    return {
      amount: raw.totalAmount,
      paidAmount: raw.totalPaidAmount,
      balance: raw.totalBalance,
    };
  }

  private withOverdueMeta<T extends { status: CreditStatus; dueDate: string | null; balance: string }>(
    credit: T,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let daysOverdue: number | null = null;
    let isOverdue = false;
    if (credit.status !== CreditStatus.PAID && credit.dueDate) {
      const due = new Date(credit.dueDate);
      due.setHours(0, 0, 0, 0);
      const diff = Math.floor(
        (today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (diff > 0) {
        isOverdue = true;
        daysOverdue = diff;
      }
    }
    return { ...credit, isOverdue, daysOverdue };
  }

  private async listPayments(refType: string, refId: string) {
    const rows = await this.dataSource.getRepository(BankTransaction).find({
      where: { refType, refId },
      relations: { bankAccount: true, createdBy: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((t) => ({
      id: t.id,
      date: t.createdAt,
      amount: t.amount,
      direction: t.direction,
      type: t.type,
      description: t.description,
      bankAccount: t.bankAccount
        ? { id: t.bankAccount.id, name: t.bankAccount.name }
        : null,
      createdBy: t.createdBy
        ? { id: t.createdBy.id, fullName: t.createdBy.fullName }
        : null,
    }));
  }

  private async ageCredits(kind: 'customer' | 'supplier') {
    const repo =
      kind === 'customer' ? this.customerCreditRepo : this.supplierCreditRepo;
    const alias = 'credit';
    const rows = await repo
      .createQueryBuilder(alias)
      .where(`${alias}.status != :paid`, { paid: CreditStatus.PAID })
      .getMany();

    const buckets: Record<
      string,
      { label: string; count: number; balance: number }
    > = {};
    for (const b of AGING_BUCKETS) {
      buckets[b.key] = { label: b.label, count: 0, balance: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let total = 0;
    for (const row of rows) {
      const bal = parseFloat(row.balance);
      total += bal;
      const anchor = row.dueDate ? new Date(row.dueDate) : new Date(row.createdAt);
      anchor.setHours(0, 0, 0, 0);
      const days = Math.floor(
        (today.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000),
      );
      const bucket =
        AGING_BUCKETS.find((b) => days >= b.min && days <= b.max) ??
        AGING_BUCKETS[AGING_BUCKETS.length - 1];
      buckets[bucket.key].count += 1;
      buckets[bucket.key].balance += bal;
    }

    return {
      totalOutstanding: total.toFixed(2),
      buckets: AGING_BUCKETS.map((b) => ({
        key: b.key,
        label: buckets[b.key].label,
        count: buckets[b.key].count,
        balance: buckets[b.key].balance.toFixed(2),
      })),
    };
  }

  async payCustomerCredit(id: string, dto: CreditPaymentDto, userId?: string) {
    if (!dto.bankAccountId) {
      throw new BadRequestException('bankAccountId required');
    }

    return this.dataSource.transaction(async (manager) => {
      const creditRepo = manager.getRepository(CustomerCredit);
      const saleRepo = manager.getRepository(Sale);
      const credit = await creditRepo.findOne({ where: { id } });
      if (!credit) throw new NotFoundException('Customer credit not found');

      const balance = parseFloat(credit.balance);
      if (dto.amount > balance) {
        throw new BadRequestException('Payment exceeds balance');
      }

      await this.bankLedger.recordTransaction(
        {
          bankAccountId: dto.bankAccountId!,
          type: BankTransactionType.CREDIT_RECEIPT,
          amount: dto.amount,
          direction: 'in',
          description:
            dto.notes?.trim() ||
            `Customer credit payment ${id.slice(0, 8)}`,
          refType: 'customer_credit_payment',
          refId: id,
          createdById: userId,
        },
        manager,
      );

      const paid = parseFloat(credit.paidAmount) + dto.amount;
      const newBalance = parseFloat(credit.amount) - paid;
      credit.paidAmount = paid.toFixed(2);
      credit.balance = Math.max(0, newBalance).toFixed(2);
      credit.status =
        newBalance <= 0
          ? CreditStatus.PAID
          : paid > 0
            ? CreditStatus.PARTIAL
            : CreditStatus.OPEN;

      const saved = await creditRepo.save(credit);

      const sale = await saleRepo.findOne({ where: { id: credit.saleId } });
      if (sale) {
        sale.paidAmount = credit.paidAmount;
        await saleRepo.save(sale);
      }

      return this.withOverdueMeta(saved);
    });
  }

  async paySupplierCredit(id: string, dto: CreditPaymentDto, userId?: string) {
    if (!dto.bankAccountId) {
      throw new BadRequestException('bankAccountId required');
    }

    return this.dataSource.transaction(async (manager) => {
      const creditRepo = manager.getRepository(SupplierCredit);
      const purchaseRepo = manager.getRepository(Purchase);
      const credit = await creditRepo.findOne({ where: { id } });
      if (!credit) throw new NotFoundException('Supplier credit not found');

      const balance = parseFloat(credit.balance);
      if (dto.amount > balance) {
        throw new BadRequestException('Payment exceeds balance');
      }

      await this.bankLedger.recordTransaction(
        {
          bankAccountId: dto.bankAccountId!,
          type: BankTransactionType.CREDIT_PAYMENT,
          amount: dto.amount,
          direction: 'out',
          description:
            dto.notes?.trim() ||
            `Supplier credit payment ${id.slice(0, 8)}`,
          refType: 'supplier_credit_payment',
          refId: id,
          createdById: userId,
        },
        manager,
      );

      const paid = parseFloat(credit.paidAmount) + dto.amount;
      const newBalance = parseFloat(credit.amount) - paid;
      credit.paidAmount = paid.toFixed(2);
      credit.balance = Math.max(0, newBalance).toFixed(2);
      credit.status =
        newBalance <= 0
          ? CreditStatus.PAID
          : paid > 0
            ? CreditStatus.PARTIAL
            : CreditStatus.OPEN;

      const saved = await creditRepo.save(credit);

      const purchase = await purchaseRepo.findOne({
        where: { id: credit.purchaseId },
      });
      if (purchase) {
        purchase.paidAmount = credit.paidAmount;
        await purchaseRepo.save(purchase);
      }

      return this.withOverdueMeta(saved);
    });
  }

  /** Used by sales/purchases before posting a CREDIT document. */
  async assertCustomerWithinLimit(customerId: string, additionalAmount: number) {
    const customer = await this.dataSource
      .getRepository(Customer)
      .findOne({ where: { id: customerId } });
    if (!customer?.creditLimit) return;
    const limit = parseFloat(customer.creditLimit);
    const raw = await this.customerCreditRepo
      .createQueryBuilder('credit')
      .select('COALESCE(SUM(credit.balance::numeric), 0)', 'outstanding')
      .where('credit.customer_id = :customerId', { customerId })
      .andWhere('credit.status != :paid', { paid: CreditStatus.PAID })
      .getRawOne<{ outstanding: string }>();
    const outstanding = parseFloat(raw?.outstanding ?? '0');
    if (outstanding + additionalAmount > limit + 1e-6) {
      throw new BadRequestException(
        `Credit limit exceeded for customer (limit Br ${limit.toFixed(2)}, open Br ${outstanding.toFixed(2)}, this sale Br ${additionalAmount.toFixed(2)})`,
      );
    }
  }

  async assertSupplierWithinLimit(supplierId: string, additionalAmount: number) {
    const supplier = await this.dataSource
      .getRepository(Supplier)
      .findOne({ where: { id: supplierId } });
    if (!supplier?.creditLimit) return;
    const limit = parseFloat(supplier.creditLimit);
    const raw = await this.supplierCreditRepo
      .createQueryBuilder('credit')
      .select('COALESCE(SUM(credit.balance::numeric), 0)', 'outstanding')
      .where('credit.supplier_id = :supplierId', { supplierId })
      .andWhere('credit.status != :paid', { paid: CreditStatus.PAID })
      .getRawOne<{ outstanding: string }>();
    const outstanding = parseFloat(raw?.outstanding ?? '0');
    if (outstanding + additionalAmount > limit + 1e-6) {
      throw new BadRequestException(
        `Payable credit limit exceeded for supplier (limit Br ${limit.toFixed(2)}, open Br ${outstanding.toFixed(2)}, this purchase Br ${additionalAmount.toFixed(2)})`,
      );
    }
  }
}
