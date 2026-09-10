import type { StockRecord } from "@/lib/types";

export function parseStockQty(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

export function parseReorderPoint(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

/** Client-side low-stock hint when full low-stock row is unavailable. */
export function isLowStockRow(row: StockRecord): boolean {
  const qty = parseStockQty(row.quantity);
  if (qty <= 0) return true;
  const reorder = parseReorderPoint(row.reorderPoint);
  return reorder !== null && qty <= reorder;
}

export function reorderPointBodyValue(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = parseFloat(trimmed);
  return Number.isNaN(n) ? undefined : n;
}

/** Empty string clears optional catalog fields (`sku`, `unit`) via `null`. */
export function optionalStringBodyValue(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}
