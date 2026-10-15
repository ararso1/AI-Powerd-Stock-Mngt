"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ExternalLinkIcon,
  FlaskConicalIcon,
  MapPinIcon,
  ShipIcon,
  WorkflowIcon,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ExportDocumentsPanel } from "@/components/exports/export-documents-panel";
import { ExportReadinessTrack } from "@/components/exports/export-readiness-track";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { DoniyaLabelPreview } from "@/components/process-runs/doniya-label-preview";
import {
  FrappeButtonLink,
  FrappeButtonPrimary,
  FrappeButtonSecondary,
} from "@/components/frappe";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFetch } from "@/hooks/use-fetch";
import { api } from "@/lib/api";
import {
  exportDocsProgress,
  exportHasContract,
  exportHasEcta,
  exportReadiness,
  exportReadinessClass,
  exportReadinessLabel,
} from "@/lib/exports";
import { errorMessage, formatDateTime, formatQty } from "@/lib/format";
import { buildExportsListPath } from "@/lib/list-query";
import { COFFEE_GRADE_OPTIONS } from "@/lib/lots";
import type { ExportContract, ExportStoreLot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-bg)]/40 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--frappe-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--frappe-text)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-[var(--frappe-text-muted)]">{hint}</p>
      ) : null}
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
      <Label className="text-sm text-[var(--frappe-text-muted)]">{label}</Label>
      {children}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  badge,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)]",
        className
      )}
    >
      <div className="flex flex-wrap items-start gap-3 border-b border-[var(--frappe-border)] px-5 py-4">
        {icon ? (
          <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--csolve-moss)]/10 text-[var(--csolve-moss)]">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--frappe-text)]">
              {title}
            </h3>
            {badge}
          </div>
          {description ? (
            <p className="mt-0.5 text-sm text-[var(--frappe-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export default function ExportLotDetailPage() {
  const params = useParams();
  const lotId = typeof params.lotId === "string" ? params.lotId : "";
  const { data: lot, loading, reload } = useFetch(
    () => api<ExportStoreLot>(`/exports/store/${lotId}`),
    [lotId]
  );

  return (
    <AppShell
      title={lot ? lot.lotCode : "Export lot"}
      subtitle="Track contract, documents, ECTA, shipment, and port load for this export-ready coffee."
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Exports", href: "/exports" },
        { label: lot?.lotCode ?? "Lot" },
      ]}
      actions={<FrappeButtonLink href="/exports">← Exports</FrappeButtonLink>}
    >
      <PermissionGate
        permission="export.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            Export lot detail is restricted. You can view export lots on the
            Exports list, but opening detail requires export write access.
          </p>
        }
      >
        {loading ? (
          <PageLoading />
        ) : !lot ? (
          <p className="text-sm text-[var(--frappe-text-muted)]">
            Export lot not found.
          </p>
        ) : (
          <ExportLotDetail lot={lot} onReload={reload} />
        )}
      </PermissionGate>
    </AppShell>
  );
}

function ExportLotDetail({
  lot,
  onReload,
}: {
  lot: ExportStoreLot;
  onReload: () => Promise<unknown>;
}) {
  const readiness = lot.readiness ?? exportReadiness(lot);
  const progress = exportDocsProgress(lot.documents);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
        <div className="border-b border-[var(--frappe-border)] bg-gradient-to-br from-[var(--csolve-moss)]/[0.09] via-transparent to-[var(--frappe-bg)] px-5 py-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--frappe-text-muted)]">
                Export lot
              </p>
              <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--frappe-text)]">
                {lot.lotCode}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--frappe-text-muted)]">
                {lot.runId ? (
                  <Link
                    href={`/process-runs/${lot.runId}`}
                    className="inline-flex items-center gap-1 text-[var(--frappe-primary)] hover:underline"
                  >
                    Batch {lot.runNumber ?? "—"}
                    <ExternalLinkIcon className="size-3" />
                  </Link>
                ) : (
                  <span>Batch {lot.runNumber ?? "—"}</span>
                )}
                {lot.locationName ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="size-3.5" />
                    {lot.locationName}
                  </span>
                ) : null}
                {lot.itemDescription ? (
                  <span>· {lot.itemDescription}</span>
                ) : null}
              </p>
            </div>
            <Badge className={`ml-auto ${exportReadinessClass(readiness)}`}>
              {exportReadinessLabel(readiness)}
            </Badge>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Metric
              label="Quantity"
              value={`${formatQty(lot.quantityKg)} kg`}
              hint={
                lot.doniyaCount != null
                  ? lot.kgPerDoniya
                    ? `${lot.doniyaCount} × ${formatQty(lot.kgPerDoniya)} kg Doniya`
                    : `${lot.doniyaCount} Doniya`
                  : undefined
              }
            />
            <Metric label="Grade" value={lot.grade ?? "—"} />
            <Metric
              label="Contract"
              value={exportHasContract(lot) ? "Attached" : "Not attached"}
              hint={
                lot.contracts[0]?.contractNumber
                  ? lot.contracts[0].contractNumber
                  : undefined
              }
            />
            <Metric
              label="Documents"
              value={`${progress.attached}/${progress.total}`}
              hint={
                progress.attached === progress.total
                  ? "Complete"
                  : "Incomplete"
              }
            />
            <Metric
              label="ECTA"
              value={exportHasEcta(lot) ? lot.ectaGrade ?? "Recorded" : "Pending"}
              hint={
                lot.ectaCertificateNumber
                  ? lot.ectaCertificateNumber
                  : lot.ectaTestedAt
                    ? `Tested ${lot.ectaTestedAt.slice(0, 10)}`
                    : undefined
              }
            />
            <Metric
              label="Stock status"
              value={lot.status.replace(/_/g, " ")}
              hint={
                parseFloat(lot.reservedKg) > 0
                  ? `${formatQty(lot.reservedKg)} kg reserved`
                  : parseFloat(lot.shippedKg) > 0
                    ? `${formatQty(lot.shippedKg)} kg shipped`
                    : "In export store"
              }
            />
          </div>
        </div>

        <div className="px-5 py-5">
          <ExportReadinessTrack lot={lot} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-5">
          <ContractSection lot={lot} onReload={onReload} />
          <ExportDocumentsPanel lot={lot} onReload={onReload} />
          <EctaSection lot={lot} onReload={onReload} />
          <LoadReportSection lot={lot} onReload={onReload} />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <SectionCard title="Quick links">
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href={`/lots/${lot.lotId}`}
                  className="inline-flex items-center gap-1 text-[var(--frappe-primary)] hover:underline"
                >
                  Coffee lot record
                  <ExternalLinkIcon className="size-3" />
                </Link>
              </li>
              {lot.runId ? (
                <li>
                  <Link
                    href={`/process-runs/${lot.runId}`}
                    className="inline-flex items-center gap-1 text-[var(--frappe-primary)] hover:underline"
                  >
                    Process run {lot.runNumber}
                    <ExternalLinkIcon className="size-3" />
                  </Link>
                </li>
              ) : null}
              {lot.runId ? (
                <li>
                  <Link
                    href={`/process-runs/${lot.runId}/doniya-label`}
                    className="inline-flex items-center gap-1 text-[var(--frappe-primary)] hover:underline"
                  >
                    Doniya label page
                    <ExternalLinkIcon className="size-3" />
                  </Link>
                </li>
              ) : null}
              {lot.contracts.map((contract) => (
                <li key={contract.id}>
                  <Link
                    href={`/exports/${contract.id}`}
                    className="inline-flex items-center gap-1 text-[var(--frappe-primary)] hover:underline"
                  >
                    {contract.contractNumber ?? "Contract"}
                    <ExternalLinkIcon className="size-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>

          {lot.doniyaLabel ? (
            <SectionCard title="Packaging label">
              <DoniyaLabelPreview
                label={lot.doniyaLabel}
                className="mx-auto max-w-[220px]"
              />
            </SectionCard>
          ) : null}

          {lot.remainderKg && parseFloat(lot.remainderKg) > 0 ? (
            <SectionCard title="Packaging remainder">
              <p className="text-sm text-[var(--frappe-text-muted)]">
                {formatQty(lot.remainderKg)} kg left after full Doniya packing.
              </p>
            </SectionCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ContractSection({
  lot,
  onReload,
}: {
  lot: ExportStoreLot;
  onReload: () => Promise<unknown>;
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

  useEffect(() => {
    setQty(lot.quantityKg);
  }, [lot.quantityKg, lot.lotId]);

  async function attach(e: React.FormEvent) {
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
      await onReload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={<WorkflowIcon className="size-4" />}
      title="Contract"
      badge={
        <Badge
          variant="outline"
          className={
            exportHasContract(lot)
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800"
              : "border-amber-500/40 bg-amber-500/10 text-amber-900"
          }
        >
          {exportHasContract(lot) ? "Attached" : "Not attached"}
        </Badge>
      }
      description="Link this export-store lot to a buyer contract to continue the shipment path."
    >
      {lot.contracts.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {lot.contracts.map((contract) => (
            <li
              key={contract.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-bg)]/40 px-3 py-2.5 text-sm"
            >
              <Link
                href={`/exports/${contract.id}`}
                className="font-semibold text-[var(--frappe-primary)] hover:underline"
              >
                {contract.contractNumber ?? "Contract"}
              </Link>
              <Badge variant="outline">{contract.status}</Badge>
              <span className="ml-auto tabular-nums text-[var(--frappe-text-muted)]">
                {formatQty(contract.quantityKg)} kg
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-[var(--frappe-text-muted)]">
          No contract linked yet. Attach an existing draft/allocated contract or
          create a new one for this lot.
        </p>
      )}
      <PermissionGate permission="export.write">
        <form
          onSubmit={(event) => void attach(event)}
          className="grid gap-3 rounded-xl border border-dashed border-[var(--frappe-border)] bg-[var(--frappe-bg)]/30 p-4 sm:grid-cols-2"
        >
          <Field label="Existing contract">
            <select
              className="flex h-9 w-full rounded-md border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-2 text-sm"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
            >
              <option value="">Select contract…</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.contractNumber} · {contract.buyerName} ·{" "}
                  {contract.status}
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
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <FrappeButtonPrimary type="submit" disabled={saving}>
              Attach contract
            </FrappeButtonPrimary>
            <FrappeButtonSecondary asChild>
              <Link
                href={`/exports/new?lotId=${lot.lotId}&qty=${encodeURIComponent(lot.quantityKg)}`}
              >
                Create new contract
              </Link>
            </FrappeButtonSecondary>
          </div>
        </form>
      </PermissionGate>
    </SectionCard>
  );
}

function EctaSection({
  lot,
  onReload,
}: {
  lot: ExportStoreLot;
  onReload: () => Promise<unknown>;
}) {
  const [grade, setGrade] = useState(lot.ectaGrade ?? "");
  const [certificateNumber, setCertificateNumber] = useState(
    lot.ectaCertificateNumber ?? ""
  );
  const [moisture, setMoisture] = useState(lot.ectaMoisturePercent ?? "");
  const [cupping, setCupping] = useState(lot.ectaCuppingScore ?? "");
  const [testedAt, setTestedAt] = useState(
    lot.ectaTestedAt ? lot.ectaTestedAt.slice(0, 10) : ""
  );
  const [notes, setNotes] = useState(lot.ectaNotes ?? "");
  const [saving, setSaving] = useState(false);
  const recorded = exportHasEcta(lot);

  useEffect(() => {
    setGrade(lot.ectaGrade ?? "");
    setCertificateNumber(lot.ectaCertificateNumber ?? "");
    setMoisture(lot.ectaMoisturePercent ?? "");
    setCupping(lot.ectaCuppingScore ?? "");
    setTestedAt(lot.ectaTestedAt ? lot.ectaTestedAt.slice(0, 10) : "");
    setNotes(lot.ectaNotes ?? "");
  }, [lot]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/exports/store/${lot.lotId}/attach`, {
        method: "POST",
        body: {
          postEcta: {
            grade: grade.trim() || undefined,
            certificateNumber: certificateNumber.trim() || undefined,
            moisturePercent: moisture ? parseFloat(moisture) : undefined,
            cuppingScore: cupping ? parseFloat(cupping) : undefined,
            testedAt: testedAt || undefined,
            notes: notes.trim() || undefined,
          },
        },
      });
      toast.success("ECTA result saved");
      await onReload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={<FlaskConicalIcon className="size-4" />}
      title="Ethiopian Coffee and Tea Authority (ECTA)"
      badge={
        <Badge
          variant="outline"
          className={
            recorded
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800"
              : "border-amber-500/40 bg-amber-500/10 text-amber-900"
          }
        >
          {recorded ? "Recorded" : "Not recorded"}
        </Badge>
      }
      description="Post-processing quality / laboratory result for this export lot."
    >
      {recorded ? (
        <dl className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Grade" value={lot.ectaGrade ?? "—"} />
          <Metric
            label="Certificate"
            value={lot.ectaCertificateNumber ?? "—"}
          />
          <Metric
            label="Moisture"
            value={
              lot.ectaMoisturePercent != null
                ? `${lot.ectaMoisturePercent}%`
                : "—"
            }
          />
          <Metric label="Cupping" value={lot.ectaCuppingScore ?? "—"} />
          <Metric
            label="Tested"
            value={
              lot.ectaTestedAt ? lot.ectaTestedAt.slice(0, 10) : "—"
            }
          />
          <Metric label="Notes" value={lot.ectaNotes ?? "—"} />
        </dl>
      ) : null}
      <PermissionGate permission="export.write">
        <form
          onSubmit={(event) => void save(event)}
          className="grid gap-3 sm:grid-cols-2"
        >
          <Field label="Grade">
            <select
              className="flex h-9 w-full rounded-md border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-2 text-sm"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">Select…</option>
              {COFFEE_GRADE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Certificate number">
            <Input
              value={certificateNumber}
              onChange={(e) => setCertificateNumber(e.target.value)}
            />
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
          <Field label="Tested date">
            <Input
              type="date"
              value={testedAt}
              onChange={(e) => setTestedAt(e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <FrappeButtonPrimary type="submit" disabled={saving}>
              Save ECTA result
            </FrappeButtonPrimary>
          </div>
        </form>
      </PermissionGate>
    </SectionCard>
  );
}

function LoadReportSection({
  lot,
  onReload,
}: {
  lot: ExportStoreLot;
  onReload: () => Promise<unknown>;
}) {
  const existing = lot.loadReport;
  const [portName, setPortName] = useState(existing?.portName ?? "");
  const [staffName, setStaffName] = useState(existing?.staffName ?? "");
  const [loadedAt, setLoadedAt] = useState(
    existing?.loadedAt ? existing.loadedAt.slice(0, 16) : ""
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const canLoad = useMemo(
    () =>
      (lot.readiness ?? exportReadiness(lot)) === "SHIPPED" ||
      (lot.readiness ?? exportReadiness(lot)) === "LOADED" ||
      lot.status === "SHIPPED",
    [lot]
  );

  useEffect(() => {
    setPortName(existing?.portName ?? "");
    setStaffName(existing?.staffName ?? "");
    setLoadedAt(existing?.loadedAt ? existing.loadedAt.slice(0, 16) : "");
    setNotes(existing?.notes ?? "");
  }, [existing]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!portName.trim() || !staffName.trim()) {
      toast.error("Enter the port and staff name");
      return;
    }
    setSaving(true);
    try {
      await api(`/exports/store/${lot.lotId}/attach`, {
        method: "POST",
        body: {
          loadReport: {
            portName: portName.trim(),
            staffName: staffName.trim(),
            loadedAt: loadedAt
              ? new Date(loadedAt).toISOString()
              : new Date().toISOString(),
            notes: notes.trim() || undefined,
          },
        },
      });
      toast.success("Load report saved");
      await onReload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={<ShipIcon className="size-4" />}
      title="Loaded to port"
      badge={
        <Badge
          variant="outline"
          className={
            existing?.loadedAt
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800"
              : "border-amber-500/40 bg-amber-500/10 text-amber-900"
          }
        >
          {existing?.loadedAt ? "Reported" : "Not reported"}
        </Badge>
      }
      description="After the coffee is shipped, staff record the port load report here."
    >
      {existing?.loadedAt ? (
        <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
          <Metric label="Port" value={existing.portName ?? "—"} />
          <Metric label="Staff" value={existing.staffName ?? "—"} />
          <Metric
            label="Loaded at"
            value={formatDateTime(existing.loadedAt)}
          />
          <Metric label="Notes" value={existing.notes ?? "—"} />
        </dl>
      ) : null}
      <PermissionGate permission="export.write">
        {!canLoad ? (
          <p className="rounded-xl border border-dashed border-[var(--frappe-border)] bg-[var(--frappe-bg)]/30 px-4 py-3 text-sm text-[var(--frappe-text-muted)]">
            Ship the linked contract before recording a port load report.
          </p>
        ) : (
          <form
            onSubmit={(event) => void save(event)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field label="Port name">
              <Input
                value={portName}
                onChange={(e) => setPortName(e.target.value)}
                placeholder="Djibouti"
              />
            </Field>
            <Field label="Staff name">
              <Input
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
              />
            </Field>
            <Field label="Loaded at">
              <Input
                type="datetime-local"
                value={loadedAt}
                onChange={(e) => setLoadedAt(e.target.value)}
              />
            </Field>
            <Field label="Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <FrappeButtonPrimary type="submit" disabled={saving}>
                Save load report
              </FrappeButtonPrimary>
            </div>
          </form>
        )}
      </PermissionGate>
    </SectionCard>
  );
}
