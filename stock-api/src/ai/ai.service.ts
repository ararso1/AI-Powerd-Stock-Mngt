import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
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
  ExportContractStatus,
  LotEventType,
  LotStatus,
} from '../common/enums';
import { AiFeedback } from '../database/entities/ai-feedback.entity';
import { AiInsight } from '../database/entities/ai-insight.entity';
import { CollectionTicket } from '../database/entities/collection-ticket.entity';
import { ExportContract } from '../database/entities/export-contract.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
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

    const weeks = this.nextWeeks(4);
    const forecast = weeks.map((week, i) => ({
      week,
      projectedGreenNeedKg: [420, 480, 510, 460][i],
      projectedIntakeKg: [2800, 3100, 2950, 3300][i],
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
    const avgIntake =
      dailyOps.reduce((s, d) => s + d.intakeKg, 0) /
      Math.max(1, dailyOps.length);
    highlights.push(
      `Intake pace ~${Math.round(avgIntake)} kg/day (${useDemoFill ? 'demo-filled' : 'live'} 14-day trend).`,
    );
    const avgSold =
      dailyOps.reduce((s, d) => s + d.soldKg, 0) / Math.max(1, dailyOps.length);
    if (avgSold > 0) {
      highlights.push(
        `Outbound (local/export events) ~${Math.round(avgSold)} kg/day.`,
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
    ];

    return {
      generatedAt: new Date().toISOString(),
      demoFilled: useDemoFill,
      highlights,
      stockByForm,
      stockByLocation,
      dailyOps,
      forecast,
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
