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

const PURCHASE_VOID_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Void is allowed only during the first 7 days after the purchase is created. */
export function canVoidPurchase(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= PURCHASE_VOID_WINDOW_MS;
}
