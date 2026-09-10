import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { getAppCurrency } from '../common/utils/currency.util';
import { parseDateRange } from '../common/dto/date-range.dto';
import { applyDateRangeToQb } from '../common/utils/query.util';
import {
  CoffeeForm,
  CreditStatus,
  DocumentStatus,
  ExportContractStatus,
  LocationType,
  LotStatus,
  ProcessRunStatus,
  SaleChannel,
} from '../common/enums';
import { BanksService } from '../banks/banks.service';
import { BankAccount } from '../database/entities/bank-account.entity';
import { CollectionTicket } from '../database/entities/collection-ticket.entity';
import { CustomerCredit } from '../database/entities/customer-credit.entity';
import { Expense } from '../database/entities/expense.entity';
import {
  ExportContract,
  ExportDocCheckItem,
} from '../database/entities/export-contract.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { Notification } from '../database/entities/notification.entity';
import { ProcessRun } from '../database/entities/process-run.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleLine } from '../database/entities/sale-line.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
import { SupplierCredit } from '../database/entities/supplier-credit.entity';

type Recommendation = {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  code: string;
  title: string;
  detail: string;
  href: string;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly config: ConfigService,
    private readonly banksService: BanksService,
    @InjectRepository(StockLevel)
    private readonly stockRepo: Repository<StockLevel>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectRepository(SaleLine)
    private readonly saleLineRepo: Repository<SaleLine>,
    @InjectRepository(BankAccount)
    private readonly bankRepo: Repository<BankAccount>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(CollectionTicket)
    private readonly collectionRepo: Repository<CollectionTicket>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
    @InjectRepository(ProcessRun)
    private readonly processRunRepo: Repository<ProcessRun>,
    @InjectRepository(ExportContract)
    private readonly exportRepo: Repository<ExportContract>,
    @InjectRepository(CustomerCredit)
    private readonly customerCreditRepo: Repository<CustomerCredit>,
    @InjectRepository(SupplierCredit)
    private readonly supplierCreditRepo: Repository<SupplierCredit>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async getOverview(from?: string, to?: string) {
    const period = parseDateRange(from, to);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = today.toISOString().slice(0, 10);

    const stocks = await this.stockRepo.find({
      relations: { location: true, item: true },
    });

    let totalInventoryValue = 0;
    const valueByLocation: Record<string, { name: string; value: number }> = {};
    let linkedQty = 0;
    let unlinkedQty = 0;

    for (const s of stocks) {
      const qty = parseFloat(s.quantity);
      const value = qty * parseFloat(s.purchasePrice);
      totalInventoryValue += value;
      const locId = s.locationId;
      if (!valueByLocation[locId]) {
        valueByLocation[locId] = {
          name: s.location?.name ?? locId,
          value: 0,
        };
      }
      valueByLocation[locId].value += value;

      const isCoffee = !!s.item?.sku?.toUpperCase().startsWith('COF-');
      if (isCoffee || s.lotId) {
        if (s.lotId) linkedQty += Math.max(0, qty);
        else unlinkedQty += Math.max(0, qty);
      }
    }

    const dailySalesQb = this.saleRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.total::numeric), 0)', 'total')
      .where('s.created_at >= :start AND s.created_at < :end', {
        start: today,
        end: tomorrow,
      })
      .andWhere('s.status = :status', { status: DocumentStatus.ACTIVE });
    const dailySales = await dailySalesQb.getRawOne<{ total: string }>();

    const dailyPurchases = await this.purchaseRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.total::numeric), 0)', 'total')
      .where('p.created_at >= :start AND p.created_at < :end', {
        start: today,
        end: tomorrow,
      })
      .andWhere('p.status = :status', { status: DocumentStatus.ACTIVE })
      .getRawOne<{ total: string }>();

    const profitAndLoss = await this.computeProfitSummary(
      period.start?.toISOString().slice(0, 10),
      period.end?.toISOString().slice(0, 10),
    );

    const bankAccounts = await this.bankRepo.find({
      where: { isActive: true },
      order: { accountType: 'ASC', name: 'ASC' },
    });
    const liquidityTotals =
      this.banksService.computeLiquidityTotals(bankAccounts);

    const showrooms = await this.locationRepo.find({
      where: { type: LocationType.SHOWROOM, isActive: true },
    });

    const [
      pulse,
      commercial,
      contracts,
      qcHold,
      shrinkage,
      highMoisture,
    ] = await Promise.all([
      this.buildPulse(today, tomorrow, todayStr),
      this.buildCommercial(
        period.start?.toISOString().slice(0, 10),
        period.end?.toISOString().slice(0, 10),
        liquidityTotals.totalLiquidity,
      ),
      this.buildContracts(today),
      this.lotRepo
        .createQueryBuilder('lot')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(lot.quantity::numeric), 0)', 'kg')
        .where('lot.status = :status', { status: LotStatus.HOLD })
        .getRawOne<{ count: string; kg: string }>(),
      this.processRunRepo.find({
        where: { status: ProcessRunStatus.COMPLETED },
        relations: { template: true },
        order: { completedAt: 'DESC' },
        take: 40,
      }),
      this.lotRepo.find({
        where: {
          status: LotStatus.ACTIVE,
          form: In([CoffeeForm.GREEN, CoffeeForm.PARCHMENT, CoffeeForm.CHERRY]),
        },
        order: { moisturePercent: 'DESC' },
        take: 20,
      }),
    ]);

    const shrinkageSignals = shrinkage
      .filter((r) => r.actualYieldPercent != null)
      .map((r) => {
        const expected = parseFloat(r.expectedYieldPercent);
        const actual = parseFloat(r.actualYieldPercent!);
        return {
          processRunId: r.id,
          runNumber: r.runNumber,
          expectedYieldPercent: r.expectedYieldPercent,
          actualYieldPercent: r.actualYieldPercent!,
          variancePercent: Number((actual - expected).toFixed(2)),
        };
      })
      .filter((s) => s.variancePercent <= -5)
      .slice(0, 8);

    const totalCoffeeQty = linkedQty + unlinkedQty;
    const lotLinkedStockPercent =
      totalCoffeeQty > 0
        ? Number(((linkedQty / totalCoffeeQty) * 100).toFixed(1))
        : 100;

    const recommendations = this.buildRecommendations({
      contracts,
      shrinkageSignals,
      highMoisture,
      lotLinkedStockPercent,
      unlinkedKg: unlinkedQty,
      pulse,
    });

    return {
      currency: getAppCurrency(this.config),
      asOf: new Date().toISOString(),
      totalInventoryValue: totalInventoryValue.toFixed(2),
      stockValueByLocation: Object.entries(valueByLocation).map(
        ([locationId, data]) => ({
          locationId,
          locationName: data.name,
          value: data.value.toFixed(2),
        }),
      ),
      showroomCount: showrooms.length,
      dailySales: parseFloat(dailySales?.total ?? '0').toFixed(2),
      dailyPurchases: parseFloat(dailyPurchases?.total ?? '0').toFixed(2),
      profitAndLoss,
      financialOverview: {
        cashTotal: liquidityTotals.cashTotal,
        bankTotal: liquidityTotals.bankTotal,
        totalLiquidity: liquidityTotals.totalLiquidity,
        /** @deprecated use totalLiquidity */
        totalBankBalance: liquidityTotals.totalLiquidity,
        bankAccounts: bankAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          accountType: a.accountType,
          bankName: a.bankName,
          balance: a.balance,
          currencyCode: a.currencyCode,
        })),
      },
      period: {
        from: from ?? null,
        to: to ?? null,
      },
      pulse,
      traceability: {
        lotLinkedStockPercent,
        lotLinkedStockKg: linkedQty.toFixed(3),
        unlinkedStockKg: unlinkedQty.toFixed(3),
        qcHoldLots: parseInt(qcHold?.count ?? '0', 10),
        qcHoldKg: parseFloat(qcHold?.kg ?? '0').toFixed(3),
        shrinkageSignals,
      },
      commercial,
      contracts,
      recommendations,
      links: {
        collectionsToday: `/collections?from=${todayStr}`,
        processWip: '/process-runs?status=IN_PROGRESS',
        greenLots: '/lots?form=GREEN&status=ACTIVE',
        qcHoldLots: '/lots?status=HOLD',
        localSales: '/sales?channel=LOCAL',
        exportStaged: '/exports?status=STAGED',
        openContracts: '/exports',
        unlinkedInventory: '/inventory',
        notifications: '/notifications',
        reports: '/reports',
        profitLoss: '/profit-loss',
      },
    };
  }

  private async buildPulse(today: Date, tomorrow: Date, todayStr: string) {
    const intake = await this.collectionRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.weight_kg::numeric), 0)', 'kg')
      .where('c.created_at >= :start AND c.created_at < :end', {
        start: today,
        end: tomorrow,
      })
      .andWhere('c.status = :status', { status: DocumentStatus.ACTIVE })
      .getRawOne<{ kg: string }>();

    const wipStatuses = [
      ProcessRunStatus.IN_PROGRESS,
      ProcessRunStatus.QC_HOLD,
      ProcessRunStatus.READY,
    ];
    const wip = await this.processRunRepo
      .createQueryBuilder('run')
      .select('COUNT(*)', 'runs')
      .addSelect('COALESCE(SUM(run.quantity_input::numeric), 0)', 'kg')
      .where('run.status IN (:...statuses)', { statuses: wipStatuses })
      .getRawOne<{ runs: string; kg: string }>();

    const green = await this.lotRepo
      .createQueryBuilder('lot')
      .select('COALESCE(SUM(lot.quantity::numeric), 0)', 'kg')
      .where('lot.form = :form', { form: CoffeeForm.GREEN })
      .andWhere('lot.status = :status', { status: LotStatus.ACTIVE })
      .getRawOne<{ kg: string }>();

    const roastToday = await this.lotRepo
      .createQueryBuilder('lot')
      .select('COALESCE(SUM(lot.quantity::numeric), 0)', 'kg')
      .where('lot.form IN (:...forms)', {
        forms: [CoffeeForm.ROASTED, CoffeeForm.PACKAGED],
      })
      .andWhere('lot.roast_date = :today', { today: todayStr })
      .getRawOne<{ kg: string }>();

    const localSales = await this.saleRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.total::numeric), 0)', 'total')
      .where('s.created_at >= :start AND s.created_at < :end', {
        start: today,
        end: tomorrow,
      })
      .andWhere('s.status = :status', { status: DocumentStatus.ACTIVE })
      .andWhere('s.channel = :channel', { channel: SaleChannel.LOCAL })
      .getRawOne<{ total: string }>();

    const staged = await this.exportRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.allocated_kg::numeric), 0)', 'kg')
      .where('c.status = :status', { status: ExportContractStatus.STAGED })
      .getRawOne<{ kg: string }>();

    const openAlerts = await this.notificationRepo.count({
      where: { isRead: false },
    });

    return {
      intakeKgToday: parseFloat(intake?.kg ?? '0').toFixed(3),
      processWipKg: parseFloat(wip?.kg ?? '0').toFixed(3),
      processWipRuns: parseInt(wip?.runs ?? '0', 10),
      greenStockKg: parseFloat(green?.kg ?? '0').toFixed(3),
      roastOutputKgToday: parseFloat(roastToday?.kg ?? '0').toFixed(3),
      localSalesToday: parseFloat(localSales?.total ?? '0').toFixed(2),
      exportStagedKg: parseFloat(staged?.kg ?? '0').toFixed(3),
      openAlerts,
    };
  }

  private async buildCommercial(
    from: string | undefined,
    to: string | undefined,
    totalLiquidity: string,
  ) {
    const channelRevenue = async (channel: SaleChannel) => {
      const qb = this.saleRepo
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.total::numeric), 0)', 'total')
        .where('s.status = :status', { status: DocumentStatus.ACTIVE })
        .andWhere('s.channel = :channel', { channel });
      applyDateRangeToQb(qb, 's.created_at', from, to);
      const row = await qb.getRawOne<{ total: string }>();
      return parseFloat(row?.total ?? '0').toFixed(2);
    };

    const [localRevenue, exportRevenue, customerCredit, supplierCredit] =
      await Promise.all([
        channelRevenue(SaleChannel.LOCAL),
        channelRevenue(SaleChannel.EXPORT),
        this.customerCreditRepo
          .createQueryBuilder('c')
          .select('COALESCE(SUM(c.balance::numeric), 0)', 'total')
          .where('c.status IN (:...statuses)', {
            statuses: [CreditStatus.OPEN, CreditStatus.PARTIAL],
          })
          .getRawOne<{ total: string }>(),
        this.supplierCreditRepo
          .createQueryBuilder('c')
          .select('COALESCE(SUM(c.balance::numeric), 0)', 'total')
          .where('c.status IN (:...statuses)', {
            statuses: [CreditStatus.OPEN, CreditStatus.PARTIAL],
          })
          .getRawOne<{ total: string }>(),
      ]);

    return {
      localRevenue,
      exportRevenue,
      customerCreditOutstanding: parseFloat(
        customerCredit?.total ?? '0',
      ).toFixed(2),
      supplierCreditOutstanding: parseFloat(
        supplierCredit?.total ?? '0',
      ).toFixed(2),
      totalLiquidity,
    };
  }

  private async buildContracts(today: Date) {
    const openStatuses = [
      ExportContractStatus.DRAFT,
      ExportContractStatus.ALLOCATED,
      ExportContractStatus.STAGED,
    ];
    const open = await this.exportRepo.find({
      where: { status: In(openStatuses) },
      order: { windowEnd: 'ASC' },
    });

    let openVolumeKg = 0;
    let allocatedKg = 0;
    const shipWindowRisk: Array<{
      contractId: string;
      contractNumber: string;
      windowEnd: string | null;
      daysRemaining: number | null;
      unallocatedKg: string;
      status: ExportContractStatus;
    }> = [];
    const missingDocs: Array<{
      contractId: string;
      contractNumber: string;
      missing: string[];
    }> = [];

    for (const c of open) {
      const vol = parseFloat(c.volumeKg);
      const alloc = parseFloat(c.allocatedKg);
      openVolumeKg += vol;
      allocatedKg += alloc;
      const unallocated = Math.max(0, vol - alloc);

      let daysRemaining: number | null = null;
      if (c.windowEnd) {
        const end = new Date(c.windowEnd);
        end.setHours(0, 0, 0, 0);
        daysRemaining = Math.ceil(
          (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysRemaining <= 14 && unallocated > 0.001) {
          shipWindowRisk.push({
            contractId: c.id,
            contractNumber: c.contractNumber,
            windowEnd: c.windowEnd,
            daysRemaining,
            unallocatedKg: unallocated.toFixed(3),
            status: c.status,
          });
        }
      }

      const checklist = (c.docChecklist ?? []) as ExportDocCheckItem[];
      const missing = checklist.filter((d) => !d.done).map((d) => d.label);
      if (
        missing.length > 0 &&
        (c.status === ExportContractStatus.ALLOCATED ||
          c.status === ExportContractStatus.STAGED)
      ) {
        missingDocs.push({
          contractId: c.id,
          contractNumber: c.contractNumber,
          missing,
        });
      }
    }

    const coveragePercent =
      openVolumeKg > 0
        ? Number(((allocatedKg / openVolumeKg) * 100).toFixed(1))
        : 0;

    return {
      openContracts: open.length,
      openVolumeKg: openVolumeKg.toFixed(3),
      allocatedKg: allocatedKg.toFixed(3),
      coveragePercent,
      shipWindowRisk: shipWindowRisk.slice(0, 8),
      missingDocs: missingDocs.slice(0, 8),
    };
  }

  private buildRecommendations(input: {
    contracts: Awaited<ReturnType<DashboardService['buildContracts']>>;
    shrinkageSignals: Array<{
      processRunId: string;
      runNumber: string;
      variancePercent: number;
    }>;
    highMoisture: Lot[];
    lotLinkedStockPercent: number;
    unlinkedKg: number;
    pulse: { greenStockKg: string; processWipRuns: number };
  }): Recommendation[] {
    const out: Recommendation[] = [];

    for (const risk of input.contracts.shipWindowRisk) {
      out.push({
        id: `ship-${risk.contractId}`,
        severity: (risk.daysRemaining ?? 99) <= 7 ? 'critical' : 'warn',
        code: 'SHIP_WINDOW',
        title: `Cover ${risk.contractNumber} before window closes`,
        detail: `${risk.unallocatedKg} kg still unallocated · ${risk.daysRemaining ?? '?'} days left`,
        href: `/exports/${risk.contractId}`,
      });
    }

    for (const doc of input.contracts.missingDocs) {
      out.push({
        id: `docs-${doc.contractId}`,
        severity: 'warn',
        code: 'MISSING_DOCS',
        title: `Complete dossier for ${doc.contractNumber}`,
        detail: `Missing: ${doc.missing.slice(0, 3).join(', ')}`,
        href: `/exports/${doc.contractId}`,
      });
    }

    for (const s of input.shrinkageSignals.slice(0, 3)) {
      out.push({
        id: `shrink-${s.processRunId}`,
        severity: s.variancePercent <= -10 ? 'critical' : 'warn',
        code: 'SHRINKAGE',
        title: `Yield shortfall on ${s.runNumber}`,
        detail: `Actual vs expected: ${s.variancePercent}%`,
        href: `/process-runs/${s.processRunId}`,
      });
    }

    for (const lot of input.highMoisture) {
      const moisture = lot.moisturePercent
        ? parseFloat(lot.moisturePercent)
        : null;
      if (moisture == null || moisture < 12.5) continue;
      out.push({
        id: `moist-${lot.id}`,
        severity: moisture >= 13.5 ? 'critical' : 'warn',
        code: 'MOISTURE_RISK',
        title: `Prioritize ${lot.code} (moisture risk)`,
        detail: `${moisture}% moisture · ${lot.quantity} kg ${lot.form}`,
        href: `/lots/${lot.id}`,
      });
      if (out.filter((r) => r.code === 'MOISTURE_RISK').length >= 3) break;
    }

    if (input.lotLinkedStockPercent < 95 && input.unlinkedKg > 0) {
      out.push({
        id: 'unlink-stock',
        severity: 'info',
        code: 'LOT_LINK',
        title: 'Lot-link remaining coffee stock',
        detail: `${input.unlinkedKg.toFixed(0)} kg coffee stock without lot · ${input.lotLinkedStockPercent}% linked`,
        href: '/inventory',
      });
    }

    if (
      parseFloat(input.pulse.greenStockKg) > 0 &&
      input.contracts.openContracts > 0 &&
      input.contracts.coveragePercent < 80
    ) {
      out.push({
        id: 'allocate-green',
        severity: 'info',
        code: 'ALLOCATE_TO_CONTRACT',
        title: 'Allocate green stock to open contracts',
        detail: `${input.pulse.greenStockKg} kg green available · coverage ${input.contracts.coveragePercent}%`,
        href: '/exports',
      });
    }

    const severityRank = { critical: 0, warn: 1, info: 2 };
    return out
      .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
      .slice(0, 12);
  }

  private async computeProfitSummary(from?: string, to?: string) {
    const saleLinesQb = this.saleLineRepo
      .createQueryBuilder('line')
      .innerJoin('line.sale', 'sale')
      .andWhere('sale.status = :status', { status: DocumentStatus.ACTIVE });
    applyDateRangeToQb(saleLinesQb, 'sale.created_at', from, to);
    const lines = await saleLinesQb.getMany();

    let revenue = 0;
    let cost = 0;
    for (const line of lines) {
      revenue += parseFloat(line.lineTotal);
      cost += parseFloat(line.quantity) * parseFloat(line.purchaseCost);
    }

    const expenseQb = this.expenseRepo.createQueryBuilder('expense');
    applyDateRangeToQb(expenseQb, 'expense.expense_date', from, to);
    const expenses = await expenseQb.getMany();
    const totalExpenses = expenses.reduce(
      (sum, e) => sum + parseFloat(e.amount),
      0,
    );

    const grossProfit = revenue - cost;
    const netProfit = grossProfit - totalExpenses;
    return {
      revenue: revenue.toFixed(2),
      costOfGoodsSold: cost.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netProfit: netProfit.toFixed(2),
    };
  }
}
