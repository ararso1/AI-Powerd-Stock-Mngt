/** Prefer the richest tabular array in a report payload. */
const ARRAY_KEYS = [
  "items",
  "dailyBalances",
  "lots",
  "runs",
  "contracts",
  "transfers",
  "adjustments",
  "tickets",
  "transactions",
  "accounts",
  "approvals",
  "users",
  "prices",
  "reps",
  "customers",
  "suppliers",
  "byPaymentMethod",
  "byLocation",
  "byPurchaseType",
  "byCategory",
  "byForm",
  "byStatus",
  "byDepartment",
  "byDisposition",
  "rows",
] as const;

export type ReportKpi = { label: string; value: string };

function humanize(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function extractReportRows(
  data: Record<string, unknown> | null | undefined
): Record<string, unknown>[] {
  if (!data) return [];
  for (const key of ARRAY_KEYS) {
    const candidate = data[key];
    if (
      Array.isArray(candidate) &&
      candidate.length > 0 &&
      typeof candidate[0] === "object" &&
      candidate[0] !== null
    ) {
      return candidate as Record<string, unknown>[];
    }
  }
  const customers = data.customers as { byCustomer?: unknown } | undefined;
  if (Array.isArray(customers?.byCustomer) && customers.byCustomer.length) {
    return customers.byCustomer as Record<string, unknown>[];
  }
  const suppliers = data.suppliers as { bySupplier?: unknown } | undefined;
  if (Array.isArray(suppliers?.bySupplier) && suppliers.bySupplier.length) {
    return suppliers.bySupplier as Record<string, unknown>[];
  }
  return [];
}

export function extractReportKpis(
  data: Record<string, unknown> | null | undefined
): ReportKpi[] {
  if (!data) return [];
  const kpis: ReportKpi[] = [];
  const skip = new Set([
    "currency",
    "period",
    "items",
    "dailyBalances",
    "lots",
    "runs",
    "contracts",
    "transfers",
    "adjustments",
    "tickets",
    "transactions",
    "accounts",
    "approvals",
    "users",
    "prices",
    "reps",
    "customers",
    "suppliers",
    "aging",
    "byPaymentMethod",
    "byLocation",
    "byPurchaseType",
    "byCategory",
    "byForm",
    "byStatus",
    "byDepartment",
    "byDisposition",
    "rows",
  ]);

  if (data.totals && typeof data.totals === "object") {
    for (const [k, v] of Object.entries(data.totals as Record<string, unknown>)) {
      if (v !== null && typeof v !== "object") {
        kpis.push({ label: humanize(k), value: String(v) });
      }
    }
  }

  for (const [k, v] of Object.entries(data)) {
    if (skip.has(k)) continue;
    if (v !== null && (typeof v === "string" || typeof v === "number")) {
      kpis.push({ label: humanize(k), value: String(v) });
    }
  }

  if (data.counts && typeof data.counts === "object") {
    for (const [k, v] of Object.entries(data.counts as Record<string, unknown>)) {
      if (v !== null && typeof v !== "object") {
        kpis.push({ label: humanize(`counts.${k}`), value: String(v) });
      }
    }
  }

  return kpis.slice(0, 12);
}

export function rowColumns(rows: Record<string, unknown>[]) {
  if (!rows.length) return [] as string[];
  const keys = new Set<string>();
  for (const row of rows.slice(0, 50)) {
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && typeof v === "object") continue;
      keys.add(k);
    }
  }
  return [...keys];
}

export function cellValue(
  row: Record<string, unknown>,
  key: string
): string {
  return formatCell(row[key]);
}
