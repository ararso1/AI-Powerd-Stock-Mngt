"use client";

import { useEffect, useRef, useState } from "react";
import {
  DownloadIcon,
  EyeIcon,
  FileUpIcon,
  ReplaceIcon,
  Trash2Icon,
} from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiBlob } from "@/lib/api";
import {
  clearExportLotDocumentFile,
  exportDocumentChecklist,
  exportDocsProgress,
  formatExportFileSize,
  upsertExportLotDocument,
} from "@/lib/exports";
import { errorMessage } from "@/lib/format";
import type { ExportDocumentRecord, ExportStoreLot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DocRow = ExportDocumentRecord & { attached: boolean };

async function openOrDownload(
  path: string,
  mode: "view" | "download",
  fallbackName: string
) {
  const { blob, filename } = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  if (mode === "view") {
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function statusLabel(doc: DocRow): string {
  if (doc.hasFile && doc.reference?.trim()) return "File + ref";
  if (doc.hasFile) return "Uploaded";
  if (doc.reference?.trim()) return "Reference";
  return "Pending";
}

export function ExportDocumentsPanel({
  lot,
  onReload,
}: {
  lot: ExportStoreLot;
  onReload: () => Promise<unknown>;
}) {
  const docs = exportDocumentChecklist(lot.documents);
  const progress = exportDocsProgress(lot.documents);
  const [refs, setRefs] = useState<Record<string, string>>(() =>
    Object.fromEntries(docs.map((doc) => [doc.key, doc.reference ?? ""]))
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const next = exportDocumentChecklist(lot.documents);
    setRefs(
      Object.fromEntries(next.map((doc) => [doc.key, doc.reference ?? ""]))
    );
  }, [lot.documents, lot.lotId]);

  const pct =
    progress.total > 0
      ? Math.round((progress.attached / progress.total) * 100)
      : 0;

  async function saveReference(doc: DocRow) {
    const reference = (refs[doc.key] ?? "").trim();
    const previous = (doc.reference ?? "").trim();
    if (reference === previous) return;
    setBusyKey(doc.key);
    try {
      await upsertExportLotDocument(lot.lotId, doc.key, { reference });
      toast.success(`${doc.label} reference saved`);
      await onReload();
    } catch (err) {
      toast.error(errorMessage(err));
      setRefs((prev) => ({ ...prev, [doc.key]: doc.reference ?? "" }));
    } finally {
      setBusyKey(null);
    }
  }

  async function uploadFile(doc: DocRow, file: File) {
    setBusyKey(doc.key);
    try {
      await upsertExportLotDocument(lot.lotId, doc.key, {
        file,
        reference: (refs[doc.key] ?? "").trim() || undefined,
      });
      toast.success(`${doc.label} uploaded`);
      await onReload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function removeFile(doc: DocRow) {
    setBusyKey(doc.key);
    try {
      await clearExportLotDocumentFile(lot.lotId, doc.key);
      toast.success("File removed");
      await onReload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--frappe-border)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--frappe-text)]">
            Required export documents
          </h3>
          <p className="text-xs text-[var(--frappe-text-muted)]">
            Upload a file or enter a certificate/reference number for each item.
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            progress.attached === progress.total && progress.total > 0
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800"
              : "border-amber-500/40 bg-amber-500/10 text-amber-900"
          )}
        >
          {progress.attached}/{progress.total} · {pct}%
        </Badge>
      </div>

      <div className="h-1 bg-[var(--frappe-border)]">
        <div
          className="h-full bg-[var(--csolve-moss)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--frappe-border)] bg-[var(--frappe-bg)]/50 text-left text-[11px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
              <th className="px-4 py-2 font-medium">Document</th>
              <th className="px-3 py-2 font-medium">File</th>
              <th className="px-3 py-2 font-medium">Certificate / reference</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => {
              const busy = busyKey === doc.key;
              return (
                <tr
                  key={doc.key}
                  className="border-b border-[var(--frappe-border)] last:border-b-0"
                >
                  <td className="px-4 py-2.5 align-middle">
                    <p className="font-medium text-[var(--frappe-text)]">
                      {doc.label}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <input
                      ref={(el) => {
                        fileInputs.current[doc.key] = el;
                      }}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void uploadFile(doc, file);
                      }}
                    />
                    {doc.hasFile && doc.downloadPath ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="max-w-[140px] truncate text-xs text-[var(--frappe-text-muted)]"
                          title={doc.fileOriginalName ?? undefined}
                        >
                          {doc.fileOriginalName ?? "Uploaded file"}
                          {doc.fileSizeBytes
                            ? ` · ${formatExportFileSize(doc.fileSizeBytes)}`
                            : ""}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={busy}
                          onClick={() =>
                            void openOrDownload(
                              doc.downloadPath!,
                              "view",
                              doc.fileOriginalName ?? `${doc.key}.pdf`
                            ).catch((err) => toast.error(errorMessage(err)))
                          }
                        >
                          <EyeIcon className="size-3.5" />
                          View
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={busy}
                          onClick={() =>
                            void openOrDownload(
                              doc.downloadPath!,
                              "download",
                              doc.fileOriginalName ?? `${doc.key}.pdf`
                            ).catch((err) => toast.error(errorMessage(err)))
                          }
                        >
                          <DownloadIcon className="size-3.5" />
                        </Button>
                        <PermissionGate permission="export.write">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            disabled={busy}
                            onClick={() =>
                              fileInputs.current[doc.key]?.click()
                            }
                          >
                            <ReplaceIcon className="size-3.5" />
                            Replace
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-rose-700"
                            disabled={busy}
                            onClick={() => void removeFile(doc)}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </PermissionGate>
                      </div>
                    ) : (
                      <PermissionGate
                        permission="export.write"
                        fallback={
                          <span className="text-xs text-[var(--frappe-text-muted)]">
                            No file
                          </span>
                        }
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={busy}
                          onClick={() => fileInputs.current[doc.key]?.click()}
                        >
                          <FileUpIcon className="size-3.5" />
                          Upload
                        </Button>
                      </PermissionGate>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <PermissionGate
                      permission="export.write"
                      fallback={
                        <span className="text-xs text-[var(--frappe-text)]">
                          {doc.reference?.trim() || "—"}
                        </span>
                      }
                    >
                      <Input
                        className="h-8"
                        placeholder="Optional certificate / ref no."
                        value={refs[doc.key] ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          setRefs((prev) => ({
                            ...prev,
                            [doc.key]: e.target.value,
                          }))
                        }
                        onBlur={() => void saveReference(doc)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </PermissionGate>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-normal",
                        doc.attached
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800"
                          : "text-[var(--frappe-text-muted)]"
                      )}
                    >
                      {busy ? "Saving…" : statusLabel(doc)}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
