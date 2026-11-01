export type ReportFilterKey =
  | "location"
  | "customer"
  | "supplier"
  | "soldBy"
  | "category"
  | "channel"
  | "purchaseType"
  | "workflow"
  | "status"
  | "form"
  | "disposition"
  | "entityType"
  | "employmentStatus"
  | "symbol"
  | "direction"
  | "reason";

export type SelectOption = { value: string; label: string };

/** Which extra filters each report shows (period + location are handled separately). */
export const REPORT_FILTERS: Record<string, ReportFilterKey[]> = {
  summary: ["location", "channel"],
  "profit-loss": [],
  "cash-flow": [],
  expenses: ["category"],
  banks: [],
  "market-snapshot": ["symbol"],
  sales: ["location", "customer", "soldBy", "channel"],
  "sales-by-item": ["location", "channel"],
  commissions: ["soldBy", "channel"],
  purchases: ["location", "supplier", "purchaseType"],
  "purchases-by-item": ["location", "supplier", "purchaseType"],
  "inventory-aging": ["location"],
  "inventory-on-hand": ["location"],
  "inventory-adjustments": ["location", "direction", "reason"],
  transfers: ["location", "status"],
  lots: ["location", "status", "form"],
  collections: ["location", "supplier", "disposition", "status"],
  "process-yield": ["location", "status", "workflow"],
  "exports-pipeline": ["status"],
  "customer-activity": ["customer"],
  "supplier-activity": ["supplier"],
  credits: ["customer", "supplier"],
  approvals: ["status", "entityType"],
  "hr-headcount": ["employmentStatus"],
};

export const CHANNEL_OPTIONS: SelectOption[] = [
  { value: "LOCAL", label: "Local" },
  { value: "EXPORT", label: "Export" },
];

export const PURCHASE_TYPE_OPTIONS: SelectOption[] = [
  { value: "LOCAL", label: "Local" },
  { value: "EXPORT", label: "Export" },
];

export const LOT_STATUS_OPTIONS: SelectOption[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "HOLD", label: "Hold" },
  { value: "VOIDED", label: "Voided" },
];

export const TRANSFER_STATUS_OPTIONS: SelectOption[] = [
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const EXPORT_STATUS_OPTIONS: SelectOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "ALLOCATED", label: "Allocated" },
  { value: "STAGED", label: "Staged" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const PROCESS_STATUS_OPTIONS: SelectOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Pending approval" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "QC_HOLD", label: "QC hold" },
  { value: "READY", label: "Ready" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const APPROVAL_STATUS_OPTIONS: SelectOption[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const COFFEE_FORM_OPTIONS: SelectOption[] = [
  { value: "CHERRY", label: "Cherry" },
  { value: "PARCHMENT", label: "Parchment" },
  { value: "GREEN", label: "Green" },
  { value: "ROASTED", label: "Roasted" },
  { value: "FLOUR", label: "Flour" },
  { value: "PACKAGED", label: "Packaged" },
  { value: "REJECT", label: "Reject" },
];

export const DISPOSITION_OPTIONS: SelectOption[] = [
  { value: "ACCEPTED", label: "Accepted" },
  { value: "PARTIAL", label: "Partial" },
  { value: "REJECTED", label: "Rejected" },
];

export const ENTITY_TYPE_OPTIONS: SelectOption[] = [
  { value: "PURCHASE", label: "Purchase" },
  { value: "SALE", label: "Sale" },
  { value: "PROCESS_RUN", label: "Process run" },
];

export const EMPLOYMENT_STATUS_OPTIONS: SelectOption[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "TERMINATED", label: "Terminated" },
];

export const SYMBOL_OPTIONS: SelectOption[] = [
  { value: "KC", label: "KC (Arabica)" },
  { value: "RC", label: "RC (Robusta)" },
];

export const DIRECTION_OPTIONS: SelectOption[] = [
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
];

export const ADJUSTMENT_REASON_OPTIONS: SelectOption[] = [
  { value: "DAMAGE", label: "Damage" },
  { value: "LOSS", label: "Loss" },
  { value: "FOUND", label: "Found" },
  { value: "COUNT", label: "Count" },
  { value: "OPENING", label: "Opening" },
  { value: "RETURN", label: "Return" },
  { value: "MOISTURE_LOSS", label: "Moisture loss" },
  { value: "SHRINKAGE", label: "Shrinkage" },
  { value: "QC_REJECT", label: "QC reject" },
  { value: "OTHER", label: "Other" },
];

/** Collection ticket document status (common values). */
export const COLLECTION_STATUS_OPTIONS: SelectOption[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "VOIDED", label: "Voided" },
  { value: "PENDING_APPROVAL", label: "Pending approval" },
  { value: "REJECTED", label: "Rejected" },
];

export function statusOptionsForReport(reportId: string): SelectOption[] {
  switch (reportId) {
    case "lots":
      return LOT_STATUS_OPTIONS;
    case "transfers":
      return TRANSFER_STATUS_OPTIONS;
    case "exports-pipeline":
      return EXPORT_STATUS_OPTIONS;
    case "process-yield":
      return PROCESS_STATUS_OPTIONS;
    case "approvals":
      return APPROVAL_STATUS_OPTIONS;
    case "collections":
      return COLLECTION_STATUS_OPTIONS;
    default:
      return [];
  }
}
