"use client";

import type { ComponentType } from "react";
import {
  CheckIcon,
  CircleIcon,
  FileTextIcon,
  FlaskConicalIcon,
  PackageCheckIcon,
  ShipIcon,
  TruckIcon,
  WorkflowIcon,
} from "lucide-react";
import {
  EXPORT_READINESS_STEPS,
  exportDocsComplete,
  exportDocsProgress,
  exportHasContract,
  exportHasEcta,
  exportReadiness,
  type ExportReadiness,
} from "@/lib/exports";
import { formatDateTime, formatQty } from "@/lib/format";
import type { ExportStoreLot } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEP_ICONS: Record<
  ExportReadiness,
  ComponentType<{ className?: string }>
> = {
  READY: PackageCheckIcon,
  CONTRACT: WorkflowIcon,
  DOCUMENTS: FileTextIcon,
  ECTA: FlaskConicalIcon,
  SHIP_READY: ShipIcon,
  SHIPPED: TruckIcon,
  LOADED: ShipIcon,
};

export type StepState = "done" | "current" | "pending";

export function exportStepStates(lot: ExportStoreLot): Record<
  ExportReadiness,
  { state: StepState; detail: string }
> {
  const hasContract = exportHasContract(lot);
  const docs = exportDocsProgress(lot.documents);
  const docsDone = exportDocsComplete(lot.documents);
  const hasEcta = exportHasEcta(lot);
  const shipReady = hasContract && docsDone && hasEcta;
  const shipped =
    lot.status === "SHIPPED" ||
    lot.readiness === "SHIPPED" ||
    lot.readiness === "LOADED";
  const loaded = Boolean(lot.loadReport?.loadedAt || lot.readiness === "LOADED");
  const current = lot.readiness ?? exportReadiness(lot);

  const contractDetail = hasContract
    ? lot.contracts
        .map((c) => c.contractNumber)
        .filter(Boolean)
        .slice(0, 2)
        .join(", ") || "Attached"
    : "Not attached";
  const ectaDetail = hasEcta
    ? [lot.ectaGrade, lot.ectaCertificateNumber].filter(Boolean).join(" · ") ||
      "Recorded"
    : "Not recorded";
  const loadDetail = loaded
    ? [lot.loadReport?.portName, formatDateTime(lot.loadReport?.loadedAt)]
        .filter(Boolean)
        .join(" · ")
    : "Awaiting port report";

  const doneFlags: Record<ExportReadiness, boolean> = {
    READY: true,
    CONTRACT: hasContract,
    DOCUMENTS: docsDone,
    ECTA: hasEcta,
    SHIP_READY: shipReady,
    SHIPPED: shipped,
    LOADED: loaded,
  };

  const details: Record<ExportReadiness, string> = {
    READY: `${formatQty(lot.quantityKg)} kg in export store`,
    CONTRACT: contractDetail,
    DOCUMENTS: `${docs.attached}/${docs.total} attached`,
    ECTA: ectaDetail,
    SHIP_READY: shipReady ? "Ready to ship" : "Needs contract, docs & ECTA",
    SHIPPED: shipped
      ? `${formatQty(lot.shippedKg)} kg shipped`
      : "Not shipped yet",
    LOADED: loadDetail,
  };

  const result = {} as Record<
    ExportReadiness,
    { state: StepState; detail: string }
  >;
  for (const step of EXPORT_READINESS_STEPS) {
    const done = doneFlags[step.key];
    let state: StepState = "pending";
    if (done) state = "done";
    else if (step.key === current || (!done && current === step.key))
      state = "current";
    result[step.key] = { state, detail: details[step.key] };
  }

  // Prefer the first incomplete step as current when readiness jumps ahead
  // (e.g. ECTA recorded before documents).
  const firstPending = EXPORT_READINESS_STEPS.find(
    (step) => !doneFlags[step.key]
  );
  if (firstPending) {
    for (const step of EXPORT_READINESS_STEPS) {
      if (result[step.key].state === "current" && step.key !== firstPending.key) {
        result[step.key] = {
          ...result[step.key],
          state: doneFlags[step.key] ? "done" : "pending",
        };
      }
    }
    if (!doneFlags[firstPending.key]) {
      result[firstPending.key] = {
        ...result[firstPending.key],
        state: "current",
      };
    }
  }

  return result;
}

export function ExportReadinessTrack({
  lot,
  className,
}: {
  lot: ExportStoreLot;
  className?: string;
}) {
  const states = exportStepStates(lot);
  const docs = exportDocsProgress(lot.documents);
  const completed = EXPORT_READINESS_STEPS.filter(
    (step) => states[step.key].state === "done"
  ).length;
  const pct = Math.round((completed / EXPORT_READINESS_STEPS.length) * 100);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--frappe-text-muted)]">
            Export readiness
          </p>
          <p className="mt-0.5 text-sm text-[var(--frappe-text-muted)]">
            {completed} of {EXPORT_READINESS_STEPS.length} steps complete · docs{" "}
            {docs.attached}/{docs.total}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-[var(--csolve-moss)]">
          {pct}%
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--frappe-border)]">
        <div
          className="h-full rounded-full bg-[var(--csolve-moss)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {EXPORT_READINESS_STEPS.map((step, index) => {
          const meta = states[step.key];
          const Icon = STEP_ICONS[step.key];
          return (
            <li
              key={step.key}
              className={cn(
                "relative rounded-xl border px-3 py-3 transition-colors",
                meta.state === "done" &&
                  "border-emerald-500/35 bg-emerald-500/[0.08]",
                meta.state === "current" &&
                  "border-[var(--csolve-moss)] bg-[var(--csolve-moss)]/[0.08] shadow-sm ring-1 ring-[var(--csolve-moss)]/20",
                meta.state === "pending" &&
                  "border-[var(--frappe-border)] bg-[var(--frappe-surface)] opacity-80"
              )}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                    meta.state === "done" && "bg-emerald-600 text-white",
                    meta.state === "current" &&
                      "bg-[var(--csolve-moss)] text-[var(--csolve-parchment)]",
                    meta.state === "pending" &&
                      "bg-[var(--frappe-border)] text-[var(--frappe-text-muted)]"
                  )}
                >
                  {meta.state === "done" ? (
                    <CheckIcon className="size-3.5" strokeWidth={2.5} />
                  ) : meta.state === "current" ? (
                    <Icon className="size-3.5" />
                  ) : (
                    <CircleIcon className="size-3" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--frappe-text-muted)]">
                    Step {index + 1}
                  </p>
                  <p className="text-sm font-semibold text-[var(--frappe-text)]">
                    {step.label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--frappe-text-muted)]">
                    {meta.detail}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
