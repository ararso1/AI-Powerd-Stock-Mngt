import type {
  ReportCommissionRow,
  ReportCommissions,
} from "@/lib/types";

/** Rows from `/reports/commissions` (object with `reps` or legacy list shapes). */
export function reportCommissionRows(
  report: ReportCommissions | ReportCommissionRow[] | null | undefined
): ReportCommissionRow[] {
  if (!report) return [];
  if (Array.isArray(report)) return report;
  if (report.reps?.length) return report.reps;
  return [];
}

export function reportTotalCommission(
  report: ReportCommissions | ReportCommissionRow[] | null | undefined
): string {
  if (!report || Array.isArray(report)) {
    return reportCommissionRows(report)
      .reduce((sum, row) => sum + (parseFloat(row.totalCommission) || 0), 0)
      .toFixed(2);
  }
  return report.totalCommission ?? "0";
}
