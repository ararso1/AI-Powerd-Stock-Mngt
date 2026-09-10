import type { ReportCreditPartySummary, ReportCredits } from "@/lib/types";

export function reportCustomerCredits(
  report: ReportCredits
): ReportCreditPartySummary {
  if (report.customers) return report.customers;
  const legacy = report.customerReceivables;
  return {
    totalOutstanding: legacy?.outstanding ?? "0",
    creditCount: legacy?.count ?? 0,
    byCustomer: [],
  };
}

export function reportSupplierCredits(
  report: ReportCredits
): ReportCreditPartySummary {
  if (report.suppliers) return report.suppliers;
  const legacy = report.supplierPayables;
  return {
    totalOutstanding: legacy?.outstanding ?? "0",
    creditCount: legacy?.count ?? 0,
    bySupplier: [],
  };
}
