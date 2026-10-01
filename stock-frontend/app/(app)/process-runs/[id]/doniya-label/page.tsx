"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { DoniyaLabelPreview } from "@/components/process-runs/doniya-label-preview";
import { Badge } from "@/components/ui/badge";
import { useFetch } from "@/hooks/use-fetch";
import { api } from "@/lib/api";
import { formatDate, formatQty } from "@/lib/format";
import {
  exportRunDoniyaLabel,
  processStatusClass,
  processStatusLabel,
  processWorkflowLabel,
} from "@/lib/process-runs";
import type { ExportDoniyaLabel, ProcessRun } from "@/lib/types";

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-[var(--frappe-text)]">{value || "—"}</p>
    </div>
  );
}

function LabelDetails({ label }: { label: ExportDoniyaLabel }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Field label="Business name" value={label.businessName} />
      <Field label="Location" value={label.location} />
      <Field label="Coffee name" value={label.coffeeName} />
      <Field label="Origin" value={label.origin} />
      <Field label="Net weight" value={label.netWeight} />
      <Field label="Certificate number" value={label.certificateNumber} />
      <Field label="ICO No." value={label.icoNumber} />
      <Field label="Production date" value={label.productionDate} />
      <Field label="Expiry date" value={label.expiryDate} />
      <Field label="Destination" value={label.destination} />
    </dl>
  );
}

export default function ProcessRunDoniyaLabelPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data: run, loading } = useFetch(
    () => api<ProcessRun>(`/process-runs/${id}`),
    [id]
  );
  const label = run ? exportRunDoniyaLabel(run) : null;
  const packaging = run?.stageResults?.find((row) => row.stage === "Packaging");
  const stored = run?.stageResults?.find(
    (row) =>
      row.stage === "Export Store" || row.stage === "Packaging & Export Store"
  );

  return (
    <AppShell
      title={run ? `${run.runNumber} · Doniya label` : "Doniya label"}
      subtitle="Printed label for each Doniya from this export run."
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Processing", href: "/process-runs" },
        {
          label: run?.runNumber ?? "Run",
          href: id ? `/process-runs/${id}` : undefined,
        },
        { label: "Doniya label" },
      ]}
      actions={
        id ? (
          <Link
            href={`/process-runs/${id}`}
            className="text-sm text-[var(--frappe-primary)] hover:underline"
          >
            ← Back to run
          </Link>
        ) : null
      }
    >
      <PermissionGate permission="process.read">
        {loading ? (
          <PageLoading />
        ) : !run ? (
          <p className="text-sm text-[var(--frappe-text-muted)]">
            Process run not found.
          </p>
        ) : run.workflow !== "EXPORT" ? (
          <p className="text-sm text-[var(--frappe-text-muted)]">
            Doniya labels are only used on export processing runs.
          </p>
        ) : !label ? (
          <section className="rounded-xl border border-dashed border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-10 text-center text-sm text-[var(--frappe-text-muted)]">
            No Doniya label has been saved yet. Enter it when this run reaches
            Packaging.
            <div className="mt-3">
              <Link
                href={`/process-runs/${run.id}`}
                className="text-[var(--frappe-primary)] hover:underline"
              >
                Open run
              </Link>
            </div>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">Label details</h2>
                <Badge className={processStatusClass(run.status)}>
                  {processStatusLabel(run.status)}
                </Badge>
              </div>
              <dl className="mb-6 grid gap-3 text-sm sm:grid-cols-3">
                <Field
                  label="Workflow"
                  value={processWorkflowLabel(run.workflow)}
                />
                <Field label="Batch" value={run.runNumber} />
                <Field
                  label="Export lot"
                  value={stored?.outputLotCode ?? packaging?.outputLotCode ?? "—"}
                />
                <Field
                  label="Full Doniya"
                  value={
                    packaging?.doniyaCount != null || stored?.doniyaCount != null
                      ? `${stored?.doniyaCount ?? packaging?.doniyaCount}${
                          (stored?.kgPerDoniya ?? packaging?.kgPerDoniya)
                            ? ` × ${formatQty(
                                stored?.kgPerDoniya ?? packaging?.kgPerDoniya
                              )} kg`
                            : ""
                        }`
                      : "—"
                  }
                />
                <Field
                  label="Packaged"
                  value={
                    stored?.packagedKg || packaging?.packagedKg
                      ? `${formatQty(
                          stored?.packagedKg ?? packaging?.packagedKg
                        )} kg`
                      : "—"
                  }
                />
                <Field
                  label="Saved"
                  value={formatDate(
                    stored?.completedAt ?? packaging?.completedAt
                  )}
                />
              </dl>
              <LabelDetails label={label} />
            </section>
            <section className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4">
              <p className="mb-3 text-xs font-medium text-[var(--frappe-text-muted)]">
                Doniya preview
              </p>
              <DoniyaLabelPreview label={label} className="max-w-[280px]" />
            </section>
          </div>
        )}
      </PermissionGate>
    </AppShell>
  );
}
