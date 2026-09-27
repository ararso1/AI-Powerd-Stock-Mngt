import { ProcessRunStatus, PurchaseType } from '../common/enums';
import { ProcessRun } from '../database/entities/process-run.entity';
import {
  LOCAL_MARKET_STAGES,
  type LocalStagePack,
  type LocalStageResult,
} from './local-market.stages';

const OPEN_STATUSES = new Set<ProcessRunStatus>([
  ProcessRunStatus.IN_PROGRESS,
  ProcessRunStatus.QC_HOLD,
  ProcessRunStatus.READY,
]);

const PIPELINE_STAGES = [...LOCAL_MARKET_STAGES];

export interface ProcessStageLine {
  id: string;
  runNumber: string;
  lotCode: string | null;
  locationName: string | null;
  kg: string;
}

export interface ProcessStageBucket {
  stage: string;
  runs: number;
  kg: string;
  lines: ProcessStageLine[];
}

export interface ProcessOverview {
  pipeline: ProcessStageBucket[];
  report: {
    runs: number;
    openRuns: number;
    completedRuns: number;
    cancelledRuns: number;
    inputKg: string;
    outputKg: string;
    lossKg: string;
    rejectKg: string;
    openKg: string;
    averageYieldPercent: string | null;
    highLossRuns: number;
    underScreenRuns: number;
    cleanedKg: string;
    roastKg: string;
    groundKg: string;
    unallocatedKg: string;
    byStatus: { status: string; runs: number; inputKg: string }[];
    byWorkflow: {
      workflow: string;
      runs: number;
      inputKg: string;
    }[];
    packs: { label: string; count: number; kg: string }[];
  };
}

function num(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : parseFloat(value ?? '');
  return Number.isFinite(n) ? n : 0;
}

function kg(value: number): string {
  return (Math.round((value + Number.EPSILON) * 1000) / 1000).toFixed(3);
}

function inDateRange(
  createdAt: Date | string | undefined,
  from?: string,
  to?: string,
): boolean {
  if (!from && !to) return true;
  const time = new Date(createdAt ?? 0).getTime();
  if (Number.isNaN(time)) return false;
  if (from && time < new Date(from).getTime()) return false;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (time > end.getTime()) return false;
  }
  return true;
}

export function currentProcessStage(run: ProcessRun): string | null {
  if (!OPEN_STATUSES.has(run.status)) return null;
  const stages = run.stages ?? [];
  if (run.currentStageIndex < 0 || run.currentStageIndex >= stages.length) {
    return null;
  }
  return stages[run.currentStageIndex] ?? null;
}

/** Kilograms sitting at the run's current stage. */
export function kgAtCurrentStage(run: ProcessRun): number {
  const stage = currentProcessStage(run);
  if (!stage) return 0;
  const results = run.stageResults ?? [];
  const input = num(run.quantityInput);
  if (stage === 'Processing Started') return input;
  if (stage === 'Cleaning') {
    const started = results.find((row) => row.stage === 'Processing Started');
    return started ? num(started.outputQty) : input;
  }
  if (stage === 'Roast & Ground') {
    const cleaning = results.find((row) => row.stage === 'Cleaning');
    return cleaning ? num(cleaning.outputQty) : input;
  }
  if (stage === 'Sales Store') {
    const roast = results.find((row) => row.stage === 'Roast & Ground');
    if (!roast) return 0;
    const roastQty = parseFloat(roast.roastQty ?? '');
    const groundQty = parseFloat(roast.groundQty ?? '');
    if (Number.isFinite(roastQty) || Number.isFinite(groundQty)) {
      return (
        (Number.isFinite(roastQty) ? roastQty : 0) +
        (Number.isFinite(groundQty) ? groundQty : 0)
      );
    }
    return num(roast.outputQty);
  }
  return input;
}

function packLabel(pack: LocalStagePack): string {
  const size =
    pack.sizeKg === 0.5 ? '0.5 kg' : pack.sizeKg === 1 ? '1 kg' : `${pack.sizeKg} kg`;
  const sku = pack.sku?.toUpperCase() ?? '';
  if (pack.kind === 'GROUND' || sku.includes('GROUND')) return `Ground ${size}`;
  if (pack.kind === 'ROAST' || sku.includes('ROAST')) return `Roast ${size}`;
  return `Packaged ${size}`;
}

function workflowKey(workflow: PurchaseType | null): string {
  if (workflow === PurchaseType.LOCAL) return 'LOCAL';
  if (workflow === PurchaseType.EXPORT) return 'EXPORT';
  return 'MILL';
}

export function summarizeProcessRuns(
  runs: ProcessRun[],
  range?: { from?: string; to?: string },
): ProcessOverview {
  const buckets = new Map<string, ProcessStageBucket>(
    PIPELINE_STAGES.map((stage) => [
      stage,
      { stage, runs: 0, kg: '0.000', lines: [] },
    ]),
  );

  for (const run of runs) {
    const stage = currentProcessStage(run);
    if (!stage || !buckets.has(stage)) continue;
    const amount = kgAtCurrentStage(run);
    const bucket = buckets.get(stage)!;
    bucket.runs += 1;
    bucket.lines.push({
      id: run.id,
      runNumber: run.runNumber,
      lotCode: run.inputLot?.code ?? null,
      locationName: run.location?.name ?? null,
      kg: kg(amount),
    });
  }

  const pipeline = PIPELINE_STAGES.map((stage) => {
    const bucket = buckets.get(stage)!;
    const total = bucket.lines.reduce((sum, line) => sum + num(line.kg), 0);
    bucket.lines.sort((a, b) => num(b.kg) - num(a.kg));
    return { ...bucket, kg: kg(total) };
  });

  const reportRuns = runs.filter((run) =>
    inDateRange(run.createdAt, range?.from, range?.to),
  );
  const active = reportRuns.filter(
    (run) => run.status !== ProcessRunStatus.CANCELLED,
  );
  const completed = reportRuns.filter(
    (run) => run.status === ProcessRunStatus.COMPLETED,
  );
  const yields = completed
    .map((run) => num(run.actualYieldPercent))
    .filter((value) => value > 0);

  const statusOrder = Object.values(ProcessRunStatus);
  const byStatus = statusOrder.map((status) => {
    const rows = reportRuns.filter((run) => run.status === status);
    return {
      status,
      runs: rows.length,
      inputKg: kg(rows.reduce((sum, run) => sum + num(run.quantityInput), 0)),
    };
  });

  const workflowOrder = ['LOCAL', 'EXPORT', 'MILL'] as const;
  const byWorkflow = workflowOrder.map((workflow) => {
    const rows = active.filter((run) => workflowKey(run.workflow) === workflow);
    return {
      workflow,
      runs: rows.length,
      inputKg: kg(rows.reduce((sum, run) => sum + num(run.quantityInput), 0)),
    };
  });

  let highLossRuns = 0;
  let underScreenRuns = 0;
  let cleanedKg = 0;
  let roastKg = 0;
  let groundKg = 0;
  let unallocatedKg = 0;
  const packMap = new Map<string, { count: number; kg: number }>();

  for (const run of active) {
    const results = run.stageResults ?? [];
    if (results.some((row) => row.warnings?.includes('HIGH_LOSS'))) {
      highLossRuns += 1;
    }
    if (results.some((row) => row.warnings?.includes('UNDER_SCREEN'))) {
      underScreenRuns += 1;
    }
    const cleaning = resultFor(results, 'Cleaning');
    if (cleaning) cleanedKg += num(cleaning.outputQty);
    const roast = resultFor(results, 'Roast & Ground');
    if (roast) {
      const splitRoast = parseFloat(roast.roastQty ?? '');
      const splitGround = parseFloat(roast.groundQty ?? '');
      if (Number.isFinite(splitRoast) || Number.isFinite(splitGround)) {
        roastKg += Number.isFinite(splitRoast) ? splitRoast : 0;
        groundKg += Number.isFinite(splitGround) ? splitGround : 0;
        unallocatedKg += num(roast.unallocatedKg);
      } else {
        roastKg += num(roast.outputQty);
      }
    }
    const sales = resultFor(results, 'Sales Store');
    for (const pack of sales?.packs ?? []) {
      const label = packLabel(pack);
      const row = packMap.get(label) ?? { count: 0, kg: 0 };
      row.count += pack.count;
      row.kg += pack.count * pack.sizeKg;
      packMap.set(label, row);
    }
  }

  const openInReport = reportRuns.filter((run) => OPEN_STATUSES.has(run.status));

  return {
    pipeline,
    report: {
      runs: reportRuns.length,
      openRuns: openInReport.length,
      completedRuns: completed.length,
      cancelledRuns: reportRuns.filter(
        (run) => run.status === ProcessRunStatus.CANCELLED,
      ).length,
      inputKg: kg(active.reduce((sum, run) => sum + num(run.quantityInput), 0)),
      outputKg: kg(
        completed.reduce((sum, run) => sum + num(run.quantityOutput), 0),
      ),
      lossKg: kg(active.reduce((sum, run) => sum + num(run.quantityLoss), 0)),
      rejectKg: kg(
        active.reduce((sum, run) => sum + num(run.quantityReject), 0),
      ),
      openKg: kg(openInReport.reduce((sum, run) => sum + kgAtCurrentStage(run), 0)),
      averageYieldPercent:
        yields.length > 0
          ? (yields.reduce((sum, value) => sum + value, 0) / yields.length).toFixed(
              2,
            )
          : null,
      highLossRuns,
      underScreenRuns,
      cleanedKg: kg(cleanedKg),
      roastKg: kg(roastKg),
      groundKg: kg(groundKg),
      unallocatedKg: kg(unallocatedKg),
      byStatus,
      byWorkflow,
      packs: [...packMap.entries()]
        .map(([label, row]) => ({
          label,
          count: row.count,
          kg: kg(row.kg),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    },
  };
}

function resultFor(
  results: LocalStageResult[],
  stage: LocalStageResult['stage'],
): LocalStageResult | undefined {
  return results.find((row) => row.stage === stage);
}
