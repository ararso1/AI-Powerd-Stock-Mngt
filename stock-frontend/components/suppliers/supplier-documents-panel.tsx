"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api, apiBlob } from "@/lib/api";
import { errorMessage, formatDate } from "@/lib/format";
import {
  formatFileSize,
  supplierDocumentKindLabel,
} from "@/lib/suppliers";
import type { SupplierDocument } from "@/lib/types";
import { PermissionGate } from "@/components/permission-gate";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import Link from "next/link";

async function openDocument(doc: SupplierDocument) {
  const { blob } = await apiBlob(doc.downloadPath);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function ViewLink({ doc }: { doc: SupplierDocument }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="text-xs font-medium text-[var(--frappe-primary)] hover:underline disabled:opacity-50"
      onClick={() => {
        setBusy(true);
        void openDocument(doc)
          .catch((err) => toast.error(errorMessage(err)))
          .finally(() => setBusy(false));
      }}
    >
      {busy ? "Opening…" : "View"}
    </button>
  );
}

function DocRow({
  doc,
  onChanged,
  canDelete,
}: {
  doc: SupplierDocument;
  onChanged: () => void;
  canDelete?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function removeDoc() {
    setBusy(true);
    try {
      await api(`/suppliers/${doc.supplierId}/documents/${doc.id}`, {
        method: "DELETE",
      });
      toast.success("Document removed");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--frappe-border)] py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{supplierDocumentKindLabel(doc.kind)}</Badge>
          <p className="truncate text-sm font-medium text-[var(--frappe-text)]">
            {doc.title || doc.originalName}
          </p>
          <ViewLink doc={doc} />
        </div>
        <p className="mt-0.5 text-xs text-[var(--frappe-text-muted)]">
          {doc.originalName} · {formatFileSize(doc.sizeBytes)} ·{" "}
          {formatDate(doc.createdAt)}
        </p>
      </div>
      {canDelete ? (
        <PermissionGate permission="suppliers.write">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                className="text-destructive"
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove document?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes “{doc.title || doc.originalName}”.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void removeDoc()}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </PermissionGate>
      ) : null}
    </div>
  );
}

/** Profile view: list + view (+ optional delete). Uploads happen on Edit. */
export function SupplierDocumentsPanel({
  supplierId,
  documents,
  onChanged,
}: {
  supplierId: string;
  documents: SupplierDocument[];
  onChanged: () => void;
}) {
  const licenseDoc = documents.find((d) => d.kind === "BUSINESS_LICENSE");
  const idDoc = documents.find((d) => d.kind === "ID");
  const agreementDoc = documents.find((d) => d.kind === "AGREEMENT");
  const additionalDocs = documents.filter((d) => d.kind === "OTHER");

  const dedicated = [
    { label: "Business License", doc: licenseDoc },
    { label: "ID Document", doc: idDoc },
    { label: "Agreement / Contract", doc: agreementDoc },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--frappe-text-muted)]">
          Upload or replace documents from Edit supplier.
        </p>
        <PermissionGate permission="suppliers.write">
          <Button asChild size="sm" variant="outline">
            <Link href={`/suppliers/${supplierId}/edit`}>Edit documents</Link>
          </Button>
        </PermissionGate>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {dedicated.map(({ label, doc }) => (
          <div
            key={label}
            className="rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-3"
          >
            <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
              {label}
            </p>
            {doc ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--frappe-text)]">
                <span className="truncate">{doc.originalName}</span>
                <ViewLink doc={doc} />
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
                Not uploaded
              </p>
            )}
          </div>
        ))}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-[var(--frappe-text-muted)]">
          Additional documents ({additionalDocs.length})
        </p>
        {additionalDocs.length === 0 ? (
          <p className="py-2 text-sm text-[var(--frappe-text-muted)]">
            No additional documents.
          </p>
        ) : (
          <div>
            {additionalDocs.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                onChanged={onChanged}
                canDelete
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
