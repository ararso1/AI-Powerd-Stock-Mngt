"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoading } from "@/components/shared/page-loading";
import { DoniyaLabelPreview } from "@/components/process-runs/doniya-label-preview";
import { api } from "@/lib/api";
import { errorMessage, formatQty } from "@/lib/format";
import { buildExportsListPath } from "@/lib/list-query";
import { COFFEE_GRADE_OPTIONS } from "@/lib/lots";
import type {
  ExportContract,
  ExportDocumentRecord,
  ExportStoreLot,
} from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { toast } from "sonner";

const DOCUMENTS: ExportDocumentRecord[] = [
  { key: "COO", label: "Certificate of Origin" },
  { key: "PHYTO", label: "Phytosanitary certificate" },
  { key: "QC", label: "QC / cupping certificate" },
  { key: "PACKING", label: "Packing list" },
  { key: "INVOICE", label: "Commercial invoice" },
  { key: "BOL", label: "Bill of lading / AWB" },
  { key: "WEIGHT", label: "Weight / quality certificate" },
];

type Action = "contract" | "documents" | "ecta";

export function ExportLotsPanel() {
  const { data, loading, reload } = useFetch(
    () => api<ExportStoreLot[]>("/exports/store"),
    []
  );
  const rows = data ?? [];
  const [active, setActive] = useState<ExportStoreLot | null>(null);
  const [action, setAction] = useState<Action | null>(null);

  function open(row: ExportStoreLot, next: Action) {
    setActive(row);
    setAction(next);
  }

  function close() {
    setActive(null);
    setAction(null);
  }

  return (
    <section>
      <p className="mb-4 text-sm text-[var(--frappe-text-muted)]">
        Coffee that finished export processing is listed here as soon as it is
        ready. Attach a contract, the required documents, and the ECTA result
        from each lot.
      </p>
      {loading ? (
        <PageLoading />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-10 text-center text-sm text-[var(--frappe-text-muted)]">
          No export-ready coffee yet. Finished export runs appear here.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <LotCard key={row.lotId} row={row} onAction={open} />
          ))}
        </div>
      )}
      {active && action === "contract" ? (
        <ContractDialog
          lot={active}
          onClose={close}
          onSaved={async () => {
            close();
            await reload();
          }}
        />
      ) : null}
      {active && action === "documents" ? (
        <DocumentsDialog
          lot={active}
          onClose={close}
          onSaved={async () => {
            close();
            await reload();
          }}
        />
      ) : null}
      {active && action === "ecta" ? (
        <EctaDialog
          lot={active}
          onClose={close}
          onSaved={async () => {
            close();
            await reload();
          }}
        />
      ) : null}
    </section>
  );
}

function LotCard({
  row,
  onAction,
}: {
  row: ExportStoreLot;
  onAction: (row: ExportStoreLot, action: Action) => void;
}) {
  const ready = row.status === "IN_STORE";
  return (
    <article className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <Link
            href={`/lots/${row.lotId}`}
            className="font-semibold text-[var(--frappe-primary)] hover:underline"
          >
            {row.lotCode}
          </Link>
          <p className="text-xs text-[var(--frappe-text-muted)]">
            Batch {row.runNumber ?? "—"}
            {row.locationName ? ` · ${row.locationName}` : ""}
          </p>
        </div>
        <Badge
          className={
            ready
              ? "ml-auto border-transparent bg-emerald-600 text-white"
              : "ml-auto"
          }
          variant={ready ? "default" : "outline"}
        >
          {ready ? "Ready" : row.status === "RESERVED" ? "Reserved" : "Shipped"}
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Total quantity" value={`${formatQty(row.quantityKg)} kg`} />
        <Metric
          label="Full Doniya"
          value={
            row.doniyaCount != null
              ? row.kgPerDoniya
                ? `${row.doniyaCount} × ${formatQty(row.kgPerDoniya)} kg`
                : String(row.doniyaCount)
              : "—"
          }
        />
        <Metric
          label="Remaining"
          value={row.remainderKg != null ? `${formatQty(row.remainderKg)} kg` : "—"}
        />
        <Metric label="Grade" value={row.grade ?? "—"} />
        {row.doniyaLabel ? (
          <>
            <Metric label="Coffee name" value={row.doniyaLabel.coffeeName} />
            <Metric label="Destination" value={row.doniyaLabel.destination} />
          </>
        ) : null}
      </dl>
      {row.doniyaLabel ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <DoniyaLabelPreview
            label={row.doniyaLabel}
            className="max-w-[160px]"
          />
          {row.runId ? (
            <Link
              href={`/process-runs/${row.runId}/doniya-label`}
              className="text-sm font-medium text-[var(--frappe-primary)] hover:underline"
            >
              View Doniya label
            </Link>
          ) : null}
        </div>
      ) : null}
      {row.contracts.length > 0 ? (
        <p className="mt-3 text-xs text-[var(--frappe-text-muted)]">
          {row.contracts.map((contract) => (
            <Link
              key={contract.id}
              href={`/exports/${contract.id}`}
              className="mr-3 text-[var(--frappe-primary)] hover:underline"
            >
              {contract.contractNumber ?? "Contract"} · {contract.status}
            </Link>
          ))}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onAction(row, "contract")}>
          Attach contract
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onAction(row, "documents")}>
          Documents
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onAction(row, "ecta")}>
          ECTA result
        </Button>
      </div>
    </article>
  );
}

function ContractDialog({
  lot,
  onClose,
  onSaved,
}: {
  lot: ExportStoreLot;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { data } = useFetch(
    () =>
      api<{ data: ExportContract[] }>(buildExportsListPath(undefined, 1, 100)),
    []
  );
  const contracts = (data?.data ?? []).filter((contract) =>
    ["DRAFT", "ALLOCATED", "STAGED"].includes(contract.status)
  );
  const [contractId, setContractId] = useState("");
  const [qty, setQty] = useState(lot.quantityKg);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!contractId) {
      toast.error("Select a contract");
      return;
    }
    setSaving(true);
    try {
      await api(`/exports/store/${lot.lotId}/attach`, {
        method: "POST",
        body: { contractId, quantityKg: parseFloat(qty) },
      });
      toast.success("Contract attached");
      await onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach contract</DialogTitle>
        </DialogHeader>
        <form onSubmit={(event) => void save(event)} className="grid gap-3">
          <Field label="Contract">
            <select
              className="flex h-9 w-full rounded-md border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-2 text-sm"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
            >
              <option value="">Select contract…</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.contractNumber} · {contract.buyerName} · {contract.status}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity kg">
            <Input
              type="number"
              min={0.001}
              step="0.001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Attach
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DocumentsDialog({
  lot,
  onClose,
  onSaved,
}: {
  lot: ExportStoreLot;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [documents, setDocuments] = useState<ExportDocumentRecord[]>(() =>
    DOCUMENTS.map((template) => {
      const saved = lot.documents?.find((doc) => doc.key === template.key);
      return {
        ...template,
        reference: saved?.reference ?? "",
        notes: saved?.notes ?? "",
      };
    })
  );
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/exports/store/${lot.lotId}/attach`, {
        method: "POST",
        body: {
          documents: documents.map((doc) => ({
            key: doc.key,
            label: doc.label,
            reference: doc.reference?.trim() || undefined,
            notes: doc.notes?.trim() || undefined,
          })),
        },
      });
      toast.success("Documents saved");
      await onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Required documents</DialogTitle>
        </DialogHeader>
        <form onSubmit={(event) => void save(event)} className="grid gap-3">
          {documents.map((doc, index) => (
            <Field key={doc.key} label={doc.label}>
              <Input
                placeholder="Reference"
                value={doc.reference ?? ""}
                onChange={(e) => {
                  const next = documents.slice();
                  next[index] = { ...doc, reference: e.target.value };
                  setDocuments(next);
                }}
              />
            </Field>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save documents
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EctaDialog({
  lot,
  onClose,
  onSaved,
}: {
  lot: ExportStoreLot;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [grade, setGrade] = useState(lot.ectaGrade ?? "");
  const [certificate, setCertificate] = useState(lot.ectaCertificateNumber ?? "");
  const [moisture, setMoisture] = useState(lot.ectaMoisturePercent ?? "");
  const [cupping, setCupping] = useState(lot.ectaCuppingScore ?? "");
  const [testedAt, setTestedAt] = useState(
    lot.ectaTestedAt ? String(lot.ectaTestedAt).slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/exports/store/${lot.lotId}/attach`, {
        method: "POST",
        body: {
          postEcta: {
            grade: grade || undefined,
            certificateNumber: certificate.trim() || undefined,
            moisturePercent: moisture ? parseFloat(moisture) : undefined,
            cuppingScore: cupping ? parseFloat(cupping) : undefined,
            testedAt: testedAt || undefined,
          },
        },
      });
      toast.success("ECTA result saved");
      await onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ECTA result</DialogTitle>
        </DialogHeader>
        <form onSubmit={(event) => void save(event)} className="grid gap-3">
          <Field label="Grade">
            <select
              className="flex h-9 w-full rounded-md border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-2 text-sm"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">Select grade…</option>
              {COFFEE_GRADE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Certificate number">
            <Input value={certificate} onChange={(e) => setCertificate(e.target.value)} />
          </Field>
          <Field label="Moisture %">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={moisture}
              onChange={(e) => setMoisture(e.target.value)}
            />
          </Field>
          <Field label="Cupping score">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={cupping}
              onChange={(e) => setCupping(e.target.value)}
            />
          </Field>
          <Field label="Tested on">
            <Input type="date" value={testedAt} onChange={(e) => setTestedAt(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save ECTA
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--frappe-text-muted)]">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
