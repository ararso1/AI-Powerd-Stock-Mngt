"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangleIcon, InfoIcon } from "lucide-react";

export const POLL_MS = 45000;
export const CHART_COLORS = ["#2f6f4e", "#c47b3a", "#4a6fa5", "#8b5e3c", "#6b8f71"];

export function MetricLink({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4 transition hover:border-[var(--frappe-primary)]"
    >
      <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--frappe-text)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">{hint}</p>
      ) : null}
    </Link>
  );
}

export function KpiTile({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs text-[var(--frappe-text-muted)]">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-[var(--frappe-text)]">
        {value}
      </p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="rounded-md border border-[var(--frappe-border)] p-3 transition hover:border-[var(--frappe-primary)]"
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="rounded-md border border-[var(--frappe-border)] p-3">
      {body}
    </div>
  );
}

export function MiniBarChart({
  data,
  valueKey = "value",
  nameKey = "label",
}: {
  data: Array<Record<string, string | number>>;
  valueKey?: string;
  nameKey?: string;
}) {
  if (!data.length) {
    return (
      <p className="flex h-36 items-center justify-center text-sm text-muted-foreground">
        No chart data yet
      </p>
    );
  }
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey={valueKey} radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function severityIcon(severity: string) {
  if (severity === "critical") {
    return <AlertTriangleIcon className="size-4 text-red-600" />;
  }
  if (severity === "warn") {
    return <AlertTriangleIcon className="size-4 text-amber-600" />;
  }
  return <InfoIcon className="size-4 text-[var(--csolve-moss)]" />;
}

export function insightTone(tone: string) {
  switch (tone) {
    case "critical":
      return {
        border: "border-red-200",
        bg: "bg-red-50",
        badge: "bg-red-100 text-red-800",
        mark: "🔴",
      };
    case "warn":
      return {
        border: "border-amber-200",
        bg: "bg-amber-50",
        badge: "bg-amber-100 text-amber-900",
        mark: "⚠️",
      };
    case "profit":
      return {
        border: "border-emerald-200",
        bg: "bg-emerald-50",
        badge: "bg-emerald-100 text-emerald-900",
        mark: "💰",
      };
    case "info":
      return {
        border: "border-sky-200",
        bg: "bg-sky-50",
        badge: "bg-sky-100 text-sky-900",
        mark: "📈",
      };
    default:
      return {
        border: "border-emerald-200",
        bg: "bg-emerald-50",
        badge: "bg-emerald-100 text-emerald-900",
        mark: "🟢",
      };
  }
}

export function InsightsGrid({
  insights,
  insightsHref,
  emptyHint,
}: {
  insights: Array<{
    id: string;
    tone: string;
    category: string;
    title: string;
    detail: string;
    href: string;
  }>;
  insightsHref?: string;
  emptyHint: string;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
          AI Executive Insights
        </h2>
        {insightsHref ? (
          <Link
            href={insightsHref}
            className="text-xs font-medium text-[var(--frappe-primary)] hover:underline"
          >
            Open AI advice →
          </Link>
        ) : null}
      </div>
      {insights.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {insights.map((card) => {
            const tone = insightTone(card.tone);
            return (
              <Link
                key={card.id}
                href={card.href}
                className={`rounded-lg border ${tone.border} ${tone.bg} p-4 transition hover:shadow-sm`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span aria-hidden>{tone.mark}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.badge}`}
                  >
                    {card.category}
                  </span>
                </div>
                <p className="text-sm font-medium text-[var(--frappe-text)]">
                  {card.title}
                </p>
                <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
                  {card.detail}
                </p>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {emptyHint}
        </p>
      )}
    </section>
  );
}
