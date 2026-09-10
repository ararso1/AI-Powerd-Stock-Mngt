import type {
  ReportCustomerActivity,
  ReportCustomerActivityRow,
  ReportSupplierActivity,
  ReportSupplierActivityRow,
} from "@/lib/types";

export function reportCustomerActivityRows(
  report:
    | ReportCustomerActivity
    | ReportCustomerActivityRow[]
    | null
    | undefined
): ReportCustomerActivityRow[] {
  if (!report) return [];
  if (Array.isArray(report)) return report;
  return report.customers ?? [];
}

export function reportSupplierActivityRows(
  report:
    | ReportSupplierActivity
    | ReportSupplierActivityRow[]
    | null
    | undefined
): ReportSupplierActivityRow[] {
  if (!report) return [];
  if (Array.isArray(report)) return report;
  return report.suppliers ?? [];
}

export function customerActivitySpend(row: ReportCustomerActivityRow): string {
  return row.totalSpent ?? row.totalSpend ?? "0";
}

export function customerActivitySaleCount(row: ReportCustomerActivityRow): number {
  return row.salesCount ?? row.saleCount ?? 0;
}

export function sumCustomerActivitySpend(
  report:
    | ReportCustomerActivity
    | ReportCustomerActivityRow[]
    | null
    | undefined
): string {
  return reportCustomerActivityRows(report)
    .reduce((sum, row) => sum + (parseFloat(customerActivitySpend(row)) || 0), 0)
    .toFixed(2);
}

export function sumSupplierActivityPurchased(
  report:
    | ReportSupplierActivity
    | ReportSupplierActivityRow[]
    | null
    | undefined
): string {
  return reportSupplierActivityRows(report)
    .reduce(
      (sum, row) => sum + (parseFloat(row.totalPurchased) || 0),
      0
    )
    .toFixed(2);
}
