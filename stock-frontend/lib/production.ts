import type { ProductionOrderStatus } from "@/lib/types";

export const PRODUCTION_STATUS_OPTIONS: {
  value: ProductionOrderStatus;
  label: string;
}[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "RELEASED", label: "Released" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function productionStatusLabel(
  status: string | undefined
): string {
  if (!status) return "—";
  return (
    PRODUCTION_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? status.replace(/_/g, " ")
  );
}
