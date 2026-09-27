import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Not,
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
import {
  CUSTOMER_CREDIT_AGING_BUCKETS,
  SUPPLIER_CREDIT_AGING_BUCKETS,
  customerCreditAgingFromDays,
  customerCreditAgingMeta,
  creditAgingDays,
  repaymentLimitIncreasePercent,
  repaymentPerformanceScore,
  resolveAgingBucket,
  type CreditAgingBucketDef,
} from '../common/utils/credit-aging.util';

export type CreditListTotals = {
  amount: string;
  paidAmount: string;
  balance: string;
};

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
      data: (page.data as CustomerCredit[]).map((c) => this.withCreditMeta(c)),
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
    const standing = await this.customerRepaymentStanding(customer);

    return {
      customerId,
      customerName: customer.name,
      creditLimit: customer.creditLimit,
      invoiceTotal: parseFloat(raw?.invoiceTotal ?? '0').toFixed(2),
      paidTotal: parseFloat(raw?.paidTotal ?? '0').toFixed(2),
      outstanding: outstanding.toFixed(2),
      usedCredit: outstanding.toFixed(2),
      overdue: parseFloat(raw?.overdue ?? '0').toFixed(2),
      openCount: parseInt(raw?.openCount ?? '0', 10),
      availableCredit:
        limit == null ? null : Math.max(0, limit - outstanding).toFixed(2),
      overLimit: limit != null && outstanding > limit,
      ...standing,
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
    return {
      supplierId,
      supplierName: supplier.name,
      creditLimit: null,
      invoiceTotal: parseFloat(raw?.invoiceTotal ?? '0').toFixed(2),
      paidTotal: parseFloat(raw?.paidTotal ?? '0').toFixed(2),
      outstanding: outstanding.toFixed(2),
      overdue: parseFloat(raw?.overdue ?? '0').toFixed(2),
      openCount: parseInt(raw?.openCount ?? '0', 10),
      availableCredit: null,
      overLimit: false,
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

  /** Full credit ledger + aging for a single customer (profile hub). */
  async customerCreditProfile(customerId: string) {
    const summary = await this.customerAccountSummary(customerId);
    const credits = await this.customerCreditRepo.find({
      where: { customerId },
      relations: { sale: true },
      order: { createdAt: 'DESC' },
    });

    const openCredits = credits
      .filter((c) => c.status !== CreditStatus.PAID)
      .map((c) => this.withCreditMeta(c));

    const agingBreakdown: Record<
      string,
      { key: string; label: string; risk: string; count: number; balance: number }
    > = {};
    for (const b of CUSTOMER_CREDIT_AGING_BUCKETS) {
      agingBreakdown[b.key] = {
        key: b.key,
        label: b.label,
        risk: b.risk,
        count: 0,
        balance: 0,
      };
    }
    for (const c of openCredits) {
      const key = (c as { agingKey?: string }).agingKey ?? 'd0_15';
      if (agingBreakdown[key]) {
        agingBreakdown[key].count += 1;
        agingBreakdown[key].balance += parseFloat(c.balance);
      }
    }

    const paymentLists = await Promise.all(
      credits.map(async (c) => {
        const payments = await this.listPayments(
          'customer_credit_payment',
          c.id,
        );
        return payments.map((p) => ({
          ...p,
          creditId: c.id,
          saleId: c.saleId,
        }));
      }),
    );
    const payments = paymentLists
      .flat()
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

    const highlyCritical = openCredits.filter(
      (c) => (c as { agingKey?: string }).agingKey === 'd60_plus',
    );
    const highRisk = openCredits.filter(
      (c) => (c as { agingKey?: string }).agingKey === 'd31_60',
    );

    return {
      ...summary,
      credits: credits.map((c) => this.withCreditMeta(c)),
      openCredits,
      payments,
      aging: {
        totalOutstanding: summary.outstanding,
        buckets: CUSTOMER_CREDIT_AGING_BUCKETS.map((b) => ({
          key: b.key,
          label: b.label,
          risk: b.risk,
          count: agingBreakdown[b.key].count,
          balance: agingBreakdown[b.key].balance.toFixed(2),
        })),
      },
      alerts: {
        overdueCount: openCredits.filter((c) => c.isOverdue).length,
        highlyCriticalCount: highlyCritical.length,
        highlyCriticalBalance: highlyCritical
          .reduce((s, c) => s + parseFloat(c.balance), 0)
          .toFixed(2),
        highRiskCount: highRisk.length,
        highRiskBalance: highRisk
          .reduce((s, c) => s + parseFloat(c.balance), 0)
          .toFixed(2),
      },
    };
  }

  /** Open credits for a customer with aging + due meta (sales-linked). */
  async findCustomerOpenCredits(customerId: string) {
    const rows = await this.customerCreditRepo.find({
      where: { customerId },
      relations: { sale: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((c) => this.withCreditMeta(c));
  }

  async highlyCriticalCustomerSummary() {
    const rows = await this.customerCreditRepo.find({
      where: {},
      relations: { customer: true },
    });
    const today = new Date();
    let balance = 0;
    const customerIds = new Set<string>();
    for (const row of rows) {
      if (row.status === CreditStatus.PAID) continue;
      const days = creditAgingDays(row.createdAt, today);
      if (days < 61) continue;
      balance += parseFloat(row.balance);
      customerIds.add(row.customerId);
    }
    return {
      customerCount: customerIds.size,
      creditCount: rows.filter(
        (r) =>
          r.status !== CreditStatus.PAID &&
          creditAgingDays(r.createdAt, today) >= 61,
      ).length,
      balance: balance.toFixed(2),
    };
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

  private withOverdueMeta<
    T extends {
      status: CreditStatus;
      dueDate: string | null;
      balance: string;
      createdAt?: Date | string;
    },
  >(credit: T) {
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

  /** Customer credits: due-date overdue + aging from original credit/sale date. */
  private withCreditMeta(
    credit: CustomerCredit & { sale?: Sale | null },
  ) {
    const base = this.withOverdueMeta(credit);
    const origin = credit.createdAt;
    const aging = customerCreditAgingMeta(origin);
    return {
      ...base,
      ...aging,
      saleId: credit.saleId,
      saleDate: credit.sale?.createdAt ?? credit.createdAt,
    };
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

    const bucketDefs: readonly CreditAgingBucketDef[] =
      kind === 'customer'
        ? CUSTOMER_CREDIT_AGING_BUCKETS
        : SUPPLIER_CREDIT_AGING_BUCKETS;

    const buckets: Record<
      string,
      { label: string; risk?: string; count: number; balance: number }
    > = {};
    for (const b of bucketDefs) {
      buckets[b.key] = {
        label: b.label,
        risk: b.risk,
        count: 0,
        balance: 0,
      };
    }

    const today = new Date();
    let total = 0;
    for (const row of rows) {
      const bal = parseFloat(row.balance);
      total += bal;
      // Customer: age from original credit/sale date. Supplier: from due date (fallback created).
      const days =
        kind === 'customer'
          ? creditAgingDays(row.createdAt, today)
          : (() => {
              const anchor = row.dueDate
                ? new Date(row.dueDate)
                : new Date(row.createdAt);
              return creditAgingDays(anchor, today);
            })();
      const bucket = resolveAgingBucket(days, bucketDefs);
      buckets[bucket.key].count += 1;
      buckets[bucket.key].balance += bal;
    }

    return {
      totalOutstanding: total.toFixed(2),
      buckets: bucketDefs.map((b) => ({
        key: b.key,
        label: buckets[b.key].label,
        risk: buckets[b.key].risk ?? null,
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
      const wasUnpaid = credit.status !== CreditStatus.PAID;

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

      if (wasUnpaid && saved.status === CreditStatus.PAID) {
        await this.settleRepaymentPerformance(manager, saved);
      }

      return this.withCreditMeta(saved);
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

  private async customerRepaymentStanding(customer: Customer) {
    const baseRaw = customer.creditLimitBase ?? customer.creditLimit;
    const base = baseRaw != null && baseRaw !== '' ? parseFloat(baseRaw) : null;
    const openCredits = await this.customerCreditRepo.find({
      where: {
        customerId: customer.id,
        status: Not(CreditStatus.PAID),
      },
    });
    let worst: ReturnType<typeof customerCreditAgingFromDays> | null = null;
    for (const row of openCredits) {
      const meta = customerCreditAgingMeta(row.createdAt);
      if (!worst || meta.agingDays > worst.agingDays) worst = meta;
    }
    const paidCredits = await this.customerCreditRepo.find({
      where: { customerId: customer.id, status: CreditStatus.PAID },
    });
    const scores = paidCredits.map((row) =>
      repaymentPerformanceScore(
        row.repaidInDays ??
          creditAgingDays(row.createdAt, row.updatedAt ?? new Date()),
      ),
    );
    const creditScore = scores.length
      ? Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length)
      : null;
    const pct = worst ? repaymentLimitIncreasePercent(worst.agingDays) : 0;
    const eligibleAmount =
      worst && base != null && base > 0 ? (base * pct) / 100 : null;

    return {
      initialCreditLimit: base != null ? base.toFixed(2) : null,
      agingStatus: worst?.agingRisk ?? 'Clear',
      agingLabel: worst?.agingLabel ?? null,
      agingDays: worst?.agingDays ?? null,
      creditScore,
      eligibleIncreasePercent: worst ? pct : null,
      eligibleIncrease:
        eligibleAmount != null ? eligibleAmount.toFixed(2) : null,
      normalIncrease:
        base != null && base > 0 ? ((base * 10) / 100).toFixed(2) : null,
      attentionIncrease:
        base != null && base > 0 ? ((base * 5) / 100).toFixed(2) : null,
      lastLimitIncrease: customer.lastLimitIncrease,
      lastLimitIncreasePercent: customer.lastLimitIncreasePercent,
      lastRepaymentDays: customer.lastRepaymentDays,
      lastRepaymentRisk: customer.lastRepaymentRisk,
    };
  }

  /**
   * When the last open credit is paid, score the cycle from the oldest
   * unpaid-reward credit and raise the limit from the initial limit.
   */
  private async settleRepaymentPerformance(
    manager: EntityManager,
    credit: CustomerCredit,
  ) {
    const creditRepo = manager.getRepository(CustomerCredit);
    const stillOpen = await creditRepo.count({
      where: {
        customerId: credit.customerId,
        status: Not(CreditStatus.PAID),
      },
    });
    if (stillOpen > 0) return;

    const pending = await creditRepo.find({
      where: {
        customerId: credit.customerId,
        status: CreditStatus.PAID,
        limitRewardApplied: false,
      },
    });
    if (!pending.length) return;

    const today = new Date();
    let worstDays = 0;
    for (const row of pending) {
      const days = creditAgingDays(row.createdAt, today);
      row.repaidInDays = days;
      row.limitRewardApplied = true;
      if (days > worstDays) worstDays = days;
    }

    const customer = await manager.getRepository(Customer).findOne({
      where: { id: credit.customerId },
    });
    if (!customer) {
      await creditRepo.save(pending);
      return;
    }

    const meta = customerCreditAgingFromDays(worstDays);
    const base = parseFloat(
      customer.creditLimitBase ?? customer.creditLimit ?? '0',
    );
    const pct = repaymentLimitIncreasePercent(worstDays);
    const increase = base > 0 ? (base * pct) / 100 : 0;
    if (increase > 0 && customer.creditLimit != null) {
      const current = parseFloat(customer.creditLimit);
      customer.creditLimit = (current + increase).toFixed(2);
    }
    if (!customer.creditLimitBase && customer.creditLimit) {
      customer.creditLimitBase = base > 0 ? base.toFixed(2) : customer.creditLimit;
    }
    customer.lastLimitIncrease = increase.toFixed(2);
    customer.lastLimitIncreasePercent = pct;
    customer.lastRepaymentDays = worstDays;
    customer.lastRepaymentRisk = meta.agingRisk;
    await manager.getRepository(Customer).save(customer);
    await creditRepo.save(pending);
  }

  /** Used by sales before posting a CREDIT document. */
  async assertCustomerWithinLimit(
    customerId: string,
    additionalAmount: number,
    options?: { excludeCreditId?: string },
  ) {
    const customer = await this.dataSource
      .getRepository(Customer)
      .findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    if (customer.creditLimit == null || customer.creditLimit === '') {
      throw new BadRequestException(
        'Customer has no credit limit configured. Set a credit limit before recording credit sales.',
      );
    }

    const limit = parseFloat(customer.creditLimit);
    if (!(limit > 0)) {
      throw new BadRequestException(
        'Customer credit limit must be greater than zero to record credit sales.',
      );
    }

    const qb = this.customerCreditRepo
      .createQueryBuilder('credit')
      .select('COALESCE(SUM(credit.balance::numeric), 0)', 'outstanding')
      .where('credit.customer_id = :customerId', { customerId })
      .andWhere('credit.status != :paid', { paid: CreditStatus.PAID });

    if (options?.excludeCreditId) {
      qb.andWhere('credit.id != :excludeId', {
        excludeId: options.excludeCreditId,
      });
    }

    const raw = await qb.getRawOne<{ outstanding: string }>();
    const outstanding = parseFloat(raw?.outstanding ?? '0');
    if (outstanding + additionalAmount > limit + 1e-6) {
      const available = Math.max(0, limit - outstanding);
      throw new BadRequestException(
        `Credit limit reached for ${customer.name}. Limit Br ${limit.toFixed(2)}, outstanding Br ${outstanding.toFixed(2)}, available Br ${available.toFixed(2)}; this sale Br ${additionalAmount.toFixed(2)}.`,
      );
    }
  }

  async assertSupplierWithinLimit(
    _supplierId: string,
    _additionalAmount: number,
  ) {
    // Payable credit limits were removed from supplier profiles.
    return;
  }
}
