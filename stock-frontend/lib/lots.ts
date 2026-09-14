import type {
  CoffeeForm,
  LotEventType,
  LotQcPhase,
  LotStatus,
  ReceivingDisposition,
} from "@/lib/types";

export const COFFEE_FORM_OPTIONS: { value: CoffeeForm; label: string }[] = [
  { value: "CHERRY", label: "Cherry" },
  { value: "PARCHMENT", label: "Parchment" },
  { value: "GREEN", label: "Green" },
  { value: "ROASTED", label: "Roasted" },
  { value: "FLOUR", label: "Flour" },
  { value: "PACKAGED", label: "Packaged" },
  { value: "REJECT", label: "Reject" },
];

export const LOT_STATUS_OPTIONS: { value: LotStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "HOLD", label: "Hold" },
  { value: "VOIDED", label: "Voided" },
];

export const LOT_QC_PHASE_OPTIONS: { value: LotQcPhase; label: string }[] = [
  { value: "RECEIVED", label: "Received" },
  { value: "SAMPLE_TESTED", label: "Sample tested" },
  { value: "GRADED", label: "Graded" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PROCESSED", label: "Processed" },
  { value: "FINAL_GRADE", label: "Final grade" },
];

export const RECEIVING_DISPOSITION_OPTIONS: {
  value: ReceivingDisposition;
  label: string;
}[] = [
  { value: "ACCEPTED", label: "Fully accepted" },
  { value: "PARTIAL", label: "Partially accepted" },
  { value: "REJECTED", label: "Fully rejected" },
];

export function coffeeFormLabel(form: CoffeeForm | string): string {
  return COFFEE_FORM_OPTIONS.find((o) => o.value === form)?.label ?? form;
}

export function lotStatusLabel(status: LotStatus | string): string {
  return LOT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function lotQcPhaseLabel(phase: LotQcPhase | string | undefined): string {
  if (!phase) return "—";
  return LOT_QC_PHASE_OPTIONS.find((o) => o.value === phase)?.label ?? phase;
}

export function receivingDispositionLabel(
  d: ReceivingDisposition | string | undefined
): string {
  if (!d) return "—";
  return (
    RECEIVING_DISPOSITION_OPTIONS.find((o) => o.value === d)?.label ?? d
  );
}

export function lotEventLabel(type: LotEventType | string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
