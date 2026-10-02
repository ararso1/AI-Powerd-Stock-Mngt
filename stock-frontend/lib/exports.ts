import type { ExportDocumentRecord, ExportStoreLot } from "@/lib/types";
import { api } from "@/lib/api";

export const REQUIRED_EXPORT_DOCUMENTS: Array<{
  key: string;
  label: string;
}> = [
  { key: "PERMIT", label: "Permit" },
  { key: "CLEARANCE", label: "Certificate of Clearance" },
  { key: "CHAMBER", label: "Chamber of Commerce Certificate" },
  { key: "WAYBILL", label: "Waybill" },
  { key: "X1", label: "X1" },
  { key: "DECLARATION", label: "Declaration" },
  { key: "SHIPPING_INSTRUCTION", label: "Shipping Instruction" },
  { key: "LC", label: "Letter of Credit (LC)" },
];

export type ExportReadiness =
  | "READY"
  | "CONTRACT"
  | "DOCUMENTS"
  | "ECTA"
  | "SHIP_READY"
  | "SHIPPED"
  | "LOADED";

export const EXPORT_READINESS_STEPS: Array<{
  key: ExportReadiness;
  label: string;
}> = [
  { key: "READY", label: "Export ready" },
  { key: "CONTRACT", label: "Contract" },
  { key: "DOCUMENTS", label: "Documents" },
  { key: "ECTA", label: "ECTA result" },
  { key: "SHIP_READY", label: "Shipment ready" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "LOADED", label: "Loaded to port" },
];

export function documentAttached(doc?: ExportDocumentRecord | null): boolean {
  return Boolean(
    doc?.reference?.trim() ||
      doc?.notes?.trim() ||
      doc?.hasFile ||
      doc?.downloadPath
  );
}

export function exportDocumentChecklist(
  saved?: ExportDocumentRecord[] | null
): Array<ExportDocumentRecord & { attached: boolean }> {
  return REQUIRED_EXPORT_DOCUMENTS.map((template) => {
    const found = saved?.find((doc) => doc.key === template.key);
    const row: ExportDocumentRecord = {
      key: template.key,
      label: template.label,
      reference: found?.reference ?? null,
      notes: found?.notes ?? null,
      hasFile: found?.hasFile ?? false,
      fileOriginalName: found?.fileOriginalName ?? null,
      fileMimeType: found?.fileMimeType ?? null,
      fileSizeBytes: found?.fileSizeBytes ?? null,
      downloadPath: found?.downloadPath ?? null,
    };
    return { ...row, attached: documentAttached(row) };
  });
}

export function exportDocsComplete(
  saved?: ExportDocumentRecord[] | null
): boolean {
  return exportDocumentChecklist(saved).every((doc) => doc.attached);
}

export function exportDocsProgress(saved?: ExportDocumentRecord[] | null): {
  attached: number;
  total: number;
} {
  const rows = exportDocumentChecklist(saved);
  return {
    attached: rows.filter((doc) => doc.attached).length,
    total: rows.length,
  };
}

export function exportHasEcta(
  lot: Pick<
    ExportStoreLot,
    | "ectaGrade"
    | "ectaCertificateNumber"
    | "ectaMoisturePercent"
    | "ectaCuppingScore"
    | "ectaTestedAt"
  >
): boolean {
  return Boolean(
    lot.ectaGrade?.trim() ||
      lot.ectaCertificateNumber?.trim() ||
      lot.ectaMoisturePercent ||
      lot.ectaCuppingScore ||
      lot.ectaTestedAt
  );
}

export function exportHasContract(lot: Pick<ExportStoreLot, "contracts">): boolean {
  return (lot.contracts?.length ?? 0) > 0;
}

export function exportReadiness(lot: ExportStoreLot): ExportReadiness {
  if (lot.loadReport?.loadedAt || lot.readiness === "LOADED") return "LOADED";
  if (lot.status === "SHIPPED" || lot.readiness === "SHIPPED") return "SHIPPED";
  const hasContract = exportHasContract(lot);
  const docsDone = exportDocsComplete(lot.documents);
  const hasEcta = exportHasEcta(lot);
  if (hasContract && docsDone && hasEcta) return "SHIP_READY";
  if (hasEcta) return "ECTA";
  if (docsDone) return "DOCUMENTS";
  if (hasContract) return "CONTRACT";
  return "READY";
}

export function exportReadinessLabel(value: ExportReadiness | string): string {
  return (
    EXPORT_READINESS_STEPS.find((step) => step.key === value)?.label ?? value
  );
}

export function exportReadinessClass(value: ExportReadiness | string): string {
  switch (value) {
    case "READY":
      return "border-transparent bg-emerald-600/15 text-emerald-800";
    case "CONTRACT":
      return "border-transparent bg-sky-600/15 text-sky-800";
    case "DOCUMENTS":
      return "border-transparent bg-amber-500/15 text-amber-900";
    case "ECTA":
      return "border-transparent bg-violet-600/15 text-violet-800";
    case "SHIP_READY":
      return "border-transparent bg-teal-600/15 text-teal-900";
    case "SHIPPED":
      return "border-transparent bg-slate-700 text-white";
    case "LOADED":
      return "border-transparent bg-[var(--csolve-moss)] text-[var(--csolve-parchment)]";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

export function formatExportFileSize(bytes?: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function upsertExportLotDocument(
  lotId: string,
  key: string,
  args: { reference?: string; notes?: string; file?: File; clearFile?: boolean }
) {
  const form = new FormData();
  if (args.file) form.append("file", args.file);
  if (args.reference !== undefined) form.append("reference", args.reference);
  if (args.notes !== undefined) form.append("notes", args.notes);
  if (args.clearFile) form.append("clearFile", "true");
  return api<ExportStoreLot>(`/exports/store/${lotId}/documents/${key}`, {
    method: "POST",
    body: form,
  });
}

export async function clearExportLotDocumentFile(lotId: string, key: string) {
  return api<ExportStoreLot>(`/exports/store/${lotId}/documents/${key}/file`, {
    method: "DELETE",
  });
}
