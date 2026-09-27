"use client";

import Link from "next/link";
import { formatQty } from "@/lib/format";
import {
  processStageLabel,
  processStatusClass,
  processStatusLabel,
  processWorkflowLabel,
  type ProcessOverview,
} from "@/lib/process-runs";
import { Badge } from "@/components/ui/badge";

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-3 shadow-sm">
      <p className="text-sm text-[var(--frappe-text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--frappe-text)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function ProcessPipelinePanel({
  overview,
  onSelectStage,
}: {
  overview: ProcessOverview;
  onSelectStage: (stage: string) => void;
}) {
  const lines = overview.pipeline.flatMap((bucket) =>
    bucket.lines.map((line) => ({ ...line, stage: bucket.stage }))
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--frappe-text-muted)]">
        Kilograms still on an open run, at the stage they are on now. Completed
        packs are finished stock and are not included.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {overview.pipeline.map((bucket) => (
          <button
            key={bucket.stage}
            type="button"
            onClick={() => onSelectStage(bucket.stage)}
            className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-3 text-left shadow-sm hover:border-[var(--frappe-primary)]"
          >
            <p className="text-sm text-[var(--frappe-text-muted)]">
              In {processStageLabel(bucket.stage)}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatQty(bucket.kg)} kg
            </p>
            <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
              {bucket.runs === 1 ? "1 open run" : `${bucket.runs} open runs`}
            </p>
          </button>
        ))}
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-[var(--frappe-text-muted)]">
          No coffee is sitting in an open processing run.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] shadow-sm">
          <table className="frappe-list-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Run</th>
                <th>Lot</th>
                <th>Location</th>
                <th className="text-right">Kg</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>{processStageLabel(line.stage)}</td>
                  <td>
                    <Link
                      href={`/process-runs/${line.id}`}
                      className="font-medium text-[var(--frappe-primary)] hover:underline"
                    >
                      {line.runNumber}
                    </Link>
                  </td>
                  <td>{line.lotCode ?? "—"}</td>
                  <td>{line.locationName ?? "—"}</td>
                  <td className="text-right tabular-nums">
                    {formatQty(line.kg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ProcessReportPanel({
  overview,
  onSelectStage,
}: {
  overview: ProcessOverview;
  onSelectStage: (stage: string) => void;
}) {
  const report = overview.report;
  return (
    <div className="space-y-6">
      <ProcessPipelinePanel
        overview={overview}
        onSelectStage={onSelectStage}
      />
      <p className="text-sm text-[var(--frappe-text-muted)]">
        Totals for runs in the selected location, workflow, and dates. Open
        kilograms are the coffee still at its current stage.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Runs" value={String(report.runs)} hint={`${report.openRuns} open · ${report.completedRuns} completed`} />
        <Metric label="Input" value={`${formatQty(report.inputKg)} kg`} hint="Excludes cancelled runs" />
        <Metric label="Open in process" value={`${formatQty(report.openKg)} kg`} />
        <Metric
          label="Output"
          value={`${formatQty(report.outputKg)} kg`}
          hint={
            report.averageYieldPercent
              ? `Average yield ${formatQty(report.averageYieldPercent)}%`
              : "Completed runs"
          }
        />
        <Metric label="Loss" value={`${formatQty(report.lossKg)} kg`} />
        <Metric label="Reject" value={`${formatQty(report.rejectKg)} kg`} />
        <Metric label="Cleaned" value={`${formatQty(report.cleanedKg)} kg`} hint={`${report.highLossRuns} high loss · ${report.underScreenRuns} under screen`} />
        <Metric
          label="Roast / ground"
          value={`${formatQty(report.roastKg)} / ${formatQty(report.groundKg)} kg`}
          hint={`${formatQty(report.unallocatedKg)} kg left unallocated`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] shadow-sm">
          <table className="frappe-list-table">
            <thead>
              <tr>
                <th>Status</th>
                <th className="text-right">Runs</th>
                <th className="text-right">Input kg</th>
              </tr>
            </thead>
            <tbody>
              {report.byStatus.map((row) => (
                <tr key={row.status}>
                  <td>
                    <Badge className={processStatusClass(row.status)}>
                      {processStatusLabel(row.status)}
                    </Badge>
                  </td>
                  <td className="text-right tabular-nums">{row.runs}</td>
                  <td className="text-right tabular-nums">
                    {formatQty(row.inputKg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] shadow-sm">
          <table className="frappe-list-table">
            <thead>
              <tr>
                <th>Workflow</th>
                <th className="text-right">Runs</th>
                <th className="text-right">Input kg</th>
              </tr>
            </thead>
            <tbody>
              {report.byWorkflow.map((row) => (
                <tr key={row.workflow}>
                  <td>{processWorkflowLabel(row.workflow)}</td>
                  <td className="text-right tabular-nums">{row.runs}</td>
                  <td className="text-right tabular-nums">
                    {formatQty(row.inputKg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] shadow-sm">
        <table className="frappe-list-table">
          <thead>
            <tr>
              <th>Packs produced</th>
              <th className="text-right">Packs</th>
              <th className="text-right">Kg</th>
            </tr>
          </thead>
          <tbody>
            {report.packs.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-[var(--frappe-text-muted)]">
                  No sales-store packs recorded for these runs.
                </td>
              </tr>
            ) : (
              report.packs.map((pack) => (
                <tr key={pack.label}>
                  <td>{pack.label}</td>
                  <td className="text-right tabular-nums">
                    {formatQty(pack.count)}
                  </td>
                  <td className="text-right tabular-nums">
                    {formatQty(pack.kg)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
