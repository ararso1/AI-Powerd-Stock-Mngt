import type {
  CommissionBasis,
  Sale,
  SaleUserRef,
  SalesCommissionSummaryRow,
} from "@/lib/types";

export function formatCommissionBasis(basis?: CommissionBasis): string {
  if (basis === "SALES") return "Sales (subtotal)";
  return "Profit";
}

export function formatCommissionRate(
  percent?: string | number | null,
  basis?: CommissionBasis
): string | null {
  if (percent == null || String(percent) === "") return null;
  return `${percent}% of ${basis === "SALES" ? "sales" : "profit"}`;
}

/** API returns `soldByUser`; older payloads may use `soldBy`. */
export function saleRepUser(
  sale: Pick<Sale, "soldByUser" | "soldBy">
): SaleUserRef | undefined {
  return sale.soldByUser ?? sale.soldBy;
}

export function saleRepName(
  sale: Pick<Sale, "soldByUser" | "soldBy">
): string | undefined {
  return saleRepUser(sale)?.fullName;
}

export function commissionRowRepName(row: SalesCommissionSummaryRow): string {
  return (
    row.soldByUserName ??
    row.soldByUser?.fullName ??
    row.soldBy?.fullName ??
    row.soldByUserId
  );
}

export function commissionRowSubtotal(row: SalesCommissionSummaryRow): string {
  return row.totalSubtotal ?? row.totalSales ?? "0";
}
