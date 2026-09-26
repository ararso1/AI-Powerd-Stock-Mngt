export const PURCHASE_TYPE_OPTIONS = [
  { value: "LOCAL", label: "Local market" },
  { value: "EXPORT", label: "Export" },
] as const;

export function purchaseTypeLabel(type?: string | null): string {
  if (!type) return "—";
  if (type === "LOCAL") return "Local market";
  if (type === "EXPORT") return "Export";
  return type;
}
