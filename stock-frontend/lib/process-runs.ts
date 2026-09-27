import type { ProcessRunStatus } from "@/lib/types";

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
