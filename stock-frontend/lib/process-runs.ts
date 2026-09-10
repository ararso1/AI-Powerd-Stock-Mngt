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
