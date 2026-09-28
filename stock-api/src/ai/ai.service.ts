import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AiFeedbackDecision,
  AiInsightKind,
  AiInsightSeverity,
  AiInsightSource,
  AiInsightStatus,
  CoffeeForm,
  CreditStatus,
  DocumentStatus,
  ExportContractStatus,
  LotEventType,
  LotStatus,
  SaleChannel,
} from '../common/enums';
import { AiFeedback } from '../database/entities/ai-feedback.entity';
import { AiInsight } from '../database/entities/ai-insight.entity';
import { CollectionTicket } from '../database/entities/collection-ticket.entity';
import { CustomerCredit } from '../database/entities/customer-credit.entity';
import { Customer } from '../database/entities/customer.entity';
import { ExportContract } from '../database/entities/export-contract.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { SaleLine } from '../database/entities/sale-line.entity';
import { Sale } from '../database/entities/sale.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { MarketPricesService } from '../market-prices/market-prices.service';
import {
  AiFeedbackDto,
  AiInsightListQueryDto,
  AiRefreshDto,
} from './dto/ai.dto';

type InsightDraft = {
  code: string;
  kind: AiInsightKind;
  severity: AiInsightSeverity;
  title: string;
  summary: string;
  href?: string | null;
  confidence?: number;
  score?: number | null;
  payload?: Record<string, unknown>;
  source: AiInsightSource;
  lotId?: string | null;
  exportContractId?: string | null;
  expiresAt?: Date | null;
};

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(AiInsight)
    private readonly insightRepo: Repository<AiInsight>,
    @InjectRepository(AiFeedback)
    private readonly feedbackRepo: Repository<AiFeedback>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
    @InjectRepository(ExportContract)
    private readonly exportRepo: Repository<ExportContract>,
    @InjectRepository(StockLevel)
    private readonly stockRepo: Repository<StockLevel>,
    @InjectRepository(CollectionTicket)
    private readonly collectionRepo: Repository<CollectionTicket>,
    @InjectRepository(LotEvent)
    private readonly lotEventRepo: Repository<LotEvent>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleLine)
    private readonly saleLineRepo: Repository<SaleLine>,
    @InjectRepository(CustomerCredit)
    private readonly customerCreditRepo: Repository<CustomerCredit>,
    @Optional()
    @Inject(forwardRef(() => MarketPricesService))
    private readonly marketPrices?: MarketPricesService,
  ) {}

  async onModuleInit() {
    if (process.env.DB_SEED !== 'true') return;
    try {
      const res = await this.refresh({
        includeDemo: true,
        forceReopen: true,
      });
      this.logger.log(
        `AI insights ready (upserted=${res.upserted}, open=${res.totalOpen})`,
      );
    } catch (err) {
      this.logger.warn(
        `AI demo seed skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async findAll(query: AiInsightListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Record<string, unknown> = {};
    if (query.kind) where.kind = query.kind;
    if (query.status) where.status = query.status;

    const [data, total] = await this.insightRepo.findAndCount({
      where,
      order: { severity: 'ASC', updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: { lot: true, exportContract: true },
    });

    // Sort severity critical→warn→info in memory (enum alpha order is wrong)
    const rank: Record<string, number> = {
      critical: 0,
      warn: 1,
      info: 2,
    };
    data.sort(
      (a, b) =>
        (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) ||
        b.updatedAt.getTime() - a.updatedAt.getTime(),
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string) {
    const insight = await this.insightRepo.findOne({
      where: { id },
      relations: { lot: true, exportContract: true, feedback: true },
    });
    if (!insight) throw new NotFoundException('Insight not found');
    return insight;
  }

  async summary() {
    const open = await this.insightRepo.count({
      where: { status: AiInsightStatus.OPEN },
    });
    const accepted = await this.insightRepo.count({
      where: { status: AiInsightStatus.ACCEPTED },
    });
    const rejected = await this.insightRepo.count({
      where: { status: AiInsightStatus.REJECTED },
    });
    const dismissed = await this.insightRepo.count({
      where: { status: AiInsightStatus.DISMISSED },
    });
    const decided = accepted + rejected;
    const acceptRate = decided > 0 ? accepted / decided : null;

    const byKindRaw = await this.insightRepo
      .createQueryBuilder('i')
      .select('i.kind', 'kind')
      .addSelect('COUNT(*)', 'count')
      .where('i.status = :status', { status: AiInsightStatus.OPEN })
      .groupBy('i.kind')
      .getRawMany<{ kind: string; count: string }>();

    return {
      open,
      accepted,
      rejected,
      dismissed,
      acceptRate,
      openByKind: Object.fromEntries(
        byKindRaw.map((r) => [r.kind, Number(r.count)]),
      ),
      note: 'Recommendations only — confirm before stock or money actions.',
    };
  }

  async submitFeedback(id: string, dto: AiFeedbackDto, userId: string) {
    const insight = await this.findOne(id);
    if (insight.status !== AiInsightStatus.OPEN) {
      throw new BadRequestException(
        `Insight is already ${insight.status.toLowerCase()}`,
      );
    }

    const statusMap: Record<AiFeedbackDecision, AiInsightStatus> = {
      [AiFeedbackDecision.ACCEPT]: AiInsightStatus.ACCEPTED,
      [AiFeedbackDecision.REJECT]: AiInsightStatus.REJECTED,
      [AiFeedbackDecision.DISMISS]: AiInsightStatus.DISMISSED,
    };

    const feedback = await this.feedbackRepo.save(
      this.feedbackRepo.create({
        insightId: insight.id,
        decision: dto.decision,
        note: dto.note ?? null,
        userId,
      }),
    );

    insight.status = statusMap[dto.decision];
    await this.insightRepo.save(insight);

    return { insight, feedback };
  }

  async refresh(dto: AiRefreshDto = {}) {
    const includeDemo = dto.includeDemo !== false;
    const forceReopen = dto.forceReopen !== false;
    const drafts: InsightDraft[] = [];

    if (includeDemo) {
      drafts.push(...(await this.buildDemoDrafts()));
    }
    drafts.push(...(await this.buildRuleDrafts()));
    drafts.push(...(await this.buildStockOpsDrafts()));
    drafts.push(...(await this.buildStockPredictionDrafts()));
    drafts.push(...(await this.buildProcurementDrafts()));
    drafts.push(...(await this.buildQualityAnalysisDrafts()));
    drafts.push(...(await this.buildCreditRiskDrafts()));
    drafts.push(...(await this.buildDemandForecastDrafts()));
    drafts.push(...(await this.buildMarketAlertDrafts()));

    let upserted = 0;
    for (const draft of drafts) {
      const changed = await this.upsertOpenInsight(draft, forceReopen);
      if (changed) upserted += 1;
    }

    return {
      upserted,
      totalOpen: await this.insightRepo.count({
        where: { status: AiInsightStatus.OPEN },
      }),
    };
  }

  /** Seed / ensure demo cards exist (idempotent). */
  async ensureDemoInsights() {
    const drafts = [
      ...(await this.buildDemoDrafts()),
      ...(await this.buildStockOpsDrafts()),
    ];
    for (const draft of drafts) {
      await this.upsertOpenInsight(draft, true);
    }
    return drafts.length;
  }

  /**
   * Stock-operation trends for the AI Insights page (live + demo fill).
   */
  async getStockTrends() {
    const days = 14;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const formRows = await this.lotRepo
      .createQueryBuilder('l')
      .select('l.form', 'form')
      .addSelect('COALESCE(SUM(l.quantity::numeric), 0)', 'kg')
      .where('l.status = :st', { st: LotStatus.ACTIVE })
      .groupBy('l.form')
      .getRawMany<{ form: string; kg: string }>();

    const stockByForm = formRows.map((r) => ({
      form: r.form,
      kg: Number(r.kg) || 0,
    }));

    const locRows = await this.stockRepo
      .createQueryBuilder('s')
      .innerJoin(Location, 'loc', 'loc.id = s.location_id')
      .select('loc.name', 'locationName')
      .addSelect('COALESCE(SUM(s.quantity::numeric), 0)', 'kg')
      .groupBy('loc.name')
      .orderBy('kg', 'DESC')
      .limit(8)
      .getRawMany<{ locationName: string; kg: string }>();

    const stockByLocation = locRows.map((r) => ({
      locationName: r.locationName,
      kg: Number(r.kg) || 0,
    }));

    const intakeRows = await this.collectionRepo
      .createQueryBuilder('c')
      .select(`to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`, 'day')
      .addSelect('COALESCE(SUM(c.weight_kg::numeric), 0)', 'kg')
      .where('c.created_at >= :since', { since })
      .groupBy('day')
      .getRawMany<{ day: string; kg: string }>();

    const transferRows = await this.lotEventRepo
      .createQueryBuilder('e')
      .select(`to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`, 'day')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(ABS(e.quantity::numeric)), 0)', 'kg')
      .where('e.created_at >= :since', { since })
      .andWhere('e.event_type = :etype', { etype: LotEventType.TRANSFERRED })
      .groupBy('day')
      .getRawMany<{ day: string; count: string; kg: string }>();

    const processRows = await this.lotEventRepo
      .createQueryBuilder('e')
      .select(`to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`, 'day')
      .addSelect('COUNT(*)', 'count')
      .where('e.created_at >= :since', { since })
      .andWhere('e.event_type IN (:...types)', {
        types: [
          LotEventType.PROCESS_STARTED,
          LotEventType.PROCESS_COMPLETED,
          LotEventType.ROASTED,
          LotEventType.PACKAGED,
        ],
      })
      .groupBy('day')
      .getRawMany<{ day: string; count: string }>();

    const soldRows = await this.lotEventRepo
      .createQueryBuilder('e')
      .select(`to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`, 'day')
      .addSelect('COALESCE(SUM(ABS(e.quantity::numeric)), 0)', 'kg')
      .where('e.created_at >= :since', { since })
      .andWhere('e.event_type IN (:...types)', {
        types: [LotEventType.SOLD_LOCAL, LotEventType.SHIPPED],
      })
      .groupBy('day')
      .getRawMany<{ day: string; kg: string }>();

    const intakeMap = new Map(
      intakeRows.map((r) => [r.day, Number(r.kg) || 0]),
    );
    const transferMap = new Map(
      transferRows.map((r) => [
        r.day,
        { count: Number(r.count) || 0, kg: Number(r.kg) || 0 },
      ]),
    );
    const processMap = new Map(
      processRows.map((r) => [r.day, Number(r.count) || 0]),
    );
    const soldMap = new Map(soldRows.map((r) => [r.day, Number(r.kg) || 0]));

    const totalGreen =
      stockByForm.find((f) => f.form === CoffeeForm.GREEN)?.kg ?? 0;
    const totalCherry =
      stockByForm.find((f) => f.form === CoffeeForm.CHERRY)?.kg ?? 0;
    const liveIntake = [...intakeMap.values()].reduce((a, b) => a + b, 0);
    const useDemoFill = liveIntake < 50;

    const dailyOps = this.lastNDays(days).map((day, i) => {
      const intakeKg = intakeMap.get(day) ?? 0;
      const transfer = transferMap.get(day) ?? { count: 0, kg: 0 };
      const processEvents = processMap.get(day) ?? 0;
      const soldKg = soldMap.get(day) ?? 0;
      const demoIntake = [
        180, 220, 160, 310, 240, 190, 280, 210, 260, 300, 230, 270, 250, 320,
      ][i];
      return {
        date: day,
        intakeKg: useDemoFill && intakeKg === 0 ? demoIntake : intakeKg,
        transferCount: transfer.count,
        transferKg:
          transfer.kg ||
          (useDemoFill && transfer.count === 0
            ? Math.round(demoIntake * 0.35)
            : transfer.kg),
        processEvents:
          processEvents ||
          (useDemoFill ? [1, 0, 2, 1, 0, 1, 2, 1, 0, 1, 2, 0, 1, 1][i] : 0),
        soldKg:
          soldKg ||
          (useDemoFill
            ? [40, 55, 30, 70, 45, 60, 50, 80, 35, 65, 55, 75, 48, 90][i]
            : 0),
        demoFilled: useDemoFill && intakeKg === 0,
      };
    });

    const avgIntake =
      dailyOps.reduce((s, d) => s + d.intakeKg, 0) /
      Math.max(1, dailyOps.length);
    const avgSold =
      dailyOps.reduce((s, d) => s + d.soldKg, 0) / Math.max(1, dailyOps.length);

    const weeks = this.nextWeeks(4);
    const demand = await this.computeChannelDemand();
    const forecast = weeks.map((week, i) => ({
      week,
      projectedGreenNeedKg: Math.round(
        demand.localDailyKg * 7 * (1 + i * 0.02) +
          demand.exportDailyKg * 7 * (1 + i * 0.03),
      ),
      projectedIntakeKg: Math.round(
        Math.max(avgIntake, demand.localDailyKg + demand.exportDailyKg) *
          7 *
          1.15,
      ),
      projectedLocalKg: Math.round(demand.localDailyKg * 7),
      projectedExportKg: Math.round(demand.exportDailyKg * 7),
    }));

    const highlights: string[] = [];
    if (totalGreen > 0) {
      highlights.push(
        `Active green stock ≈ ${Math.round(totalGreen).toLocaleString()} kg across lots.`,
      );
    }
    if (totalCherry > 0) {
      highlights.push(
        `Cherry on hand ≈ ${Math.round(totalCherry).toLocaleString()} kg — schedule wet/dry capacity.`,
      );
    }
    highlights.push(
      `Intake pace ~${Math.round(avgIntake)} kg/day (${useDemoFill ? 'demo-filled' : 'live'} 14-day trend).`,
    );
    if (avgSold > 0) {
      highlights.push(
        `Outbound (local/export events) ~${Math.round(avgSold)} kg/day.`,
      );
    }
    if (demand.localDailyKg + demand.exportDailyKg > 0) {
      highlights.push(
        `Demand forecast: local ~${Math.round(demand.localDailyKg)} kg/day · export ~${Math.round(demand.exportDailyKg)} kg/day (from sales history).`,
      );
    }

    const signals = [
      {
        code: 'STOCK_FORM_MIX',
        title: 'Form mix',
        severity: totalCherry > totalGreen ? 'warn' : 'info',
        detail:
          totalCherry > totalGreen
            ? 'Cherry outweighs green — prioritize processing to avoid spoilage.'
            : 'Green dominates inventory — focus on allocation and roast/export pull.',
        href: '/lots',
      },
      {
        code: 'INTAKE_VS_OUT',
        title: 'Intake vs outbound',
        severity: avgIntake < avgSold * 0.8 ? 'warn' : 'info',
        detail:
          avgIntake < avgSold * 0.8
            ? 'Outbound is outpacing intake — raise collection targets this week.'
            : 'Intake covers recent outbound; maintain buffer for export windows.',
        href: '/collections',
      },
      {
        code: 'CHANNEL_DEMAND',
        title: 'Local vs export demand',
        severity:
          demand.exportDailyKg > demand.localDailyKg * 1.5 ? 'warn' : 'info',
        detail:
          demand.exportDailyKg > demand.localDailyKg * 1.5
            ? 'Export demand dominates — prioritize green grade stock and staging.'
            : 'Balanced local/export pull from recent sales history.',
        href: '/exports',
      },
    ];

    return {
      generatedAt: new Date().toISOString(),
      demoFilled: useDemoFill,
      highlights,
      stockByForm,
      stockByLocation,
      dailyOps,
      forecast,
      demand: {
        localDailyKg: Math.round(demand.localDailyKg * 10) / 10,
        exportDailyKg: Math.round(demand.exportDailyKg * 10) / 10,
        sampleDays: demand.sampleDays,
      },
      signals,
      totals: {
        greenKg: totalGreen,
        cherryKg: totalCherry,
        locationsTracked: stockByLocation.length,
        avgDailyIntakeKg: Math.round(avgIntake),
        avgDailySoldKg: Math.round(avgSold),
      },
    };
  }

  private async upsertOpenInsight(
    draft: InsightDraft,
    forceReopen = false,
  ): Promise<boolean> {
    const existing = await this.insightRepo.findOne({
      where: { code: draft.code },
    });

    // Do not reopen closed human decisions unless refresh forces it
    if (
      existing &&
      !forceReopen &&
      existing.status !== AiInsightStatus.OPEN &&
      existing.status !== AiInsightStatus.SUPERSEDED
    ) {
      return false;
    }

    if (existing) {
      existing.kind = draft.kind;
      existing.severity = draft.severity;
      existing.title = draft.title;
      existing.summary = draft.summary;
      existing.href = draft.href ?? null;
      existing.confidence = String(draft.confidence ?? 0.75);
      existing.score =
        draft.score === undefined || draft.score === null
          ? null
          : String(draft.score);
      existing.payload = draft.payload ?? {};
      existing.source = draft.source;
      existing.lotId = draft.lotId ?? null;
      existing.exportContractId = draft.exportContractId ?? null;
      existing.expiresAt = draft.expiresAt ?? null;
      existing.status = AiInsightStatus.OPEN;
      await this.insightRepo.save(existing);
      return true;
    }

    await this.insightRepo.save(
      this.insightRepo.create({
        code: draft.code,
        kind: draft.kind,
        severity: draft.severity,
        status: AiInsightStatus.OPEN,
        title: draft.title,
        summary: draft.summary,
        href: draft.href ?? null,
        confidence: String(draft.confidence ?? 0.75),
        score:
          draft.score === undefined || draft.score === null
            ? null
            : String(draft.score),
        payload: draft.payload ?? {},
        source: draft.source,
        lotId: draft.lotId ?? null,
        exportContractId: draft.exportContractId ?? null,
        expiresAt: draft.expiresAt ?? null,
      }),
    );
    return true;
  }

  private async buildDemoDrafts(): Promise<InsightDraft[]> {
    const lots = await this.lotRepo.find({
      where: { status: In([LotStatus.ACTIVE, LotStatus.HOLD]) },
      order: { createdAt: 'ASC' },
      take: 10,
    });
    const lotA = lots.find((l) => l.code === 'LOT-2026-0001') ?? lots[0];
    const moistLot =
      lots.find((l) => Number(l.moisturePercent ?? 0) >= 12) ?? lotA;

    const contract = await this.exportRepo.findOne({
      where: { contractNumber: 'EXP-DEMO-001' },
    });

    const expires = new Date();
    expires.setDate(expires.getDate() + 21);

    const weeks = this.nextWeeks(4).map((week, i) => ({
      week,
      roastKg: [420, 480, 510, 460][i],
      cherryIntakeKg: [2800, 3100, 2950, 3300][i],
    }));

    const drafts: InsightDraft[] = [
      {
        code: 'DEMO-FORECAST-ROAST-Q',
        kind: AiInsightKind.DEMAND_FORECAST,
        severity: AiInsightSeverity.INFO,
        title: 'Roast calendar — next 4 weeks',
        summary:
          'Demo forecast: plan ~1,870 kg green for local roast demand. Peak week needs 510 kg roasted equivalent.',
        href: '/roast-profiles',
        confidence: 0.72,
        source: AiInsightSource.DEMO,
        expiresAt: expires,
        payload: {
          model: 'demo-seasonal-v1',
          horizonWeeks: 4,
          series: weeks,
          greenNeededKg: 1870,
          assumption: '70% extraction roasted from green',
        },
      },
      {
        code: 'DEMO-INTAKE-WINDOW',
        kind: AiInsightKind.INTAKE_ADVICE,
        severity: AiInsightSeverity.WARN,
        title: 'Accelerate cherry intake this week',
        summary:
          'Open export volume plus roast forecast exceeds recent 7-day intake pace. Suggest +18% cherry kg at collection centers before Friday.',
        href: '/collections',
        confidence: 0.68,
        source: AiInsightSource.DEMO,
        expiresAt: expires,
        payload: {
          recentIntakeKg: 6200,
          suggestedIntakeKg: 7300,
          gapKg: 1100,
          drivers: ['export coverage', 'roast calendar'],
        },
      },
      {
        code: 'DEMO-YIELD-MILL-A',
        kind: AiInsightKind.YIELD_ANOMALY,
        severity: AiInsightSeverity.WARN,
        title: 'Wet mill yield below pattern',
        summary:
          'Demo: last three wet runs averaged −7.4% vs template target. Check floatation density and cherry ripeness mix.',
        href: '/process-runs',
        confidence: 0.81,
        source: AiInsightSource.DEMO,
        expiresAt: expires,
        payload: {
          mill: 'Wet mill A',
          avgVariancePercent: -7.4,
          runs: 3,
          thresholdPercent: -5,
        },
      },
      {
        code: 'DEMO-BLEND-CITY',
        kind: AiInsightKind.BLEND_OPTIMIZER,
        severity: AiInsightSeverity.INFO,
        title: 'City roast blend — cost vs cup',
        summary:
          'Suggested 65% Yirgacheffe G1 / 35% Sidamo G2 for MED-CITY profile. Est. green cost ETB 482/kg roasted vs current 510.',
        href: '/roast-profiles',
        confidence: 0.64,
        source: AiInsightSource.DEMO,
        expiresAt: expires,
        payload: {
          profileCode: 'MED-CITY',
          targetCupScore: 84,
          lots: [
            { lotCode: lotA?.code ?? 'LOT-2026-0001', percent: 65, role: 'brightness' },
            { lotCode: 'LOT-2026-0002', percent: 35, role: 'body' },
          ],
          estCostEtbPerKgRoasted: 482,
          currentCostEtbPerKgRoasted: 510,
        },
      },
      {
        code: 'DEMO-PRICING-BANDS',
        kind: AiInsightKind.PRICING,
        severity: AiInsightSeverity.INFO,
        title: 'Local & export price bands',
        summary:
          'From cost stack: local roasted floor ETB 1,150/kg; export FOB G1 band USD 4.40–5.10/kg. Demo EXP-DEMO-001 is inside band.',
        href: '/sales',
        confidence: 0.7,
        source: AiInsightSource.DEMO,
        expiresAt: expires,
        payload: {
          local: {
            currency: 'ETB',
            floorPerKg: 1150,
            targetPerKg: 1280,
            ceilingPerKg: 1450,
          },
          export: {
            currency: 'USD',
            grade: 'G1',
            floorPerKg: 4.4,
            targetPerKg: 4.85,
            ceilingPerKg: 5.1,
          },
          costStack: {
            cherry: 0.42,
            process: 0.18,
            overhead: 0.12,
            margin: 0.28,
          },
        },
      },
      {
        code: 'DEMO-QUALITY-MOISTURE',
        kind: AiInsightKind.QUALITY_RISK,
        severity:
          Number(moistLot?.moisturePercent ?? 0) >= 13
            ? AiInsightSeverity.CRITICAL
            : AiInsightSeverity.WARN,
        title: `Moisture risk — ${moistLot?.code ?? 'green lot'}`,
        summary: moistLot
          ? `Lot ${moistLot.code} at ${moistLot.moisturePercent ?? '?'}% moisture. Prioritize drying / QC before allocation.`
          : 'No active lots found for moisture demo — seed sample lots.',
        href: moistLot ? `/lots/${moistLot.id}` : '/lots',
        confidence: 0.88,
        score: moistLot ? Number(moistLot.moisturePercent) : null,
        source: AiInsightSource.DEMO,
        lotId: moistLot?.id ?? null,
        expiresAt: expires,
        payload: {
          moisturePercent: moistLot?.moisturePercent ?? null,
          thresholdPercent: 12.5,
          action: 'dry_or_hold',
        },
      },
    ];

    if (contract) {
      const checklist = contract.docChecklist ?? [];
      const done = checklist.filter((d) => d.done).length;
      const missing = checklist.filter((d) => !d.done).map((d) => d.label);
      const alloc = Number(contract.allocatedKg ?? 0);
      const vol = Number(contract.volumeKg ?? 0) || 1;
      const allocPct = Math.min(100, (alloc / vol) * 100);
      const docPct = checklist.length
        ? (done / checklist.length) * 100
        : 0;
      const readiness = Math.round(allocPct * 0.55 + docPct * 0.45);

      drafts.push({
        code: 'DEMO-EXPORT-READINESS',
        kind: AiInsightKind.EXPORT_READINESS,
        severity:
          readiness < 40
            ? AiInsightSeverity.CRITICAL
            : readiness < 70
              ? AiInsightSeverity.WARN
              : AiInsightSeverity.INFO,
        title: `Export readiness — ${contract.contractNumber}`,
        summary: `Score ${readiness}/100. Allocation ${allocPct.toFixed(0)}%; docs ${done}/${checklist.length || 0}. ${
          missing.length
            ? `Missing: ${missing.slice(0, 3).join(', ')}.`
            : 'Docs complete.'
        }`,
        href: `/exports/${contract.id}`,
        confidence: 0.9,
        score: readiness,
        source: AiInsightSource.DEMO,
        exportContractId: contract.id,
        expiresAt: expires,
        payload: {
          readinessScore: readiness,
          allocatedPercent: Math.round(allocPct),
          docsComplete: done,
          docsTotal: checklist.length,
          missing,
          windowStart: contract.windowStart,
          windowEnd: contract.windowEnd,
          volumeKg: contract.volumeKg,
        },
      });
    } else {
      drafts.push({
        code: 'DEMO-EXPORT-READINESS',
        kind: AiInsightKind.EXPORT_READINESS,
        severity: AiInsightSeverity.WARN,
        title: 'Export readiness — demo contract',
        summary:
          'Seed EXP-DEMO-001 to unlock live readiness scoring. Placeholder score 35/100 (docs + allocation incomplete).',
        href: '/exports',
        confidence: 0.55,
        score: 35,
        source: AiInsightSource.DEMO,
        expiresAt: expires,
        payload: {
          readinessScore: 35,
          placeholder: true,
        },
      });
    }

    return drafts;
  }

  private async buildRuleDrafts(): Promise<InsightDraft[]> {
    const drafts: InsightDraft[] = [];
    const now = new Date();

    const contracts = await this.exportRepo.find({
      where: {
        status: In([
          ExportContractStatus.DRAFT,
          ExportContractStatus.ALLOCATED,
          ExportContractStatus.STAGED,
        ]),
      },
    });

    for (const c of contracts) {
      const checklist = c.docChecklist ?? [];
      const done = checklist.filter((d) => d.done).length;
      const missing = checklist.filter((d) => !d.done).map((d) => d.label);
      const alloc = Number(c.allocatedKg ?? 0);
      const vol = Number(c.volumeKg ?? 0) || 1;
      const allocPct = Math.min(100, (alloc / vol) * 100);
      const docPct = checklist.length ? (done / checklist.length) * 100 : 0;
      const readiness = Math.round(allocPct * 0.55 + docPct * 0.45);

      let daysRemaining: number | null = null;
      if (c.windowEnd) {
        const end = new Date(c.windowEnd);
        daysRemaining = Math.ceil(
          (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      let severity = AiInsightSeverity.INFO;
      if (readiness < 40 || (daysRemaining !== null && daysRemaining <= 7)) {
        severity = AiInsightSeverity.CRITICAL;
      } else if (
        readiness < 70 ||
        (daysRemaining !== null && daysRemaining <= 21)
      ) {
        severity = AiInsightSeverity.WARN;
      }

      drafts.push({
        code: `RULE-EXPORT-${c.contractNumber}`,
        kind: AiInsightKind.EXPORT_READINESS,
        severity,
        title: `Ready to ship? ${c.contractNumber}`,
        summary: `Readiness ${readiness}/100 · ${alloc.toFixed(0)}/${vol.toFixed(0)} kg allocated${
          daysRemaining !== null ? ` · ${daysRemaining}d left in window` : ''
        }.`,
        href: `/exports/${c.id}`,
        confidence: 0.85,
        score: readiness,
        source: AiInsightSource.RULES,
        exportContractId: c.id,
        payload: {
          readinessScore: readiness,
          daysRemaining,
          missing,
          status: c.status,
        },
      });
    }

    const moistLots = await this.lotRepo
      .createQueryBuilder('l')
      .where('l.status IN (:...st)', {
        st: [LotStatus.ACTIVE, LotStatus.HOLD],
      })
      .andWhere('l.moisture_percent IS NOT NULL')
      .andWhere('l.moisture_percent::numeric >= :thr', { thr: 12.5 })
      .orderBy('l.moisture_percent', 'DESC')
      .take(5)
      .getMany();

    for (const lot of moistLots) {
      const m = Number(lot.moisturePercent);
      drafts.push({
        code: `RULE-MOISTURE-${lot.code}`,
        kind: AiInsightKind.QUALITY_RISK,
        severity: m >= 13.5 ? AiInsightSeverity.CRITICAL : AiInsightSeverity.WARN,
        title: `High moisture — ${lot.code}`,
        summary: `${m.toFixed(2)}% moisture (threshold 12.5%). Hold from export allocation until dried.`,
        href: `/lots/${lot.id}`,
        confidence: 0.92,
        score: m,
        source: AiInsightSource.RULES,
        lotId: lot.id,
        payload: {
          moisturePercent: lot.moisturePercent,
          thresholdPercent: 12.5,
        },
      });
    }

    return drafts;
  }

  private async buildStockOpsDrafts(): Promise<InsightDraft[]> {
    const trends = await this.getStockTrends();
    const expires = new Date();
    expires.setDate(expires.getDate() + 14);
    const drafts: InsightDraft[] = [];

    drafts.push({
      code: 'STOCK-OPS-TREND-14D',
      kind: AiInsightKind.DEMAND_FORECAST,
      severity: AiInsightSeverity.INFO,
      title: 'Stock ops trend — last 14 days',
      summary: trends.highlights.slice(0, 2).join(' ') ||
        'Track intake, transfers, process events, and outbound against green/cherry balances.',
      href: '/inventory',
      confidence: trends.demoFilled ? 0.62 : 0.84,
      source: trends.demoFilled ? AiInsightSource.DEMO : AiInsightSource.FORECAST,
      expiresAt: expires,
      payload: {
        view: 'stock_ops_trend',
        series: trends.dailyOps.map((d) => ({
          week: d.date,
          roastKg: d.soldKg,
          cherryIntakeKg: d.intakeKg,
          transferKg: d.transferKg,
          processEvents: d.processEvents,
        })),
        totals: trends.totals,
        stockByForm: trends.stockByForm,
      },
    });

    const green = trends.totals.greenKg;
    const cherry = trends.totals.cherryKg;
    if (green + cherry > 0) {
      drafts.push({
        code: 'STOCK-FORM-BALANCE',
        kind: AiInsightKind.INTAKE_ADVICE,
        severity:
          cherry > green * 1.2
            ? AiInsightSeverity.WARN
            : AiInsightSeverity.INFO,
        title: 'Pipeline balance — cherry vs green',
        summary: `Cherry ${Math.round(cherry)} kg · Green ${Math.round(green)} kg. ${
          cherry > green * 1.2
            ? 'Process backlog risk — open wet/dry runs.'
            : 'Green buffer looks healthy for roast/export pull.'
        }`,
        href: '/process-runs',
        confidence: 0.8,
        score: green > 0 ? Math.round((cherry / Math.max(green, 1)) * 100) : null,
        source: AiInsightSource.RULES,
        expiresAt: expires,
        payload: {
          stockByForm: trends.stockByForm,
          stockByLocation: trends.stockByLocation,
        },
      });
    }

    for (const signal of trends.signals) {
      drafts.push({
        code: `STOCK-SIGNAL-${signal.code}`,
        kind:
          signal.code === 'INTAKE_VS_OUT'
            ? AiInsightKind.INTAKE_ADVICE
            : AiInsightKind.DEMAND_FORECAST,
        severity:
          signal.severity === 'warn'
            ? AiInsightSeverity.WARN
            : AiInsightSeverity.INFO,
        title: signal.title,
        summary: signal.detail,
        href: signal.href,
        confidence: 0.75,
        source: AiInsightSource.RULES,
        expiresAt: expires,
        payload: { signal: signal.code, totals: trends.totals },
      });
    }

    return drafts;
  }

  private async computeChannelDemand(): Promise<{
    localDailyKg: number;
    exportDailyKg: number;
    sampleDays: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - 56);
    const rows = await this.saleLineRepo
      .createQueryBuilder('line')
      .innerJoin('line.sale', 'sale')
      .select('sale.channel', 'channel')
      .addSelect('COALESCE(SUM(line.quantity::numeric), 0)', 'kg')
      .where('sale.created_at >= :since', { since })
      .andWhere('sale.status = :st', { st: DocumentStatus.ACTIVE })
      .groupBy('sale.channel')
      .getRawMany<{ channel: string; kg: string }>();

    let localKg = 0;
    let exportKg = 0;
    for (const r of rows) {
      if (r.channel === SaleChannel.EXPORT) exportKg += Number(r.kg) || 0;
      else localKg += Number(r.kg) || 0;
    }
    const sampleDays = 56;
    return {
      localDailyKg: localKg / sampleDays,
      exportDailyKg: exportKg / sampleDays,
      sampleDays,
    };
  }

  private async buildDemandForecastDrafts(): Promise<InsightDraft[]> {
    const demand = await this.computeChannelDemand();
    const expires = new Date();
    expires.setDate(expires.getDate() + 14);
    const weeks = this.nextWeeks(4).map((week, i) => ({
      week,
      localKg: Math.round(demand.localDailyKg * 7 * (1 + i * 0.02)),
      exportKg: Math.round(demand.exportDailyKg * 7 * (1 + i * 0.03)),
      roastKg: Math.round(demand.localDailyKg * 7 * (1 + i * 0.02)),
      cherryIntakeKg: Math.round(
        (demand.localDailyKg + demand.exportDailyKg) * 7 * 1.2,
      ),
    }));
    const totalLocal = weeks.reduce((s, w) => s + w.localKg, 0);
    const totalExport = weeks.reduce((s, w) => s + w.exportKg, 0);
    if (totalLocal + totalExport < 1) return [];

    return [
      {
        code: 'FORECAST-CHANNEL-4W',
        kind: AiInsightKind.DEMAND_FORECAST,
        severity: AiInsightSeverity.INFO,
        title: 'Local & export demand — next 4 weeks',
        summary: `Projected ~${totalLocal.toLocaleString()} kg local and ~${totalExport.toLocaleString()} kg export from the last ${demand.sampleDays} days of sales history.`,
        href: '/sales',
        confidence: demand.localDailyKg + demand.exportDailyKg > 5 ? 0.78 : 0.55,
        source: AiInsightSource.FORECAST,
        expiresAt: expires,
        payload: {
          model: 'rolling-avg-v1',
          horizonWeeks: 4,
          series: weeks,
          localDailyKg: demand.localDailyKg,
          exportDailyKg: demand.exportDailyKg,
        },
      },
    ];
  }

  private async buildStockPredictionDrafts(): Promise<InsightDraft[]> {
    const drafts: InsightDraft[] = [];
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const stockRows = await this.stockRepo
      .createQueryBuilder('s')
      .innerJoin(Lot, 'lot', 'lot.id = s.lot_id')
      .select(`COALESCE(NULLIF(TRIM(lot.grade), ''), 'Ungraded')`, 'grade')
      .addSelect(
        'COALESCE(SUM(s.quantity::numeric - COALESCE(s.reserved_quantity, 0)), 0)',
        'available',
      )
      .addSelect('COALESCE(SUM(s.quantity::numeric), 0)', 'onHand')
      .addSelect(
        'COALESCE(SUM(COALESCE(s.reserved_quantity, 0)), 0)',
        'reserved',
      )
      .addSelect('MIN(s.reorder_point::numeric)', 'reorder')
      .where('lot.form = :form', { form: CoffeeForm.GREEN })
      .andWhere('lot.status = :st', { st: LotStatus.ACTIVE })
      .groupBy(`COALESCE(NULLIF(TRIM(lot.grade), ''), 'Ungraded')`)
      .getRawMany<{
        grade: string;
        available: string;
        onHand: string;
        reserved: string;
        reorder: string | null;
      }>();

    const burnRows = await this.lotEventRepo
      .createQueryBuilder('e')
      .innerJoin(Lot, 'lot', 'lot.id = e.lot_id')
      .select(`COALESCE(NULLIF(TRIM(lot.grade), ''), 'Ungraded')`, 'grade')
      .addSelect('COALESCE(SUM(ABS(e.quantity::numeric)), 0)', 'kg')
      .where('e.created_at >= :since', { since })
      .andWhere('e.event_type IN (:...types)', {
        types: [LotEventType.SOLD_LOCAL, LotEventType.SHIPPED],
      })
      .groupBy(`COALESCE(NULLIF(TRIM(lot.grade), ''), 'Ungraded')`)
      .getRawMany<{ grade: string; kg: string }>();

    const burnMap = new Map(
      burnRows.map((r) => [r.grade, (Number(r.kg) || 0) / 30]),
    );

    for (const row of stockRows) {
      const available = Number(row.available) || 0;
      const daily = burnMap.get(row.grade) ?? 0;
      if (daily < 0.01) continue;
      const daysToMin = available / daily;
      const reorder = row.reorder != null ? Number(row.reorder) : 0;
      if (daysToMin > 90 && available > reorder) continue;

      const severity =
        daysToMin <= 7
          ? AiInsightSeverity.CRITICAL
          : daysToMin <= 14
            ? AiInsightSeverity.WARN
            : AiInsightSeverity.INFO;

      drafts.push({
        code: `STOCK-ETA-${row.grade.replace(/\s+/g, '_').toUpperCase()}`,
        kind: AiInsightKind.STOCK_PREDICTION,
        severity,
        title: `Stock ETA — Grade ${row.grade}`,
        summary: `At the current consumption rate (~${daily.toFixed(1)} kg/day), Grade ${row.grade} green will reach minimum available stock in approximately ${Math.max(0, Math.round(daysToMin))} days (${available.toFixed(0)} kg available · ${Number(row.reserved).toFixed(0)} kg reserved).`,
        href: '/inventory',
        confidence: 0.8,
        score: Math.round(daysToMin),
        source: AiInsightSource.FORECAST,
        payload: {
          grade: row.grade,
          availableKg: available,
          onHandKg: Number(row.onHand) || 0,
          reservedKg: Number(row.reserved) || 0,
          dailyBurnKg: daily,
          daysToMinimum: Math.round(daysToMin),
          reorderPoint: reorder || null,
        },
      });
    }

    return drafts.slice(0, 8);
  }

  private async buildProcurementDrafts(): Promise<InsightDraft[]> {
    const contracts = await this.exportRepo.find({
      where: {
        status: In([
          ExportContractStatus.DRAFT,
          ExportContractStatus.ALLOCATED,
          ExportContractStatus.STAGED,
        ]),
      },
    });

    let commitmentGap = 0;
    for (const c of contracts) {
      commitmentGap += Math.max(
        0,
        Number(c.volumeKg) - Number(c.allocatedKg ?? 0),
      );
    }

    const greenAvail = await this.stockRepo
      .createQueryBuilder('s')
      .innerJoin(Lot, 'lot', 'lot.id = s.lot_id')
      .select(
        'COALESCE(SUM(s.quantity::numeric - COALESCE(s.reserved_quantity, 0)), 0)',
        'available',
      )
      .where('lot.form = :form', { form: CoffeeForm.GREEN })
      .andWhere('lot.status = :st', { st: LotStatus.ACTIVE })
      .getRawOne<{ available: string }>();

    const available = Number(greenAvail?.available ?? 0);
    const shortfall = Math.max(0, commitmentGap - available);
    if (shortfall < 50 && commitmentGap < 1) return [];

    const recommendKg = Math.max(shortfall, commitmentGap * 0.25);
    if (recommendKg < 50) return [];
    const quintals = recommendKg / 100;

    return [
      {
        code: 'PROCURE-EXPORT-GAP',
        kind: AiInsightKind.PROCUREMENT,
        severity:
          shortfall > available
            ? AiInsightSeverity.CRITICAL
            : AiInsightSeverity.WARN,
        title: 'Procurement for export commitments',
        summary: `Recommended purchase: ~${quintals.toFixed(1)} quintals (${Math.round(recommendKg).toLocaleString()} kg) of Grade 1 Arabica based on projected export commitments (${Math.round(commitmentGap).toLocaleString()} kg unallocated · ${Math.round(available).toLocaleString()} kg available green).`,
        href: '/collections',
        confidence: 0.76,
        score: Math.round(recommendKg),
        source: AiInsightSource.RULES,
        payload: {
          recommendKg: Math.round(recommendKg),
          recommendQuintals: Math.round(quintals * 10) / 10,
          exportCommitmentGapKg: Math.round(commitmentGap),
          availableGreenKg: Math.round(available),
          shortfallKg: Math.round(shortfall),
          openContracts: contracts.length,
          suggestedGrade: 'G1',
        },
      },
    ];
  }

  private async buildQualityAnalysisDrafts(): Promise<InsightDraft[]> {
    const drafts: InsightDraft[] = [];
    const since = new Date();
    since.setDate(since.getDate() + -90);

    const supplierRows = await this.collectionRepo
      .createQueryBuilder('c')
      .innerJoin(Supplier, 'sup', 'sup.id = c.supplier_id')
      .select('sup.id', 'supplierId')
      .addSelect('sup.name', 'supplierName')
      .addSelect('COALESCE(SUM(c.weight_kg::numeric), 0)', 'totalKg')
      .addSelect(
        'COALESCE(SUM(c.rejected_weight_kg::numeric), 0)',
        'rejectedKg',
      )
      .addSelect('COUNT(*)', 'tickets')
      .where('c.created_at >= :since', { since })
      .groupBy('sup.id')
      .addGroupBy('sup.name')
      .having('COALESCE(SUM(c.weight_kg::numeric), 0) > 0')
      .orderBy('rejectedKg', 'DESC')
      .take(5)
      .getRawMany<{
        supplierId: string;
        supplierName: string;
        totalKg: string;
        rejectedKg: string;
        tickets: string;
      }>();

    for (const row of supplierRows) {
      const total = Number(row.totalKg) || 0;
      const rejected = Number(row.rejectedKg) || 0;
      const rate = total > 0 ? (rejected / total) * 100 : 0;
      if (rate < 5) continue;
      drafts.push({
        code: `QUALITY-SUPPLIER-${row.supplierId.slice(0, 8)}`,
        kind: AiInsightKind.QUALITY_RISK,
        severity:
          rate >= 15 ? AiInsightSeverity.CRITICAL : AiInsightSeverity.WARN,
        title: `High rejection — ${row.supplierName}`,
        summary: `${row.supplierName} rejection rate ${rate.toFixed(1)}% over 90 days (${rejected.toFixed(0)} kg rejected of ${total.toFixed(0)} kg received).`,
        href: '/collections',
        confidence: 0.82,
        score: Math.round(rate * 10) / 10,
        source: AiInsightSource.RULES,
        payload: {
          analysis: 'supplier_rejection',
          supplierId: row.supplierId,
          supplierName: row.supplierName,
          rejectionRatePercent: Math.round(rate * 10) / 10,
          rejectedKg: rejected,
          totalKg: total,
          tickets: Number(row.tickets),
        },
      });
    }

    const originRows = await this.lotRepo
      .createQueryBuilder('l')
      .select(`COALESCE(NULLIF(TRIM(l.region), ''), 'Unknown')`, 'origin')
      .addSelect(
        `COALESCE(NULLIF(TRIM(l.grade), ''), 'Ungraded')`,
        'grade',
      )
      .addSelect('COUNT(*)', 'lots')
      .addSelect('COALESCE(AVG(l.cupping_score::numeric), 0)', 'avgCup')
      .where('l.status = :st', { st: LotStatus.ACTIVE })
      .andWhere('l.form = :form', { form: CoffeeForm.GREEN })
      .groupBy('origin')
      .addGroupBy('grade')
      .having('COUNT(*) >= 1')
      .orderBy('avgCup', 'DESC')
      .take(8)
      .getRawMany<{
        origin: string;
        grade: string;
        lots: string;
        avgCup: string;
      }>();

    const best = originRows.find((r) => Number(r.avgCup) > 0);
    if (best) {
      drafts.push({
        code: 'QUALITY-ORIGIN-BEST',
        kind: AiInsightKind.QUALITY_RISK,
        severity: AiInsightSeverity.INFO,
        title: `Strong origin — ${best.origin}`,
        summary: `${best.origin} is producing better grades (avg cup ${Number(best.avgCup).toFixed(1)}, grade ${best.grade}, ${best.lots} active lot(s)). Prefer for export G1 fills.`,
        href: '/lots',
        confidence: 0.7,
        score: Number(best.avgCup),
        source: AiInsightSource.RULES,
        payload: {
          analysis: 'origin_quality',
          origin: best.origin,
          grade: best.grade,
          avgCupScore: Number(best.avgCup),
          lots: Number(best.lots),
        },
      });
    }

    const recent = new Date();
    recent.setDate(recent.getDate() - 30);
    const prior = new Date();
    prior.setDate(prior.getDate() - 60);

    const defectRecent = await this.lotRepo
      .createQueryBuilder('l')
      .select('COALESCE(AVG(l.defect_count), 0)', 'avgDefect')
      .addSelect('COUNT(*)', 'n')
      .where('l.created_at >= :recent', { recent })
      .andWhere('l.defect_count IS NOT NULL')
      .getRawOne<{ avgDefect: string; n: string }>();

    const defectPrior = await this.lotRepo
      .createQueryBuilder('l')
      .select('COALESCE(AVG(l.defect_count), 0)', 'avgDefect')
      .addSelect('COUNT(*)', 'n')
      .where('l.created_at >= :prior', { prior })
      .andWhere('l.created_at < :recent', { recent })
      .andWhere('l.defect_count IS NOT NULL')
      .getRawOne<{ avgDefect: string; n: string }>();

    const avgR = Number(defectRecent?.avgDefect ?? 0);
    const avgP = Number(defectPrior?.avgDefect ?? 0);
    if (avgP > 0 && avgR > avgP * 1.15) {
      drafts.push({
        code: 'QUALITY-DEFECT-TREND',
        kind: AiInsightKind.QUALITY_RISK,
        severity: AiInsightSeverity.WARN,
        title: 'Rising defect rates',
        summary: `Average defect count increased from ${avgP.toFixed(1)} to ${avgR.toFixed(1)} vs the prior 30 days. Review seasonal intake QC and supplier mix.`,
        href: '/lots',
        confidence: 0.74,
        score: Math.round(((avgR - avgP) / avgP) * 100),
        source: AiInsightSource.RULES,
        payload: {
          analysis: 'seasonal_defect_trend',
          recentAvgDefect: avgR,
          priorAvgDefect: avgP,
          recentLots: Number(defectRecent?.n ?? 0),
          priorLots: Number(defectPrior?.n ?? 0),
        },
      });
    }

    // Seasonal: partial/rejected dispositions share last 90d by month
    const seasonal = await this.collectionRepo
      .createQueryBuilder('c')
      .select(`to_char(c.created_at, 'YYYY-MM')`, 'month')
      .addSelect('COUNT(*)', 'tickets')
      .addSelect(
        `SUM(CASE WHEN c.disposition IN ('PARTIAL','REJECTED') THEN 1 ELSE 0 END)`,
        'problem',
      )
      .where('c.created_at >= :since', { since })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany<{ month: string; tickets: string; problem: string }>();

    if (seasonal.length >= 2) {
      const last = seasonal[seasonal.length - 1];
      const prev = seasonal[seasonal.length - 2];
      const rateLast =
        Number(last.tickets) > 0
          ? (Number(last.problem) / Number(last.tickets)) * 100
          : 0;
      const ratePrev =
        Number(prev.tickets) > 0
          ? (Number(prev.problem) / Number(prev.tickets)) * 100
          : 0;
      if (rateLast > ratePrev + 5) {
        drafts.push({
          code: 'QUALITY-SEASONAL',
          kind: AiInsightKind.QUALITY_RISK,
          severity: AiInsightSeverity.WARN,
          title: 'Seasonal quality change',
          summary: `Partial/reject share rose to ${rateLast.toFixed(0)}% in ${last.month} from ${ratePrev.toFixed(0)}% in ${prev.month}. Tighten receiving QC this season.`,
          href: '/collections',
          confidence: 0.71,
          source: AiInsightSource.RULES,
          payload: {
            analysis: 'seasonal_quality',
            months: seasonal,
            latestRatePercent: rateLast,
            priorRatePercent: ratePrev,
          },
        });
      }
    }

    return drafts;
  }

  private async buildCreditRiskDrafts(): Promise<InsightDraft[]> {
    const drafts: InsightDraft[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);

    const overdue = await this.customerCreditRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.customer', 'customer')
      .where('c.status != :paid', { paid: CreditStatus.PAID })
      .andWhere('c."dueDate" IS NOT NULL')
      .andWhere('c."dueDate" < :today', { today: todayIso })
      .andWhere('c.balance::numeric > 0')
      .orderBy('c.balance', 'DESC')
      .take(8)
      .getMany();

    for (const credit of overdue) {
      const due = new Date(credit.dueDate as string);
      const daysLate = Math.floor(
        (today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000),
      );
      drafts.push({
        code: `CREDIT-LATE-${credit.id.slice(0, 8)}`,
        kind: AiInsightKind.CREDIT_RISK,
        severity:
          daysLate >= 30 ? AiInsightSeverity.CRITICAL : AiInsightSeverity.WARN,
        title: `Late payment — ${credit.customer?.name ?? 'Customer'}`,
        summary: `${credit.customer?.name ?? 'Customer'} is ${daysLate} days overdue with Br ${Number(credit.balance).toLocaleString()} outstanding.`,
        href: '/credits',
        confidence: 0.9,
        score: daysLate,
        source: AiInsightSource.RULES,
        payload: {
          analysis: 'late_payment',
          customerId: credit.customerId,
          customerName: credit.customer?.name,
          balance: credit.balance,
          daysLate,
          dueDate: credit.dueDate,
        },
      });
    }

    const exposure = await this.customerCreditRepo
      .createQueryBuilder('c')
      .innerJoin(Customer, 'customer', 'customer.id = c.customer_id')
      .select('customer.id', 'customerId')
      .addSelect('customer.name', 'customerName')
      .addSelect('customer.credit_limit', 'creditLimit')
      .addSelect(
        'COALESCE(SUM(CASE WHEN c.status != \'PAID\' THEN c.balance::numeric ELSE 0 END), 0)',
        'outstanding',
      )
      .groupBy('customer.id')
      .addGroupBy('customer.name')
      .addGroupBy('customer.credit_limit')
      .having(
        'COALESCE(SUM(CASE WHEN c.status != \'PAID\' THEN c.balance::numeric ELSE 0 END), 0) > 0',
      )
      .orderBy('outstanding', 'DESC')
      .take(10)
      .getRawMany<{
        customerId: string;
        customerName: string;
        creditLimit: string | null;
        outstanding: string;
      }>();

    for (const row of exposure) {
      const outstanding = Number(row.outstanding) || 0;
      const limit = row.creditLimit != null ? Number(row.creditLimit) : null;
      if (limit == null || limit <= 0) {
        if (outstanding >= 5000 && drafts.length < 3) {
          drafts.push({
            code: `CREDIT-TOP-${row.customerId.slice(0, 8)}`,
            kind: AiInsightKind.CREDIT_RISK,
            severity: AiInsightSeverity.INFO,
            title: `Receivable watch — ${row.customerName}`,
            summary: `${row.customerName} carries Br ${outstanding.toLocaleString()} outstanding with no credit limit set.`,
            href: '/credits',
            confidence: 0.7,
            score: outstanding,
            source: AiInsightSource.RULES,
            payload: {
              analysis: 'high_exposure',
              customerId: row.customerId,
              customerName: row.customerName,
              outstanding,
              creditLimit: null,
            },
          });
        }
        continue;
      }
      const ratio = outstanding / limit;
      if (ratio < 0.75) continue;
      drafts.push({
        code: `CREDIT-EXPOSURE-${row.customerId.slice(0, 8)}`,
        kind: AiInsightKind.CREDIT_RISK,
        severity:
          ratio >= 1 ? AiInsightSeverity.CRITICAL : AiInsightSeverity.WARN,
        title: `High credit exposure — ${row.customerName}`,
        summary: `${row.customerName} has Br ${outstanding.toLocaleString()} outstanding (${Math.round(ratio * 100)}% of Br ${limit.toLocaleString()} limit).`,
        href: '/credits',
        confidence: 0.88,
        score: Math.round(ratio * 100),
        source: AiInsightSource.RULES,
        payload: {
          analysis: 'high_exposure',
          customerId: row.customerId,
          customerName: row.customerName,
          outstanding,
          creditLimit: limit,
          utilizationPercent: Math.round(ratio * 100),
        },
      });
    }

    // Unusual purchasing: last 14d sales vs prior 14d for credit customers
    const recent = new Date();
    recent.setDate(recent.getDate() - 14);
    const priorStart = new Date();
    priorStart.setDate(priorStart.getDate() - 28);

    const spend = await this.saleRepo
      .createQueryBuilder('s')
      .innerJoin(Customer, 'customer', 'customer.id = s.customer_id')
      .select('customer.id', 'customerId')
      .addSelect('customer.name', 'customerName')
      .addSelect(
        `COALESCE(SUM(CASE WHEN s.created_at >= :recent THEN s.total::numeric ELSE 0 END), 0)`,
        'recentTotal',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN s.created_at < :recent AND s.created_at >= :priorStart THEN s.total::numeric ELSE 0 END), 0)`,
        'priorTotal',
      )
      .where('s.created_at >= :priorStart', { priorStart })
      .andWhere('s.status = :st', { st: DocumentStatus.ACTIVE })
      .andWhere('s.customer_id IS NOT NULL')
      .setParameter('recent', recent)
      .groupBy('customer.id')
      .addGroupBy('customer.name')
      .getRawMany<{
        customerId: string;
        customerName: string;
        recentTotal: string;
        priorTotal: string;
      }>();

    for (const row of spend) {
      const recentTotal = Number(row.recentTotal) || 0;
      const priorTotal = Number(row.priorTotal) || 0;
      if (priorTotal < 1000 || recentTotal < priorTotal * 2) continue;
      drafts.push({
        code: `CREDIT-PATTERN-${row.customerId.slice(0, 8)}`,
        kind: AiInsightKind.CREDIT_RISK,
        severity: AiInsightSeverity.WARN,
        title: `Unusual purchasing — ${row.customerName}`,
        summary: `${row.customerName} spent Br ${recentTotal.toLocaleString()} in 14 days vs Br ${priorTotal.toLocaleString()} prior — review credit exposure.`,
        href: '/sales',
        confidence: 0.66,
        source: AiInsightSource.RULES,
        payload: {
          analysis: 'unusual_purchasing',
          customerId: row.customerId,
          customerName: row.customerName,
          recentTotal,
          priorTotal,
        },
      });
    }

    // Rising outstanding: open credits created in last 30d vs prior
    const rising = await this.customerCreditRepo
      .createQueryBuilder('c')
      .select(
        `COALESCE(SUM(CASE WHEN c.created_at >= :recent THEN c.balance::numeric ELSE 0 END), 0)`,
        'recentBal',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN c.created_at < :recent AND c.created_at >= :priorStart THEN c.balance::numeric ELSE 0 END), 0)`,
        'priorBal',
      )
      .where('c.status != :paid', { paid: CreditStatus.PAID })
      .setParameter('recent', recent)
      .setParameter('priorStart', priorStart)
      .getRawOne<{ recentBal: string; priorBal: string }>();

    const recentBal = Number(rising?.recentBal ?? 0);
    const priorBal = Number(rising?.priorBal ?? 0);
    if (priorBal > 0 && recentBal > priorBal * 1.25) {
      drafts.push({
        code: 'CREDIT-RISING-BOOK',
        kind: AiInsightKind.CREDIT_RISK,
        severity: AiInsightSeverity.WARN,
        title: 'Increasing outstanding balances',
        summary: `New open receivables Br ${recentBal.toLocaleString()} (14d) vs Br ${priorBal.toLocaleString()} prior period — tighten collections.`,
        href: '/credits',
        confidence: 0.72,
        source: AiInsightSource.RULES,
        payload: {
          analysis: 'increasing_outstanding',
          recentOpenBalance: recentBal,
          priorOpenBalance: priorBal,
        },
      });
    }

    return drafts.slice(0, 12);
  }

  private async buildMarketAlertDrafts(): Promise<InsightDraft[]> {
    if (!this.marketPrices) return [];
    try {
      const raw = await this.marketPrices.buildMarketInsightDrafts();
      return raw.map((d) => ({
        code: d.code,
        kind: AiInsightKind.MARKET_ALERT,
        severity:
          d.severity === 'critical'
            ? AiInsightSeverity.CRITICAL
            : d.severity === 'warn'
              ? AiInsightSeverity.WARN
              : AiInsightSeverity.INFO,
        title: d.title,
        summary: d.summary,
        href: d.href,
        confidence: 0.78,
        source: AiInsightSource.RULES,
        payload: d.payload,
      }));
    } catch (err) {
      this.logger.warn(
        `Market alert drafts skipped: ${err instanceof Error ? err.message : err}`,
      );
      return [];
    }
  }

  async ask(question: string) {
    const q = (question ?? '').trim();
    if (!q) {
      throw new BadRequestException('Question is required');
    }
    const lower = q.toLowerCase();
    const suggestions = [
      'How much Grade 1 coffee do we currently have?',
      'How much coffee is reserved for export?',
      'Who owes us the most money?',
      'Which supplier has the highest rejection rate?',
      'How much coffee did we export this month?',
      'What is our total outstanding balance?',
      'Which grade generated the highest profit?',
    ];

    type AskResult = {
      question: string;
      intent: string;
      answer: string;
      data?: Record<string, unknown>;
      href?: string;
      suggestions: string[];
    };

    const ok = (
      intent: string,
      answer: string,
      data?: Record<string, unknown>,
      href?: string,
    ): AskResult => ({
      question: q,
      intent,
      answer,
      data,
      href,
      suggestions,
    });

    if (
      /reserved|reservation/.test(lower) &&
      /export|coffee|stock|kg/.test(lower)
    ) {
      const row = await this.stockRepo
        .createQueryBuilder('s')
        .select(
          'COALESCE(SUM(COALESCE(s.reserved_quantity, 0)), 0)',
          'reserved',
        )
        .getRawOne<{ reserved: string }>();
      const reserved = Number(row?.reserved ?? 0);
      return ok(
        'reserved_export',
        `Approximately ${reserved.toLocaleString()} kg is currently reserved for export.`,
        { reservedKg: reserved },
        '/exports',
      );
    }

    if (
      (/how much|do we have|currently have|on hand|stock/.test(lower) &&
        /grade|coffee|green/.test(lower)) ||
      /grade\s*[12g]/i.test(lower)
    ) {
      const gradeMatch = lower.match(/grade\s*([0-9a-z]+)/i);
      const grade = gradeMatch
        ? gradeMatch[1].toUpperCase().startsWith('G')
          ? gradeMatch[1].toUpperCase()
          : `G${gradeMatch[1]}`
        : null;

      const qb = this.lotRepo
        .createQueryBuilder('l')
        .select('COALESCE(SUM(l.quantity::numeric), 0)', 'kg')
        .addSelect(
          `COALESCE(NULLIF(TRIM(l.grade), ''), 'Ungraded')`,
          'grade',
        )
        .where('l.status = :st', { st: LotStatus.ACTIVE })
        .andWhere('l.form = :form', { form: CoffeeForm.GREEN })
        .groupBy('grade');

      const rows = await qb.getRawMany<{ grade: string; kg: string }>();
      if (grade) {
        const hit = rows.find(
          (r) =>
            r.grade.toUpperCase() === grade ||
            r.grade.toUpperCase() === grade.replace(/^G/, ''),
        );
        const kg = Number(hit?.kg ?? 0);
        return ok(
          'stock_by_grade',
          `You currently have about ${kg.toLocaleString()} kg of Grade ${grade} green coffee on active lots.`,
          { grade, kg, byGrade: rows },
          '/lots',
        );
      }
      const total = rows.reduce((s, r) => s + (Number(r.kg) || 0), 0);
      const top = rows
        .map((r) => `${r.grade}: ${Number(r.kg).toFixed(0)} kg`)
        .slice(0, 5)
        .join('; ');
      return ok(
        'stock_by_grade',
        `Active green stock is about ${total.toLocaleString()} kg. By grade: ${top || 'none'}.`,
        { totalKg: total, byGrade: rows },
        '/lots',
      );
    }

    if (/owe|owes|outstanding|receivable|who.*money|debtor/.test(lower)) {
      const rows = await this.customerCreditRepo
        .createQueryBuilder('c')
        .innerJoin(Customer, 'customer', 'customer.id = c.customer_id')
        .select('customer.id', 'customerId')
        .addSelect('customer.name', 'customerName')
        .addSelect(
          `COALESCE(SUM(CASE WHEN c.status != 'PAID' THEN c.balance::numeric ELSE 0 END), 0)`,
          'outstanding',
        )
        .groupBy('customer.id')
        .addGroupBy('customer.name')
        .having(
          `COALESCE(SUM(CASE WHEN c.status != 'PAID' THEN c.balance::numeric ELSE 0 END), 0) > 0`,
        )
        .orderBy('outstanding', 'DESC')
        .take(5)
        .getRawMany<{
          customerId: string;
          customerName: string;
          outstanding: string;
        }>();

      if (/total outstanding|our total|overall outstanding/.test(lower)) {
        const total = rows.reduce((s, r) => s + (Number(r.outstanding) || 0), 0);
        return ok(
          'total_outstanding',
          `Total customer outstanding balance is Br ${total.toLocaleString()}.`,
          { totalOutstanding: total, top: rows },
          '/credits',
        );
      }

      const top = rows[0];
      if (!top) {
        return ok(
          'who_owes_most',
          'No open customer receivables right now.',
          { top: [] },
          '/credits',
        );
      }
      return ok(
        'who_owes_most',
        `${top.customerName} owes the most: Br ${Number(top.outstanding).toLocaleString()} outstanding.`,
        { top: rows },
        '/credits',
      );
    }

    if (/total outstanding|outstanding balance/.test(lower)) {
      const raw = await this.customerCreditRepo
        .createQueryBuilder('c')
        .select(
          `COALESCE(SUM(CASE WHEN c.status != 'PAID' THEN c.balance::numeric ELSE 0 END), 0)`,
          'outstanding',
        )
        .getRawOne<{ outstanding: string }>();
      const total = Number(raw?.outstanding ?? 0);
      return ok(
        'total_outstanding',
        `Total customer outstanding balance is Br ${total.toLocaleString()}.`,
        { totalOutstanding: total },
        '/credits',
      );
    }

    if (/rejection|reject rate|highest rejection|supplier/.test(lower)) {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const rows = await this.collectionRepo
        .createQueryBuilder('c')
        .innerJoin(Supplier, 'sup', 'sup.id = c.supplier_id')
        .select('sup.name', 'supplierName')
        .addSelect('COALESCE(SUM(c.weight_kg::numeric), 0)', 'totalKg')
        .addSelect(
          'COALESCE(SUM(c.rejected_weight_kg::numeric), 0)',
          'rejectedKg',
        )
        .where('c.created_at >= :since', { since })
        .groupBy('sup.name')
        .having('COALESCE(SUM(c.weight_kg::numeric), 0) > 0')
        .getRawMany<{
          supplierName: string;
          totalKg: string;
          rejectedKg: string;
        }>();

      const ranked = rows
        .map((r) => {
          const total = Number(r.totalKg) || 0;
          const rejected = Number(r.rejectedKg) || 0;
          return {
            supplierName: r.supplierName,
            rate: total > 0 ? (rejected / total) * 100 : 0,
            rejected,
            total,
          };
        })
        .sort((a, b) => b.rate - a.rate);

      const top = ranked[0];
      if (!top) {
        return ok(
          'supplier_rejection',
          'No collection rejection data found in the last 90 days.',
          {},
          '/collections',
        );
      }
      return ok(
        'supplier_rejection',
        `${top.supplierName} has the highest rejection rate at ${top.rate.toFixed(1)}% (${top.rejected.toFixed(0)} kg of ${top.total.toFixed(0)} kg).`,
        { top: ranked.slice(0, 5) },
        '/collections',
      );
    }

    if (/export(ed|s)? this month|how much.*export/.test(lower)) {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const raw = await this.exportRepo
        .createQueryBuilder('c')
        .select('COALESCE(SUM(c.shipped_kg::numeric), 0)', 'kg')
        .addSelect('COUNT(*)', 'contracts')
        .where('c.shipped_at >= :start', { start })
        .andWhere('c.status IN (:...st)', {
          st: [
            ExportContractStatus.SHIPPED,
            ExportContractStatus.DELIVERED,
            ExportContractStatus.CLOSED,
          ],
        })
        .getRawOne<{ kg: string; contracts: string }>();
      const kg = Number(raw?.kg ?? 0);
      return ok(
        'export_this_month',
        `This month you have exported about ${kg.toLocaleString()} kg across ${raw?.contracts ?? 0} shipped contract(s).`,
        { shippedKg: kg, contracts: Number(raw?.contracts ?? 0) },
        '/exports',
      );
    }

    if (/highest profit|most profit|profit.*grade|grade.*profit/.test(lower)) {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const rows = await this.saleLineRepo
        .createQueryBuilder('line')
        .innerJoin('line.sale', 'sale')
        .leftJoin(Lot, 'lot', 'lot.id = line.lot_id')
        .select(
          `COALESCE(NULLIF(TRIM(lot.grade), ''), 'Ungraded')`,
          'grade',
        )
        .addSelect(
          'COALESCE(SUM(line."lineTotal"::numeric), 0)',
          'revenue',
        )
        .addSelect(
          'COALESCE(SUM(line.quantity::numeric * line.purchase_cost::numeric), 0)',
          'cogs',
        )
        .where('sale.created_at >= :since', { since })
        .andWhere('sale.status = :st', { st: DocumentStatus.ACTIVE })
        .groupBy('grade')
        .getRawMany<{ grade: string; revenue: string; cogs: string }>();

      const ranked = rows
        .map((r) => {
          const revenue = Number(r.revenue) || 0;
          const cogs = Number(r.cogs) || 0;
          return {
            grade: r.grade,
            revenue,
            cogs,
            profit: revenue - cogs,
          };
        })
        .sort((a, b) => b.profit - a.profit);

      const top = ranked[0];
      if (!top) {
        return ok(
          'profit_by_grade',
          'Not enough sale/lot data to rank profit by grade yet.',
          {},
          '/reports?tab=profit-loss',
        );
      }
      return ok(
        'profit_by_grade',
        `Grade ${top.grade} generated the highest estimated gross profit: Br ${top.profit.toLocaleString()} over the last 90 days.`,
        { top: ranked.slice(0, 5) },
        '/reports?tab=profit-loss',
      );
    }

    return ok(
      'unknown',
      'I can answer stock, export reservation, receivables, supplier rejection, monthly exports, and profit-by-grade questions. Try one of the suggestions below.',
      {},
      '/insights',
    );
  }

  private lastNDays(n: number): string[] {
    const out: string[] = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = n - 1; i >= 0; i--) {
      const day = new Date(d);
      day.setDate(d.getDate() - i);
      out.push(day.toISOString().slice(0, 10));
    }
    return out;
  }

  private nextWeeks(n: number): string[] {
    const out: string[] = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const toMon = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + toMon);
    for (let i = 0; i < n; i++) {
      const start = new Date(d);
      start.setDate(d.getDate() + i * 7);
      out.push(start.toISOString().slice(0, 10));
    }
    return out;
  }
}
