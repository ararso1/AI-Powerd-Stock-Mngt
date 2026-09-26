import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { getAppCurrency } from '../common/utils/currency.util';
import { applyDateRangeToQb } from '../common/utils/query.util';
import {
  CoffeeForm,
  CreditStatus,
  DocumentStatus,
  ExportContractStatus,
  LocationType,
  LotStatus,
  ProcessRunStatus,
  PurchaseType,
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
import { ProcessTemplate } from '../database/entities/process-template.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleLine } from '../database/entities/sale-line.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { SupplierCredit } from '../database/entities/supplier-credit.entity';
import { MarketPricesService } from '../market-prices/market-prices.service';

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
    private readonly marketPrices: MarketPricesService,
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

  /**
   * Local roast / domestic market dashboard.
   * Intake → process → roast → local sales, quality, production, domestic finance.
   */
  async getLocalOverview(from?: string, to?: string) {
    const overview = await this.getOverview(from, to);
    const fromIso = overview.period?.from ?? from ?? undefined;
    const toIso = overview.period?.to ?? to ?? undefined;
    const localPnl = await this.computeProfitSummary(
      fromIso ?? undefined,
      toIso ?? undefined,
      SaleChannel.LOCAL,
    );

    const roastedStock = await this.lotRepo
      .createQueryBuilder('lot')
      .select('COALESCE(SUM(lot.quantity::numeric), 0)', 'kg')
      .where('lot.form IN (:...forms)', {
        forms: [CoffeeForm.ROASTED, CoffeeForm.PACKAGED, CoffeeForm.FLOUR],
      })
      .andWhere('lot.status = :status', { status: LotStatus.ACTIVE })
      .getRawOne<{ kg: string }>();

    const localCodes = new Set([
      'SHRINKAGE',
      'MOISTURE_RISK',
      'LOT_LINK',
    ]);
    const recommendations = (overview.recommendations ?? []).filter((r) =>
      localCodes.has(r.code),
    );
    const executiveInsights = (overview.executiveInsights ?? []).filter(
      (c) =>
        c.category === 'Stock' ||
        c.category === 'Credit' ||
        c.category === 'Quality' ||
        c.href.includes('/sales') ||
        c.href.includes('/collections') ||
        c.href.includes('/process') ||
        c.href.includes('/credits') ||
        c.href.includes('/inventory') ||
        c.href.includes('/lots'),
    ).filter((c) => c.category !== 'Export' && c.id !== 'exec-profit-mix');

    // Prefer a local-channel profit insight when we have local margin.
    const localGross = parseFloat(localPnl.grossProfit);
    if (localGross !== 0) {
      executiveInsights.unshift({
        id: 'local-profit',
        tone: localGross >= 0 ? 'profit' : 'warn',
        category: 'Profit',
        title: `Local channel gross profit is ${localGross.toLocaleString()} ETB for the period.`,
        detail: `Revenue ${localPnl.revenue} · COGS ${localPnl.costOfGoodsSold}`,
        href: '/sales?channel=LOCAL',
      });
    }

    const analytics = overview.analytics;
    return {
      channel: 'LOCAL' as const,
      currency: overview.currency,
      asOf: overview.asOf,
      period: overview.period,
      totalInventoryValue: overview.totalInventoryValue,
      stockValueByLocation: overview.stockValueByLocation,
      showroomCount: overview.showroomCount,
      dailySales: overview.pulse?.localSalesToday ?? overview.dailySales,
      dailyPurchases: overview.dailyPurchases,
      profitAndLoss: localPnl,
      financialOverview: overview.financialOverview,
      pulse: overview.pulse
        ? {
            intakeKgToday: overview.pulse.intakeKgToday,
            processWipKg: overview.pulse.processWipKg,
            processWipRuns: overview.pulse.processWipRuns,
            roastOutputKgToday: overview.pulse.roastOutputKgToday,
            localSalesToday: overview.pulse.localSalesToday,
            roastedStockKg: parseFloat(roastedStock?.kg ?? '0').toFixed(3),
            openAlerts: overview.pulse.openAlerts,
            greenStockKg: overview.pulse.greenStockKg,
          }
        : null,
      traceability: overview.traceability,
      commercial: overview.commercial
        ? {
            localRevenue: overview.commercial.localRevenue,
            customerCreditOutstanding:
              overview.commercial.customerCreditOutstanding,
            supplierCreditOutstanding:
              overview.commercial.supplierCreditOutstanding,
            totalLiquidity: overview.commercial.totalLiquidity,
          }
        : null,
      analytics: analytics
        ? {
            inventory: {
              totalStockKg: analytics.inventory.totalStockKg,
              stockValue: analytics.inventory.stockValue,
              availableKg: analytics.inventory.availableKg,
              reservedKg: analytics.inventory.reservedKg,
              lowStockItems: analytics.inventory.lowStockItems,
            },
            trading: {
              totalPurchases: analytics.trading.totalPurchases,
              localSalesValue: analytics.trading.localSalesValue,
              salesVolumeKg: analytics.trading.localSalesVolumeKg,
              salesValue: analytics.trading.localSalesValue,
              chart: [
                {
                  label: 'Local sales',
                  value: Number(analytics.trading.localSalesValue),
                },
                {
                  label: 'Purchases',
                  value: Number(analytics.trading.totalPurchases),
                },
              ],
            },
            quality: analytics.quality,
            finance: analytics.finance,
            production: analytics.production,
          }
        : null,
      recommendations: recommendations.slice(0, 12),
      executiveInsights: executiveInsights.slice(0, 6),
      links: {
        collectionsToday: overview.links?.collectionsToday,
        processWip: overview.links?.processWip,
        greenLots: overview.links?.greenLots,
        qcHoldLots: overview.links?.qcHoldLots,
        localSales: overview.links?.localSales,
        unlinkedInventory: overview.links?.unlinkedInventory,
        notifications: overview.links?.notifications,
        reports: overview.links?.reports,
        profitLoss: overview.links?.profitLoss,
        insights: overview.links?.insights,
        credits: overview.links?.credits,
      },
    };
  }

  /**
   * Export / green coffee dashboard.
   * Green stock → contracts → allocate/stage/ship → market & FX.
   */
  async getExportOverview(from?: string, to?: string) {
    const overview = await this.getOverview(from, to);
    const fromIso = overview.period?.from ?? from ?? undefined;
    const toIso = overview.period?.to ?? to ?? undefined;
    const exportPnl = await this.computeProfitSummary(
      fromIso ?? undefined,
      toIso ?? undefined,
      SaleChannel.EXPORT,
    );
    const pipeline = await this.buildExportPipeline();

    const exportCodes = new Set([
      'SHIP_WINDOW',
      'MISSING_DOCS',
      'ALLOCATE_TO_CONTRACT',
      'MOISTURE_RISK',
    ]);
    const recommendations = (overview.recommendations ?? []).filter((r) =>
      exportCodes.has(r.code),
    );
    const executiveInsights = (overview.executiveInsights ?? []).filter(
      (c) =>
        c.category === 'Export' ||
        c.category === 'Profit' ||
        c.category === 'Stock' ||
        c.href.includes('/exports') ||
        c.href.includes('/market'),
    );

    const exportGross = parseFloat(exportPnl.grossProfit);
    if (exportGross !== 0) {
      executiveInsights.unshift({
        id: 'export-profit',
        tone: exportGross >= 0 ? 'profit' : 'warn',
        category: 'Profit',
        title: `Export channel gross profit is ${exportGross.toLocaleString()} ETB for the period.`,
        detail: `Revenue ${exportPnl.revenue} · COGS ${exportPnl.costOfGoodsSold}`,
        href: '/exports',
      });
    }

    const analytics = overview.analytics;
    const exportSalesQb = this.saleRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.total::numeric), 0)', 'total')
      .where('s.status = :status', { status: DocumentStatus.ACTIVE })
      .andWhere('s.channel = :channel', { channel: SaleChannel.EXPORT });
    applyDateRangeToQb(exportSalesQb, 's.created_at', fromIso, toIso);
    const exportSalesPeriod = await exportSalesQb.getRawOne<{ total: string }>();

    return {
      channel: 'EXPORT' as const,
      currency: overview.currency,
      asOf: overview.asOf,
      period: overview.period,
      totalInventoryValue: overview.totalInventoryValue,
      stockValueByLocation: overview.stockValueByLocation,
      dailySales: parseFloat(exportSalesPeriod?.total ?? '0').toFixed(2),
      profitAndLoss: exportPnl,
      financialOverview: overview.financialOverview,
      pulse: overview.pulse
        ? {
            greenStockKg: overview.pulse.greenStockKg,
            exportStagedKg: overview.pulse.exportStagedKg,
            openAlerts: overview.pulse.openAlerts,
            exportSalesToday: parseFloat(
              exportSalesPeriod?.total ?? '0',
            ).toFixed(2),
          }
        : null,
      contracts: overview.contracts,
      pipeline,
      commercial: overview.commercial
        ? {
            exportRevenue: overview.commercial.exportRevenue,
            customerCreditOutstanding:
              overview.commercial.customerCreditOutstanding,
            totalLiquidity: overview.commercial.totalLiquidity,
            outstandingExportPayments:
              analytics?.export.outstandingExportPayments ?? '0.00',
          }
        : null,
      analytics: analytics
        ? {
            inventory: {
              totalStockKg: analytics.inventory.totalStockKg,
              stockValue: analytics.inventory.stockValue,
              availableKg: analytics.inventory.availableKg,
              reservedKg: analytics.inventory.reservedKg,
              exportStockKg: analytics.inventory.exportStockKg,
            },
            trading: {
              exportSalesValue: analytics.trading.exportSalesValue,
              salesVolumeKg: analytics.trading.exportSalesVolumeKg,
              salesValue: analytics.trading.exportSalesValue,
              chart: [
                {
                  label: 'Export sales',
                  value: Number(analytics.trading.exportSalesValue),
                },
                {
                  label: 'Shipped value',
                  value: Number(analytics.export.exportValue),
                },
              ],
            },
            export: analytics.export,
          }
        : null,
      market: overview.market,
      recommendations: recommendations.slice(0, 12),
      executiveInsights: executiveInsights.slice(0, 6),
      links: {
        greenLots: overview.links?.greenLots,
        exportStaged: overview.links?.exportStaged,
        openContracts: overview.links?.openContracts,
        notifications: overview.links?.notifications,
        reports: overview.links?.reports,
        profitLoss: overview.links?.profitLoss,
        insights: overview.links?.insights,
        credits: overview.links?.credits,
        marketPrices: overview.links?.marketPrices,
      },
    };
  }

  private async buildExportPipeline() {
    const rows = await this.exportRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(c.volume_kg::numeric), 0)', 'volumeKg')
      .addSelect('COALESCE(SUM(c.allocated_kg::numeric), 0)', 'allocatedKg')
      .addSelect('COALESCE(SUM(c.shipped_kg::numeric), 0)', 'shippedKg')
      .groupBy('c.status')
      .getRawMany<{
        status: string;
        count: string;
        volumeKg: string;
        allocatedKg: string;
        shippedKg: string;
      }>();

    const byStatus: Record<
      string,
      { count: number; volumeKg: string; allocatedKg: string; shippedKg: string }
    > = {};
    for (const r of rows) {
      byStatus[r.status] = {
        count: parseInt(r.count, 10),
        volumeKg: parseFloat(r.volumeKg).toFixed(3),
        allocatedKg: parseFloat(r.allocatedKg).toFixed(3),
        shippedKg: parseFloat(r.shippedKg).toFixed(3),
      };
    }

    const chart = [
      ExportContractStatus.DRAFT,
      ExportContractStatus.ALLOCATED,
      ExportContractStatus.STAGED,
      ExportContractStatus.SHIPPED,
      ExportContractStatus.DELIVERED,
      ExportContractStatus.CLOSED,
    ].map((status) => ({
      label: status,
      value: byStatus[status]?.count ?? 0,
      kg: Number(byStatus[status]?.volumeKg ?? 0),
    }));

    return { byStatus, chart };
  }

  async getOverview(from?: string, to?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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
      .where('s.status = :status', { status: DocumentStatus.ACTIVE });
    applyDateRangeToQb(dailySalesQb, 's.created_at', from, to);
    const dailySales = await dailySalesQb.getRawOne<{ total: string }>();

    const dailyPurchasesQb = this.purchaseRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.total::numeric), 0)', 'total')
      .where('p.status = :status', { status: DocumentStatus.ACTIVE });
    applyDateRangeToQb(dailyPurchasesQb, 'p.created_at', from, to);
    const dailyPurchases = await dailyPurchasesQb.getRawOne<{ total: string }>();

    const profitAndLoss = await this.computeProfitSummary(from, to);

    const bankAccounts = await this.bankRepo.find({
      where: { isActive: true },
      order: { accountType: 'ASC', name: 'ASC' },
    });
    const liquidityTotals =
      this.banksService.computeLiquidityTotals(bankAccounts);

    const showrooms = await this.locationRepo.find({
      where: { type: LocationType.SHOWROOM, isActive: true },
    });

    const fromIso = from;
    const toIso = to;

    const [
      pulse,
      commercial,
      contracts,
      qcHold,
      shrinkage,
      highMoisture,
    ] = await Promise.all([
      this.buildPulse(fromIso, toIso),
      this.buildCommercial(fromIso, toIso, liquidityTotals.totalLiquidity),
      this.buildContracts(today),
      this.lotRepo
        .createQueryBuilder('lot')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(lot.quantity::numeric), 0)', 'kg')
        .where('lot.status = :status', { status: LotStatus.HOLD })
        .getRawOne<{ count: string; kg: string }>(),
      (async () => {
        const qb = this.processRunRepo
          .createQueryBuilder('run')
          .leftJoinAndSelect('run.template', 'template')
          .where('run.status = :status', {
            status: ProcessRunStatus.COMPLETED,
          })
          .orderBy('run.completed_at', 'DESC')
          .take(40);
        applyDateRangeToQb(qb, 'run.completed_at', fromIso, toIso);
        return qb.getMany();
      })(),
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

    const [analytics, executiveInsights, market] = await Promise.all([
      this.buildAnalytics(stocks, fromIso, toIso, todayStr),
      this.buildExecutiveInsights(fromIso, toIso, todayStr, profitAndLoss),
      this.marketPrices.getDashboardMarket().catch((err) => {
        // Keep dashboard resilient if market feed is mid-sync.
        // eslint-disable-next-line no-console
        console.warn(
          `Dashboard market widget skipped: ${err instanceof Error ? err.message : err}`,
        );
        return null;
      }),
    ]);

    const collectionsLink =
      fromIso || toIso
        ? `/collections?${[
            fromIso ? `from=${fromIso}` : null,
            toIso ? `to=${toIso}` : null,
          ]
            .filter(Boolean)
            .join('&')}`
        : '/collections';

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
      analytics,
      executiveInsights,
      market,
      links: {
        collectionsToday: collectionsLink,
        processWip: '/process-runs?status=IN_PROGRESS',
        greenLots: '/lots?form=GREEN&status=ACTIVE',
        qcHoldLots: '/lots?status=HOLD',
        localSales: '/sales?channel=LOCAL',
        localPurchases: '/purchases?purchaseType=LOCAL',
        exportPurchases: '/purchases?purchaseType=EXPORT',
        exportStaged: '/exports?status=STAGED',
        openContracts: '/exports',
        unlinkedInventory: '/inventory',
        notifications: '/notifications',
        reports: '/reports',
        profitLoss: '/profit-loss',
        insights: '/insights',
        credits: '/credits',
        marketPrices: '/market-prices',
      },
    };
  }

  private async buildPulse(from?: string, to?: string) {
    const intakeQb = this.collectionRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.weight_kg::numeric), 0)', 'kg')
      .where('c.status = :status', { status: DocumentStatus.ACTIVE });
    applyDateRangeToQb(intakeQb, 'c.created_at', from, to);
    const intake = await intakeQb.getRawOne<{ kg: string }>();

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

    const roastQb = this.lotRepo
      .createQueryBuilder('lot')
      .select('COALESCE(SUM(lot.quantity::numeric), 0)', 'kg')
      .where('lot.form IN (:...forms)', {
        forms: [CoffeeForm.ROASTED, CoffeeForm.PACKAGED],
      });
    applyDateRangeToQb(roastQb, 'lot.roast_date', from, to);
    const roastOutput = await roastQb.getRawOne<{ kg: string }>();

    const localSalesQb = this.saleRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.total::numeric), 0)', 'total')
      .where('s.status = :status', { status: DocumentStatus.ACTIVE })
      .andWhere('s.channel = :channel', { channel: SaleChannel.LOCAL });
    applyDateRangeToQb(localSalesQb, 's.created_at', from, to);
    const localSales = await localSalesQb.getRawOne<{ total: string }>();

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
      roastOutputKgToday: parseFloat(roastOutput?.kg ?? '0').toFixed(3),
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

  private async computeProfitSummary(
    from?: string,
    to?: string,
    channel?: SaleChannel,
  ) {
    const saleLinesQb = this.saleLineRepo
      .createQueryBuilder('line')
      .innerJoin('line.sale', 'sale')
      .andWhere('sale.status = :status', { status: DocumentStatus.ACTIVE });
    if (channel) {
      saleLinesQb.andWhere('sale.channel = :channel', { channel });
    }
    applyDateRangeToQb(saleLinesQb, 'sale.created_at', from, to);
    const lines = await saleLinesQb.getMany();

    let revenue = 0;
    let cost = 0;
    for (const line of lines) {
      revenue += parseFloat(line.lineTotal);
      cost += parseFloat(line.quantity) * parseFloat(line.purchaseCost);
    }

    // Expenses are company-wide; only attribute them on the combined overview.
    let totalExpenses = 0;
    if (!channel) {
      const expenseQb = this.expenseRepo.createQueryBuilder('expense');
      applyDateRangeToQb(expenseQb, 'expense.expense_date', from, to);
      const expenses = await expenseQb.getMany();
      totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    }

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

  private async buildAnalytics(
    stocks: StockLevel[],
    from: string | undefined,
    to: string | undefined,
    todayStr: string,
  ) {
    let totalStockKg = 0;
    let availableKg = 0;
    let reservedKg = 0;
    let stockValue = 0;
    let lowStockItems = 0;

    for (const s of stocks) {
      const qty = parseFloat(s.quantity);
      const reserved = parseFloat(s.reservedQuantity ?? '0');
      totalStockKg += qty;
      reservedKg += reserved;
      availableKg += Math.max(0, qty - reserved);
      stockValue += qty * parseFloat(s.purchasePrice);
      const reorder = s.reorderPoint != null ? parseFloat(s.reorderPoint) : null;
      if (reorder != null && qty <= reorder) lowStockItems += 1;
    }

    const exportStock = await this.exportRepo
      .createQueryBuilder('c')
      .select(
        `COALESCE(SUM(CASE WHEN c.status IN ('ALLOCATED','STAGED') THEN c.allocated_kg::numeric ELSE 0 END), 0)`,
        'reservedExport',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN c.status IN ('SHIPPED','DELIVERED','CLOSED') THEN c.shipped_kg::numeric ELSE 0 END), 0)`,
        'shippedAll',
      )
      .getRawOne<{ reservedExport: string; shippedAll: string }>();

    const purchasesQb = this.purchaseRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.total::numeric), 0)', 'total')
      .where('p.status = :status', { status: DocumentStatus.ACTIVE })
      .andWhere('p.purchase_type = :purchaseType', {
        purchaseType: PurchaseType.LOCAL,
      });
    applyDateRangeToQb(purchasesQb, 'p.created_at', from, to);
    const purchases = await purchasesQb.getRawOne<{ total: string }>();

    const salesByChannel = await this.saleLineRepo
      .createQueryBuilder('line')
      .innerJoin('line.sale', 'sale')
      .select('sale.channel', 'channel')
      .addSelect('COALESCE(SUM(line.quantity::numeric), 0)', 'volumeKg')
      .addSelect('COALESCE(SUM(line."lineTotal"::numeric), 0)', 'value')
      .where('sale.status = :status', { status: DocumentStatus.ACTIVE })
      .groupBy('sale.channel');
    applyDateRangeToQb(salesByChannel, 'sale.created_at', from, to);
    const channelRows = await salesByChannel.getRawMany<{
      channel: string;
      volumeKg: string;
      value: string;
    }>();

    let localSalesValue = 0;
    let exportSalesValue = 0;
    let localSalesVolume = 0;
    let exportSalesVolume = 0;
    for (const r of channelRows) {
      if (r.channel === SaleChannel.EXPORT) {
        exportSalesValue += Number(r.value) || 0;
        exportSalesVolume += Number(r.volumeKg) || 0;
      } else {
        localSalesValue += Number(r.value) || 0;
        localSalesVolume += Number(r.volumeKg) || 0;
      }
    }

    const qualityQb = this.collectionRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.accepted_weight_kg::numeric), 0)', 'accepted')
      .addSelect('COALESCE(SUM(c.rejected_weight_kg::numeric), 0)', 'rejected')
      .addSelect('COALESCE(SUM(c.weight_kg::numeric), 0)', 'total')
      .where('c.status = :status', { status: DocumentStatus.ACTIVE });
    applyDateRangeToQb(qualityQb, 'c.created_at', from, to);
    const quality = await qualityQb.getRawOne<{
      accepted: string;
      rejected: string;
      total: string;
    }>();
    const acceptedQty = Number(quality?.accepted ?? 0);
    const rejectedQty = Number(quality?.rejected ?? 0);
    const qualityTotal = acceptedQty + rejectedQty || Number(quality?.total ?? 0);
    const rejectionPercent =
      qualityTotal > 0 ? (rejectedQty / qualityTotal) * 100 : 0;

    const gradeRows = await this.lotRepo
      .createQueryBuilder('l')
      .select(`COALESCE(NULLIF(TRIM(l.grade), ''), 'Ungraded')`, 'grade')
      .addSelect('COALESCE(SUM(l.quantity::numeric), 0)', 'kg')
      .where('l.status = :st', { st: LotStatus.ACTIVE })
      .andWhere('l.form = :form', { form: CoffeeForm.GREEN })
      .groupBy('grade')
      .orderBy('kg', 'DESC')
      .getRawMany<{ grade: string; kg: string }>();

    const supplierQuality = await this.collectionRepo
      .createQueryBuilder('c')
      .innerJoin(Supplier, 'sup', 'sup.id = c.supplier_id')
      .select('sup.name', 'supplierName')
      .addSelect('COALESCE(SUM(c.weight_kg::numeric), 0)', 'totalKg')
      .addSelect(
        'COALESCE(SUM(c.rejected_weight_kg::numeric), 0)',
        'rejectedKg',
      )
      .where('c.status = :status', { status: DocumentStatus.ACTIVE })
      .groupBy('sup.name');
    applyDateRangeToQb(supplierQuality, 'c.created_at', from, to);
    const supplierRows = await supplierQuality.getRawMany<{
      supplierName: string;
      totalKg: string;
      rejectedKg: string;
    }>();
    const supplierRanking = supplierRows
      .map((r) => {
        const total = Number(r.totalKg) || 0;
        const rejected = Number(r.rejectedKg) || 0;
        return {
          supplierName: r.supplierName,
          totalKg: total.toFixed(3),
          rejectedKg: rejected.toFixed(3),
          rejectionPercent:
            total > 0 ? Number(((rejected / total) * 100).toFixed(1)) : 0,
        };
      })
      .filter((r) => Number(r.totalKg) > 0)
      .sort((a, b) => a.rejectionPercent - b.rejectionPercent)
      .slice(0, 8);

    const customerOpen = await this.customerCreditRepo
      .createQueryBuilder('c')
      .select(
        `COALESCE(SUM(CASE WHEN c.status != 'PAID' THEN c.balance::numeric ELSE 0 END), 0)`,
        'outstanding',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN c.status != 'PAID' AND c."dueDate" IS NOT NULL AND c."dueDate" < :today THEN c.balance::numeric ELSE 0 END), 0)`,
        'overdue',
      )
      .addSelect(
        `COALESCE(SUM(c.paid_amount::numeric), 0)`,
        'paid',
      )
      .addSelect(`COALESCE(SUM(c.amount::numeric), 0)`, 'invoiced')
      .setParameter('today', todayStr)
      .getRawOne<{
        outstanding: string;
        overdue: string;
        paid: string;
        invoiced: string;
      }>();

    const supplierOpen = await this.supplierCreditRepo
      .createQueryBuilder('c')
      .select(
        `COALESCE(SUM(CASE WHEN c.status != 'PAID' THEN c.balance::numeric ELSE 0 END), 0)`,
        'outstanding',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN c.status != 'PAID' AND c."dueDate" IS NOT NULL AND c."dueDate" < :today THEN c.balance::numeric ELSE 0 END), 0)`,
        'overdue',
      )
      .setParameter('today', todayStr)
      .getRawOne<{ outstanding: string; overdue: string }>();

    const processQb = this.processRunRepo
      .createQueryBuilder('run')
      .leftJoin(ProcessTemplate, 'tpl', 'tpl.id = run.template_id')
      .select('COALESCE(SUM(run.quantity_input::numeric), 0)', 'inputKg')
      .addSelect('COALESCE(SUM(run.quantity_output::numeric), 0)', 'outputKg')
      .addSelect('COALESCE(SUM(run.quantity_loss::numeric), 0)', 'lossKg')
      .addSelect(
        `COALESCE(SUM(CASE WHEN tpl.operation_type = 'ROAST' THEN run.quantity_output::numeric ELSE 0 END), 0)`,
        'roastKg',
      )
      .addSelect(
        `COALESCE(AVG(NULLIF(run.actual_yield_percent, NULL)::numeric), 0)`,
        'avgYield',
      )
      .where('run.status = :st', { st: ProcessRunStatus.COMPLETED });
    applyDateRangeToQb(processQb, 'run.completed_at', from, to);
    const process = await processQb.getRawOne<{
      inputKg: string;
      outputKg: string;
      lossKg: string;
      roastKg: string;
      avgYield: string;
    }>();

    const exportActive = await this.exportRepo.count({
      where: {
        status: In([
          ExportContractStatus.DRAFT,
          ExportContractStatus.ALLOCATED,
          ExportContractStatus.STAGED,
        ]),
      },
    });
    const pendingShipments = await this.exportRepo.count({
      where: {
        status: In([
          ExportContractStatus.ALLOCATED,
          ExportContractStatus.STAGED,
        ]),
      },
    });

    const exportShippedQb = this.exportRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.shipped_kg::numeric), 0)', 'kg')
      .addSelect(
        'COALESCE(SUM(c.shipped_kg::numeric * c.price_per_kg::numeric), 0)',
        'value',
      )
      .where('c.status IN (:...st)', {
        st: [
          ExportContractStatus.SHIPPED,
          ExportContractStatus.DELIVERED,
          ExportContractStatus.CLOSED,
        ],
      });
    applyDateRangeToQb(exportShippedQb, 'c.shipped_at', from, to);
    const exportShipped = await exportShippedQb.getRawOne<{
      kg: string;
      value: string;
    }>();

    const exportOutstanding = await this.saleRepo
      .createQueryBuilder('s')
      .leftJoin('s.credit', 'credit')
      .select(
        `COALESCE(SUM(CASE WHEN s.channel = 'EXPORT' AND credit.status IN ('OPEN','PARTIAL') THEN credit.balance::numeric ELSE 0 END), 0)`,
        'outstanding',
      )
      .getRawOne<{ outstanding: string }>();

    const salesVolume = localSalesVolume + exportSalesVolume;
    const salesValue = localSalesValue + exportSalesValue;

    return {
      inventory: {
        totalStockKg: totalStockKg.toFixed(3),
        stockValue: stockValue.toFixed(2),
        availableKg: availableKg.toFixed(3),
        reservedKg: reservedKg.toFixed(3),
        exportStockKg: parseFloat(
          exportStock?.reservedExport ?? '0',
        ).toFixed(3),
        lowStockItems,
      },
      trading: {
        totalPurchases: parseFloat(purchases?.total ?? '0').toFixed(2),
        localSalesValue: localSalesValue.toFixed(2),
        exportSalesValue: exportSalesValue.toFixed(2),
        localSalesVolumeKg: localSalesVolume.toFixed(3),
        exportSalesVolumeKg: exportSalesVolume.toFixed(3),
        salesVolumeKg: salesVolume.toFixed(3),
        salesValue: salesValue.toFixed(2),
        chart: [
          { label: 'Local', value: Number(localSalesValue.toFixed(2)) },
          { label: 'Export', value: Number(exportSalesValue.toFixed(2)) },
        ],
      },
      quality: {
        acceptedQtyKg: acceptedQty.toFixed(3),
        rejectedQtyKg: rejectedQty.toFixed(3),
        rejectionPercent: Number(rejectionPercent.toFixed(1)),
        gradeDistribution: gradeRows.map((g) => ({
          grade: g.grade,
          kg: Number(Number(g.kg).toFixed(3)),
        })),
        supplierRanking,
      },
      finance: {
        totalReceivables: parseFloat(
          customerOpen?.outstanding ?? '0',
        ).toFixed(2),
        totalPayables: parseFloat(supplierOpen?.outstanding ?? '0').toFixed(2),
        customerOutstanding: parseFloat(
          customerOpen?.outstanding ?? '0',
        ).toFixed(2),
        supplierOutstanding: parseFloat(
          supplierOpen?.outstanding ?? '0',
        ).toFixed(2),
        overdueBalances: (
          parseFloat(customerOpen?.overdue ?? '0') +
          parseFloat(supplierOpen?.overdue ?? '0')
        ).toFixed(2),
        paidAmount: parseFloat(customerOpen?.paid ?? '0').toFixed(2),
        unpaidAmount: parseFloat(customerOpen?.outstanding ?? '0').toFixed(2),
        chart: [
          {
            label: 'Paid',
            value: Number(parseFloat(customerOpen?.paid ?? '0').toFixed(2)),
          },
          {
            label: 'Unpaid',
            value: Number(
              parseFloat(customerOpen?.outstanding ?? '0').toFixed(2),
            ),
          },
        ],
      },
      production: {
        processingVolumeKg: parseFloat(process?.inputKg ?? '0').toFixed(3),
        roastingVolumeKg: parseFloat(process?.roastKg ?? '0').toFixed(3),
        productionYieldPercent: Number(
          parseFloat(process?.avgYield ?? '0').toFixed(1),
        ),
        processingLossKg: parseFloat(process?.lossKg ?? '0').toFixed(3),
        wastageKg: parseFloat(process?.lossKg ?? '0').toFixed(3),
        chart: [
          {
            label: 'Input',
            value: Number(parseFloat(process?.inputKg ?? '0').toFixed(3)),
          },
          {
            label: 'Output',
            value: Number(parseFloat(process?.outputKg ?? '0').toFixed(3)),
          },
          {
            label: 'Loss',
            value: Number(parseFloat(process?.lossKg ?? '0').toFixed(3)),
          },
        ],
      },
      export: {
        exportVolumeKg: parseFloat(exportShipped?.kg ?? '0').toFixed(3),
        exportValue: parseFloat(exportShipped?.value ?? '0').toFixed(2),
        activeContracts: exportActive,
        pendingShipments,
        shippedQuantityKg: parseFloat(exportShipped?.kg ?? '0').toFixed(3),
        outstandingExportPayments: parseFloat(
          exportOutstanding?.outstanding ?? '0',
        ).toFixed(2),
      },
    };
  }

  private async buildExecutiveInsights(
    from: string | undefined,
    to: string | undefined,
    todayStr: string,
    profitAndLoss: {
      revenue: string;
      costOfGoodsSold: string;
      grossProfit: string;
    },
  ) {
    type Card = {
      id: string;
      tone: 'positive' | 'critical' | 'warn' | 'info' | 'profit';
      category: string;
      title: string;
      detail: string;
      href: string;
    };
    const cards: Card[] = [];

    const greenLots = await this.lotRepo
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.quantity::numeric), 0)', 'kg')
      .where('l.form = :form', { form: CoffeeForm.GREEN })
      .andWhere('l.status = :st', { st: LotStatus.ACTIVE })
      .getRawOne<{ kg: string }>();
    const greenKg = Number(greenLots?.kg ?? 0);

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const burn = await this.saleLineRepo
      .createQueryBuilder('line')
      .innerJoin('line.sale', 'sale')
      .select('COALESCE(SUM(line.quantity::numeric), 0)', 'kg')
      .where('sale.created_at >= :since', { since: since30 })
      .andWhere('sale.status = :st', { st: DocumentStatus.ACTIVE })
      .getRawOne<{ kg: string }>();
    const dailyDemand = (Number(burn?.kg ?? 0) || 0) / 30;
    const daysSupport =
      dailyDemand > 0.01 ? Math.round(greenKg / dailyDemand) : null;
    if (daysSupport != null) {
      cards.push({
        id: 'exec-stock-days',
        tone: daysSupport < 14 ? 'critical' : daysSupport < 28 ? 'warn' : 'positive',
        category: 'Stock',
        title: `Current green stock can support approximately ${daysSupport} days of projected demand.`,
        detail: `${greenKg.toFixed(0)} kg green · ~${dailyDemand.toFixed(1)} kg/day burn`,
        href: '/inventory',
      });
    }

    const overdue = await this.customerCreditRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.customer_id)', 'customers')
      .addSelect('COALESCE(SUM(c.balance::numeric), 0)', 'total')
      .where('c.status != :paid', { paid: CreditStatus.PAID })
      .andWhere('c."dueDate" IS NOT NULL')
      .andWhere('c."dueDate" < :today', { today: todayStr })
      .andWhere('c.balance::numeric > 0')
      .getRawOne<{ customers: string; total: string }>();
    const overdueCustomers = parseInt(overdue?.customers ?? '0', 10);
    const overdueTotal = Number(overdue?.total ?? 0);
    if (overdueCustomers > 0) {
      cards.push({
        id: 'exec-credit-overdue',
        tone: 'critical',
        category: 'Credit',
        title: `${overdueCustomers} customer${overdueCustomers === 1 ? '' : 's'} have overdue balances totaling ${overdueTotal.toLocaleString()} ETB.`,
        detail: 'Open Credits desk to prioritize collections',
        href: '/credits?overdue=1',
      });
    }

    // Highly critical: outstanding customer credit aged 60+ days from sale/credit date
    const criticalRows = await this.customerCreditRepo
      .createQueryBuilder('c')
      .where('c.status != :paid', { paid: CreditStatus.PAID })
      .andWhere('c.balance::numeric > 0')
      .andWhere(`c.created_at::date <= (CURRENT_DATE - INTERVAL '61 days')`)
      .getMany();
    if (criticalRows.length > 0) {
      const critBalance = criticalRows.reduce(
        (s, r) => s + parseFloat(r.balance),
        0,
      );
      const critCustomers = new Set(criticalRows.map((r) => r.customerId)).size;
      cards.push({
        id: 'exec-credit-highly-critical',
        tone: 'critical',
        category: 'Credit',
        title: `${critCustomers} customer${critCustomers === 1 ? '' : 's'} have highly critical credit (60+ days) totaling ${critBalance.toLocaleString()} ETB.`,
        detail: 'Review customer profiles and chase collections immediately',
        href: '/customers',
      });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

    const rejThis = await this.collectionRepo
      .createQueryBuilder('c')
      .innerJoin(Supplier, 'sup', 'sup.id = c.supplier_id')
      .select('sup.name', 'name')
      .addSelect('COALESCE(SUM(c.weight_kg::numeric), 0)', 'total')
      .addSelect('COALESCE(SUM(c.rejected_weight_kg::numeric), 0)', 'rejected')
      .where('c.created_at >= :start', { start: monthStart })
      .groupBy('sup.name')
      .having('COALESCE(SUM(c.weight_kg::numeric), 0) > 0')
      .getRawMany<{ name: string; total: string; rejected: string }>();

    const rejPrev = await this.collectionRepo
      .createQueryBuilder('c')
      .innerJoin(Supplier, 'sup', 'sup.id = c.supplier_id')
      .select('sup.name', 'name')
      .addSelect('COALESCE(SUM(c.weight_kg::numeric), 0)', 'total')
      .addSelect('COALESCE(SUM(c.rejected_weight_kg::numeric), 0)', 'rejected')
      .where('c.created_at >= :prev AND c.created_at < :start', {
        prev: prevMonthStart,
        start: monthStart,
      })
      .groupBy('sup.name')
      .getRawMany<{ name: string; total: string; rejected: string }>();

    const prevMap = new Map(
      rejPrev.map((r) => {
        const t = Number(r.total) || 0;
        const rej = Number(r.rejected) || 0;
        return [r.name, t > 0 ? (rej / t) * 100 : 0];
      }),
    );
    let worst: { name: string; from: number; to: number } | null = null;
    for (const r of rejThis) {
      const t = Number(r.total) || 0;
      const rej = Number(r.rejected) || 0;
      const rate = t > 0 ? (rej / t) * 100 : 0;
      const prev = prevMap.get(r.name) ?? 0;
      if (prev > 0 && rate > prev + 2) {
        if (!worst || rate - prev > worst.to - worst.from) {
          worst = { name: r.name, from: prev, to: rate };
        }
      }
    }
    if (worst) {
      cards.push({
        id: 'exec-quality-rejection',
        tone: 'warn',
        category: 'Quality',
        title: `${worst.name}'s rejection rate increased from ${worst.from.toFixed(1)}% to ${worst.to.toFixed(1)}% this month.`,
        detail: 'Review receiving QC and supplier mix',
        href: '/collections',
      });
    } else if (rejThis.length > 0) {
      const top = rejThis
        .map((r) => {
          const t = Number(r.total) || 0;
          const rej = Number(r.rejected) || 0;
          return { name: r.name, rate: t > 0 ? (rej / t) * 100 : 0 };
        })
        .sort((a, b) => b.rate - a.rate)[0];
      if (top && top.rate >= 5) {
        cards.push({
          id: 'exec-quality-top',
          tone: 'warn',
          category: 'Quality',
          title: `${top.name} leads rejection at ${top.rate.toFixed(1)}% this month.`,
          detail: 'Monitor intake quality',
          href: '/collections',
        });
      }
    }

    const exportRecent = await this.saleLineRepo
      .createQueryBuilder('line')
      .innerJoin('line.sale', 'sale')
      .select(
        `COALESCE(SUM(CASE WHEN sale.created_at >= :monthStart AND sale.channel = 'EXPORT' THEN line.quantity::numeric ELSE 0 END), 0)`,
        'thisMonth',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN sale.created_at >= :prev AND sale.created_at < :monthStart AND sale.channel = 'EXPORT' THEN line.quantity::numeric ELSE 0 END), 0)`,
        'prevMonth',
      )
      .where('sale.status = :st', { st: DocumentStatus.ACTIVE })
      .setParameter('monthStart', monthStart)
      .setParameter('prev', prevMonthStart)
      .getRawOne<{ thisMonth: string; prevMonth: string }>();
    const thisExp = Number(exportRecent?.thisMonth ?? 0);
    const prevExp = Number(exportRecent?.prevMonth ?? 0);
    if (prevExp > 0) {
      const pct = ((thisExp - prevExp) / prevExp) * 100;
      cards.push({
        id: 'exec-export-demand',
        tone: pct >= 0 ? 'info' : 'warn',
        category: 'Export',
        title:
          pct >= 0
            ? `Export demand is trending ${pct.toFixed(0)}% above last month (${thisExp.toFixed(0)} kg vs ${prevExp.toFixed(0)} kg).`
            : `Export volume is down ${Math.abs(pct).toFixed(0)}% vs last month.`,
        detail: 'Align green allocation and staging capacity',
        href: '/exports',
      });
    }

    const channelProfit = await this.saleLineRepo
      .createQueryBuilder('line')
      .innerJoin('line.sale', 'sale')
      .select('sale.channel', 'channel')
      .addSelect('COALESCE(SUM(line."lineTotal"::numeric), 0)', 'revenue')
      .addSelect(
        'COALESCE(SUM(line.quantity::numeric * line.purchase_cost::numeric), 0)',
        'cogs',
      )
      .where('sale.status = :st', { st: DocumentStatus.ACTIVE })
      .groupBy('sale.channel');
    applyDateRangeToQb(channelProfit, 'sale.created_at', from, to);
    const profitRows = await channelProfit.getRawMany<{
      channel: string;
      revenue: string;
      cogs: string;
    }>();
    let localProfit = 0;
    let exportProfit = 0;
    for (const r of profitRows) {
      const p = (Number(r.revenue) || 0) - (Number(r.cogs) || 0);
      if (r.channel === SaleChannel.EXPORT) exportProfit += p;
      else localProfit += p;
    }
    const totalProfit = localProfit + exportProfit;
    if (totalProfit > 0) {
      const exportShare = Math.round((exportProfit / totalProfit) * 100);
      cards.push({
        id: 'exec-profit-mix',
        tone: 'profit',
        category: 'Profit',
        title: `Export sales generated ${exportShare}% of total coffee gross profit this period.`,
        detail: `Gross profit ${profitAndLoss.grossProfit} · export share of margin`,
        href: '/profit-loss',
      });
    }

    return cards.slice(0, 6);
  }
}
