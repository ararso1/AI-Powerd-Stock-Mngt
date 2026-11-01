import { apiBlob } from "@/lib/api";
import { buildListPath } from "@/lib/list-query";

export type ReportFilterParams = {
  from?: string;
  to?: string;
  locationId?: string;
  supplierId?: string;
  customerId?: string;
  categoryId?: string;
  soldByUserId?: string;
  purchaseType?: string;
  channel?: string;
  workflow?: string;
  status?: string;
  form?: string;
  disposition?: string;
  entityType?: string;
  employmentStatus?: string;
  symbol?: string;
  direction?: string;
  reason?: string;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadReportExport(
  reportId: string,
  format: "csv" | "pdf",
  params: ReportFilterParams
) {
  const path = buildListPath(`/reports/${reportId}/export.${format}`, {
    params,
  });
  const { blob, filename } = await apiBlob(path);
  downloadBlob(
    blob,
    filename ?? `efnan-${reportId}.${format === "pdf" ? "pdf" : "csv"}`
  );
}
