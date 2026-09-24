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
  customerDocumentKindLabel,
  formatFileSize,
} from "@/lib/customers";
import type { CustomerDocument } from "@/lib/types";
import { PermissionGate } from "@/components/permission-gate";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import Link from "next/link";

async function openDocument(doc: CustomerDocument) {
  const { blob } = await apiBlob(doc.downloadPath);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function ViewLink({ doc }: { doc: CustomerDocument }) {
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
  doc: CustomerDocument;
  onChanged: () => void;
  canDelete?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function removeDoc() {
    setBusy(true);
    try {
      await api(`/customers/${doc.customerId}/documents/${doc.id}`, {
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
          <Badge variant="outline">{customerDocumentKindLabel(doc.kind)}</Badge>
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
        <PermissionGate permission="customers.write">
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

export function CustomerDocumentsPanel({
  customerId,
  documents,
  onChanged,
  readOnly,
}: {
  customerId: string;
  documents: CustomerDocument[];
  onChanged?: () => void;
  readOnly?: boolean;
}) {
  const agreements = documents.filter((d) => d.kind === "AGENT_AGREEMENT");
  const other = documents.filter((d) => d.kind !== "AGENT_AGREEMENT");

  return (
    <div className="space-y-4">
      {readOnly ? (
        <p className="text-xs text-[var(--frappe-text-muted)]">
          Upload or replace agent agreement documents from{" "}
          <Link
            href={`/customers/${customerId}/edit`}
            className="font-medium text-[var(--frappe-primary)] hover:underline"
          >
            Edit customer
          </Link>
          .
        </p>
      ) : null}

      <div>
        <p className="mb-1 text-xs font-medium text-[var(--frappe-text-muted)]">
          Agent agreements ({agreements.length})
        </p>
        {agreements.length === 0 ? (
          <p className="text-sm text-[var(--frappe-text-muted)]">
            No agent agreement documents uploaded.
          </p>
        ) : (
          agreements.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              canDelete={!readOnly}
              onChanged={() => onChanged?.()}
            />
          ))
        )}
      </div>

      {other.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-[var(--frappe-text-muted)]">
            Other documents ({other.length})
          </p>
          {other.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              canDelete={!readOnly}
              onChanged={() => onChanged?.()}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
