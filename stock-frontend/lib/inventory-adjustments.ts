import type {
  StockAdjustmentDirection,
  StockAdjustmentReason,
} from "@/lib/types";

export const STOCK_ADJUSTMENT_REASON_OPTIONS: {
  value: StockAdjustmentReason;
  label: string;
  /** When set, direction is fixed for this reason. */
  requiredDirection?: StockAdjustmentDirection;
}[] = [
  { value: "DAMAGE", label: "Damage", requiredDirection: "out" },
  { value: "LOSS", label: "Loss", requiredDirection: "out" },
  { value: "FOUND", label: "Found", requiredDirection: "in" },
  { value: "OPENING", label: "Opening balance", requiredDirection: "in" },
  { value: "COUNT", label: "Cycle count" },
  { value: "RETURN", label: "Return" },
  {
    value: "MOISTURE_LOSS",
    label: "Moisture loss",
    requiredDirection: "out",
  },
  { value: "SHRINKAGE", label: "Shrinkage", requiredDirection: "out" },
  { value: "QC_REJECT", label: "QC reject", requiredDirection: "out" },
  { value: "OTHER", label: "Other" },
];

export function stockAdjustmentReasonLabel(
  reason: string | undefined
): string {
  if (!reason) return "—";
  const match = STOCK_ADJUSTMENT_REASON_OPTIONS.find(
    (option) => option.value === reason
  );
  return match?.label ?? reason.replace(/_/g, " ");
}

export function reasonsForDirection(
  direction: StockAdjustmentDirection
): typeof STOCK_ADJUSTMENT_REASON_OPTIONS {
  return STOCK_ADJUSTMENT_REASON_OPTIONS.filter(
    (option) =>
      !option.requiredDirection || option.requiredDirection === direction
  );
}

export function directionForReason(
  reason: StockAdjustmentReason
): StockAdjustmentDirection | undefined {
  return STOCK_ADJUSTMENT_REASON_OPTIONS.find(
    (option) => option.value === reason
  )?.requiredDirection;
}
