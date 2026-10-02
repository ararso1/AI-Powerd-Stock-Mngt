"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGridIcon, ListIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/shared/page-loading";
import { DataCardTable } from "@/components/shared/data-card-table";
import {
  exportDocsProgress,
  exportHasContract,
  exportHasEcta,
  exportReadiness,
  exportReadinessClass,
  exportReadinessLabel,
} from "@/lib/exports";
import { formatQty } from "@/lib/format";
import type { ExportStoreLot } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[var(--frappe-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function StatusChips({ row }: { row: ExportStoreLot }) {
  const readiness = row.readiness ?? exportReadiness(row);
  const docs = exportDocsProgress(row.documents);
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge className={exportReadinessClass(readiness)}>
        {exportReadinessLabel(readiness)}
      </Badge>
      <Badge variant="outline">
        Contract {exportHasContract(row) ? "✓" : "—"}
      </Badge>
      <Badge variant="outline">
        Docs {docs.attached}/{docs.total}
      </Badge>
      <Badge variant="outline">
        ECTA {exportHasEcta(row) ? "✓" : "—"}
      </Badge>
    </div>
  );
}

function LotCard({ row }: { row: ExportStoreLot }) {
  const readiness = row.readiness ?? exportReadiness(row);
  const docs = exportDocsProgress(row.documents);
  return (
    <article className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <Link
            href={`/exports/lots/${row.lotId}`}
            className="font-semibold text-[var(--frappe-primary)] hover:underline"
          >
            {row.lotCode}
          </Link>
          <p className="text-xs text-[var(--frappe-text-muted)]">
            Batch {row.runNumber ?? "—"}
            {row.locationName ? ` · ${row.locationName}` : ""}
          </p>
        </div>
        <Badge className={`ml-auto ${exportReadinessClass(readiness)}`}>
          {exportReadinessLabel(readiness)}
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Quantity" value={`${formatQty(row.quantityKg)} kg`} />
        <Metric label="Grade" value={row.grade ?? "—"} />
        <Metric
          label="Contract"
          value={
            exportHasContract(row)
              ? row.contracts[0]?.contractNumber ?? "Attached"
              : "Not attached"
          }
        />
        <Metric
          label="Documents"
          value={`${docs.attached}/${docs.total} attached`}
        />
        <Metric
          label="ECTA"
          value={exportHasEcta(row) ? row.ectaGrade ?? "Recorded" : "Not recorded"}
        />
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
      </dl>
      <div className="mt-4">
        <Button asChild size="sm">
          <Link href={`/exports/lots/${row.lotId}`}>Open export detail</Link>
        </Button>
      </div>
    </article>
  );
}

export function ExportLotsPanel() {
  const { data, loading } = useFetch(
    () => api<ExportStoreLot[]>("/exports/store"),
    []
  );
  const rows = data ?? [];
  const [view, setView] = useState<ViewMode>("grid");

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-[var(--frappe-text-muted)]">
          Export-ready coffee through contract, documents, ECTA, shipment, and
          port load.
        </p>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-[var(--frappe-border)] p-1">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
              view === "grid"
                ? "bg-[var(--frappe-primary)] text-white"
                : "text-[var(--frappe-text-muted)]"
            )}
            onClick={() => setView("grid")}
          >
            <LayoutGridIcon className="size-3.5" />
            Grid
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
              view === "list"
                ? "bg-[var(--frappe-primary)] text-white"
                : "text-[var(--frappe-text-muted)]"
            )}
            onClick={() => setView("list")}
          >
            <ListIcon className="size-3.5" />
            List
          </button>
        </div>
      </div>
      {loading ? (
        <PageLoading />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-10 text-center text-sm text-[var(--frappe-text-muted)]">
          No export-ready coffee yet. Finished export runs appear here.
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <LotCard key={row.lotId} row={row} />
          ))}
        </div>
      ) : (
        <DataCardTable
          rows={rows}
          emptyTitle="No export-ready coffee"
          emptyDescription="Finished export runs appear here."
          columns={[
            {
              key: "lot",
              header: "Lot",
              cell: (row) => (
                <Link
                  href={`/exports/lots/${row.lotId}`}
                  className="font-medium text-[var(--frappe-primary)] hover:underline"
                >
                  {row.lotCode}
                </Link>
              ),
            },
            {
              key: "batch",
              header: "Batch",
              cell: (row) => row.runNumber ?? "—",
            },
            {
              key: "qty",
              header: "Quantity",
              cell: (row) => `${formatQty(row.quantityKg)} kg`,
            },
            {
              key: "grade",
              header: "Grade",
              cell: (row) => row.grade ?? "—",
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => <StatusChips row={row} />,
            },
            {
              key: "open",
              header: "",
              cell: (row) => (
                <Link
                  href={`/exports/lots/${row.lotId}`}
                  className="text-sm text-[var(--frappe-primary)] hover:underline"
                >
                  Open
                </Link>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}
