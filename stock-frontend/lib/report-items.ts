import type {
  ReportInventoryAging,
  ReportInventoryAgingRow,
  ReportPurchasesByItem,
  ReportPurchasesByItemRow,
  ReportSalesByItem,
  ReportSalesByItemRow,
} from "@/lib/types";

export function reportItemRows<T>(
  report: { items?: T[] } | T[] | null | undefined
): T[] {
  if (!report) return [];
  if (Array.isArray(report)) return report;
  return report.items ?? [];
}

export function reportSalesByItemRows(
  report: ReportSalesByItem | ReportSalesByItemRow[] | null | undefined
): ReportSalesByItemRow[] {
  return reportItemRows(report);
}

export function reportPurchasesByItemRows(
  report: ReportPurchasesByItem | ReportPurchasesByItemRow[] | null | undefined
): ReportPurchasesByItemRow[] {
  return reportItemRows(report);
}

export function reportInventoryAgingRows(
  report: ReportInventoryAging | ReportInventoryAgingRow[] | null | undefined
): ReportInventoryAgingRow[] {
  return reportItemRows(report);
}

export function reportInventoryAgingTotal(
  report: ReportInventoryAging | ReportInventoryAgingRow[] | null | undefined
): string {
  if (report && !Array.isArray(report) && report.totalInventoryValue) {
    return report.totalInventoryValue;
  }
  return reportInventoryAgingRows(report)
    .reduce(
      (sum, row) =>
        sum + (parseFloat(row.inventoryValue ?? row.value ?? "0") || 0),
      0
    )
    .toFixed(2);
}

export function purchasesByItemTotal(row: ReportPurchasesByItemRow): string {
  return row.total ?? row.totalSpend ?? "0";
}

export function agingItemDescription(row: ReportInventoryAgingRow): string {
  return row.itemDescription ?? row.description ?? "—";
}

export function sumSalesByItemRevenue(
  report: ReportSalesByItem | ReportSalesByItemRow[] | null | undefined
): string {
  return reportSalesByItemRows(report)
    .reduce((sum, row) => sum + (parseFloat(row.revenue) || 0), 0)
    .toFixed(2);
}

export function sumPurchasesByItemTotal(
  report: ReportPurchasesByItem | ReportPurchasesByItemRow[] | null | undefined
): string {
  return reportPurchasesByItemRows(report)
    .reduce((sum, row) => sum + (parseFloat(purchasesByItemTotal(row)) || 0), 0)
    .toFixed(2);
}
