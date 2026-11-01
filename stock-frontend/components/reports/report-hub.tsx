"use client";

import Link from "next/link";
import {
  REPORT_CATEGORY_LABELS,
  reportsByCategory,
  type ReportCategory,
} from "@/lib/reports/catalog";
import { cn } from "@/lib/utils";

const CATEGORY_ACCENT: Record<ReportCategory, string> = {
  finance: "border-l-[var(--frappe-primary)]",
  sales: "border-l-emerald-600",
  purchases: "border-l-amber-600",
  inventory: "border-l-sky-600",
  operations: "border-l-teal-700",
  exports: "border-l-indigo-600",
  partners: "border-l-rose-600",
  people: "border-l-violet-600",
  audit: "border-l-stone-600",
};

export function ReportHub() {
  const groups = reportsByCategory();

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-[var(--frappe-text-muted)]">
        Choose a report. Each opens with date filters, KPIs, a detail table, and
        CSV / PDF export.
      </p>
      {groups.map(({ category, label, reports }) => (
        <section key={category} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--frappe-text)] uppercase">
            {label}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className={cn(
                  "block rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-3 transition hover:bg-[var(--frappe-surface-2)]",
                  "border-l-4",
                  CATEGORY_ACCENT[category]
                )}
              >
                <div className="text-sm font-medium text-[var(--frappe-text)]">
                  {report.title}
                </div>
                <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
                  {report.description}
                </p>
                <span className="mt-2 inline-block text-[10px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
                  {REPORT_CATEGORY_LABELS[category]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
