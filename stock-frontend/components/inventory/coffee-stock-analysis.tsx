"use client";

import { coffeeLineKg, coffeePosition } from "@/lib/inventory-items";
import type { ProcessOverview } from "@/lib/process-runs";
import type { StockRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export function summarizeCoffeeStock(
  rows: StockRecord[],
  overview: ProcessOverview | null
): CoffeeStockFigures {
  let availableKg = 0;
  let salesKg = 0;
  let rejectKg = 0;
  for (const row of rows) {
    const position = coffeePosition(row);
    if (!position) continue;
    const kg = coffeeLineKg(row);
    if (position === "available") availableKg += kg;
    else if (position === "sales") salesKg += kg;
    else rejectKg += kg;
  }
  const processingKg = (overview?.pipeline ?? [])
    .filter((stage) => stage.stage !== "Sales Store")
    .reduce((sum, stage) => sum + (parseFloat(stage.kg) || 0), 0);
  const round = (value: number) =>
    Math.round((value + Number.EPSILON) * 1000) / 1000;
  availableKg = round(availableKg);
  salesKg = round(salesKg);
  rejectKg = round(rejectKg);
  const processing = round(processingKg);
  return {
    availableKg,
    processingKg: processing,
    salesKg,
    rejectKg,
    totalKg: round(availableKg + processing + salesKg + rejectKg),
  };
}

export interface CoffeeStockFigures {
  availableKg: number;
  processingKg: number;
  salesKg: number;
  rejectKg: number;
  totalKg: number;
}

export function CoffeeStockAnalysis({
  analysis,
  loading,
  locationName,
}: {
  analysis: CoffeeStockFigures | null;
  loading: boolean;
  locationName: string;
}) {
  const value = (kg: number) =>
    loading || !analysis ? "…" : `${formatKg(kg)} kg`;

  return (
    <section className="mb-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--frappe-text)]">
          Coffee stock analysis
        </h2>
        <p className="text-sm text-[var(--frappe-text-muted)]">
          {locationName}. Total coffee is available for processing, currently
          in processing, in the sales store, and reject.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AnalysisCard
          label="Total coffee"
          value={value(analysis?.totalKg ?? 0)}
          hint="Warehouse position"
        />
        <AnalysisCard
          label="Available for processing"
          value={value(analysis?.availableKg ?? 0)}
          hint="Raw coffee on hand"
          tone="ok"
        />
        <AnalysisCard
          label="In processing"
          value={value(analysis?.processingKg ?? 0)}
          hint="Open process runs"
        />
        <AnalysisCard
          label="Sales store"
          value={value(analysis?.salesKg ?? 0)}
          hint="Roast, ground, and packs"
          tone="ok"
        />
        <AnalysisCard
          label="Reject"
          value={value(analysis?.rejectKg ?? 0)}
          hint="Held out of processing"
          tone="watch"
        />
      </div>
    </section>
  );
}

function formatKg(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function AnalysisCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "watch" | "ok";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 shadow-sm",
        tone === "watch"
          ? "border-[var(--csolve-honey)] bg-warning"
          : tone === "ok"
            ? "border-[var(--csolve-moss)] bg-[var(--csolve-moss-soft)]"
            : "border-[var(--frappe-border)] bg-[var(--frappe-surface)]"
      )}
    >
      <p className="text-sm text-[var(--frappe-text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--frappe-text)]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">{hint}</p>
    </div>
  );
}
