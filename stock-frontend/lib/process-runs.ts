import { formatQty } from "@/lib/format";
import type {
  ExportDoniyaLabel,
  ProcessRun,
  ProcessRunStatus,
} from "@/lib/types";

export const PROCESS_STATUS_OPTIONS: {
  value: ProcessRunStatus;
  label: string;
}[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "QC_HOLD", label: "QC hold" },
  { value: "READY", label: "Ready" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function processStatusLabel(status: ProcessRunStatus | string): string {
  return (
    PROCESS_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
  );
}

const PROCESS_STATUS_CLASS: Record<ProcessRunStatus, string> = {
  DRAFT: "border-transparent bg-muted text-muted-foreground",
  IN_PROGRESS: "border-transparent bg-primary/15 text-primary",
  QC_HOLD: "border-transparent bg-warning text-warning-foreground",
  READY: "border-transparent bg-info text-info-foreground",
  COMPLETED:
    "border-transparent bg-[var(--csolve-moss)] text-[var(--csolve-parchment)]",
  CANCELLED: "border-transparent bg-destructive/10 text-destructive",
};

export function processStatusClass(status: ProcessRunStatus | string): string {
  return (
    PROCESS_STATUS_CLASS[status as ProcessRunStatus] ??
    "border-transparent bg-muted text-muted-foreground"
  );
}

export const PROCESS_WORKFLOW_OPTIONS = [
  { value: "LOCAL", label: "Local market" },
  { value: "EXPORT", label: "Export" },
] as const;

export function processWorkflowLabel(workflow?: string | null): string {
  if (workflow === "LOCAL") return "Local market processing";
  if (workflow === "EXPORT") return "Export processing";
  if (workflow === "MILL") return "Mill / other";
  return "Mill / other";
}

export const PROCESS_STAGE_OPTIONS = [
  { value: "Processing Started", label: "Processing started" },
  { value: "Cleaning", label: "Cleaning" },
  { value: "Roast & Ground", label: "Roast & ground" },
  { value: "Sales Store", label: "Sales store" },
  { value: "Packaging", label: "Packaging" },
  { value: "Export Store", label: "Export store" },
  { value: "Packaging & Export Store", label: "Packaging & export store" },
] as const;

export function processStageLabel(stage?: string | null): string {
  return (
    PROCESS_STAGE_OPTIONS.find((option) => option.value === stage)?.label ??
    stage ??
    "—"
  );
}

export function currentProcessStage(run: {
  status: string;
  stages?: string[] | null;
  currentStageIndex: number;
}): string | null {
  if (run.status === "COMPLETED" || run.status === "CANCELLED") return null;
  const stages = run.stages ?? [];
  if (run.currentStageIndex < 0 || run.currentStageIndex >= stages.length) {
    return null;
  }
  return stages[run.currentStageIndex] ?? null;
}

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
    byWorkflow: { workflow: string; runs: number; inputKg: string }[];
    packs: { label: string; count: number; kg: string }[];
  };
}

function qty(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
}

/** Usable coffee left after export losses, including kilograms that did not fill a Doniya. */
export function exportRunYieldPercent(run: Pick<
  ProcessRun,
  "quantityInput" | "quantityReject" | "stageResults"
>): number | null {
  const input = qty(run.quantityInput);
  if (input <= 0) return null;
  const results = run.stageResults ?? [];
  const packaged = [...results]
    .reverse()
    .find(
      (row) =>
        row.stage === "Packaging" ||
        row.stage === "Export Store" ||
        row.stage === "Packaging & Export Store"
    );
  if (packaged && "packagedKg" in packaged && packaged.packagedKg != null) {
    const kept = qty(packaged.packagedKg) + qty(packaged.remainderKg);
    return (kept / input) * 100;
  }
  if (results.length === 0) return null;
  return ((input - qty(run.quantityReject)) / input) * 100;
}

export function processRunYieldLabel(
  run: Pick<
    ProcessRun,
    | "workflow"
    | "quantityInput"
    | "quantityReject"
    | "expectedYieldPercent"
    | "actualYieldPercent"
    | "stageResults"
  >
): string {
  if (run.workflow === "EXPORT") {
    const percent = exportRunYieldPercent(run);
    if (percent != null) return `${formatQty(percent)}%`;
  } else if (run.actualYieldPercent) {
    return `${formatQty(run.actualYieldPercent)}%`;
  }
  return `~${formatQty(run.expectedYieldPercent)}%`;
}

export function exportRunDoniyaLabel(
  run: Pick<ProcessRun, "stageResults">
): ExportDoniyaLabel | null {
  const results = run.stageResults ?? [];
  for (const stage of [
    "Export Store",
    "Packaging & Export Store",
    "Packaging",
  ]) {
    const found = results.find((row) => row.stage === stage);
    if (found && "doniyaLabel" in found && found.doniyaLabel) {
      return found.doniyaLabel;
    }
  }
  return null;
}
