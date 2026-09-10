"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoading } from "@/components/shared/page-loading";
import {
  FrappeButtonPrimary,
  FrappeButtonSecondary,
  FrappeFilterBar,
} from "@/components/frappe";
import { api } from "@/lib/api";
import { buildListPath } from "@/lib/list-query";
import { errorMessage, formatQty } from "@/lib/format";
import type {
  AiFeedbackDecision,
  AiInsight,
  AiInsightKind,
  AiInsightStatus,
  AiStockTrends,
  AiSummary,
} from "@/lib/types";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  CheckIcon,
  InfoIcon,
  RefreshCwIcon,
  SparklesIcon,
  TrendingUpIcon,
  XIcon,
} from "lucide-react";

const ALL = "__all__";

const KIND_LABEL: Record<AiInsightKind, string> = {
  DEMAND_FORECAST: "Demand forecast",
  INTAKE_ADVICE: "Intake advice",
  YIELD_ANOMALY: "Yield anomaly",
  BLEND_OPTIMIZER: "Blend optimizer",
  PRICING: "Pricing",
  EXPORT_READINESS: "Export readiness",
  QUALITY_RISK: "Quality risk",
};

function severityIcon(severity: string) {
  if (severity === "critical") {
    return <AlertTriangleIcon className="size-4 text-red-600" />;
  }
  if (severity === "warn") {
    return <AlertTriangleIcon className="size-4 text-amber-600" />;
  }
  return <InfoIcon className="size-4 text-[var(--csolve-moss)]" />;
}

function ForecastChart({ payload }: { payload: Record<string, unknown> }) {
  const series = Array.isArray(payload.series)
    ? (payload.series as Array<{
        week?: string;
        roastKg?: number;
        cherryIntakeKg?: number;
      }>)
    : [];
  if (series.length === 0) return null;
  const data = series.map((s) => ({
    week: (s.week ?? "").slice(5),
    roastKg: s.roastKg ?? 0,
    cherryIntakeKg: s.cherryIntakeKg ?? 0,
  }));
  return (
    <div className="mt-3 h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="roastKg" name="Out kg" fill="var(--csolve-roast)" radius={2} />
          <Bar
            dataKey="cherryIntakeKg"
            name="Intake kg"
            fill="var(--csolve-moss)"
            radius={2}
            opacity={0.75}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function InsightPayload({ insight }: { insight: AiInsight }) {
  const p = insight.payload ?? {};
  if (insight.kind === "DEMAND_FORECAST") {
    return <ForecastChart payload={p} />;
  }
  if (insight.kind === "BLEND_OPTIMIZER" && Array.isArray(p.lots)) {
    const lots = p.lots as Array<{
      lotCode?: string;
      percent?: number;
      role?: string;
    }>;
    return (
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {lots.map((l, i) => (
          <li key={`${l.lotCode}-${i}`}>
            {l.percent}% · {l.lotCode}
            {l.role ? ` (${l.role})` : ""}
          </li>
        ))}
      </ul>
    );
  }
  if (insight.kind === "PRICING" && p.local && p.export) {
    const local = p.local as {
      floorPerKg?: number;
      targetPerKg?: number;
      currency?: string;
    };
    const exp = p.export as {
      floorPerKg?: number;
      ceilingPerKg?: number;
      currency?: string;
    };
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Local {local.currency} {local.floorPerKg}–{local.targetPerKg}/kg · Export{" "}
        {exp.currency} {exp.floorPerKg}–{exp.ceilingPerKg}/kg
      </p>
    );
  }
  if (insight.kind === "EXPORT_READINESS" && insight.score != null) {
    const missing = Array.isArray(p.missing) ? (p.missing as string[]) : [];
    return (
      <div className="mt-2">
        <div className="h-2 overflow-hidden rounded-full bg-[var(--frappe-border)]">
          <div
            className="h-full rounded-full bg-[var(--frappe-primary)]"
            style={{ width: `${Math.min(100, Number(insight.score))}%` }}
          />
        </div>
        {missing.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Missing: {missing.slice(0, 4).join(", ")}
          </p>
        ) : null}
      </div>
    );
  }
  return null;
}

function StockTrendsSection({ trends }: { trends: AiStockTrends }) {
  const daily = trends.dailyOps.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));
  const byForm = trends.stockByForm.map((f) => ({
    form: f.form,
    kg: f.kg,
  }));
  const byLoc = trends.stockByLocation.slice(0, 6).map((l) => ({
    name: l.locationName.length > 14
      ? `${l.locationName.slice(0, 12)}…`
      : l.locationName,
    kg: l.kg,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TrendingUpIcon className="size-4 text-[var(--frappe-primary)]" />
        <h2 className="text-base font-semibold text-[var(--frappe-text)]">
          Stock operation trends
        </h2>
        {trends.demoFilled ? (
          <Badge variant="secondary">Demo-filled series</Badge>
        ) : (
          <Badge variant="outline">Live ops</Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Green on hand</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatQty(String(trends.totals.greenKg))} kg
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cherry on hand</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatQty(String(trends.totals.cherryKg))} kg
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg daily intake</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatQty(String(trends.totals.avgDailyIntakeKg))} kg
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg daily outbound</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatQty(String(trends.totals.avgDailySoldKg))} kg
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {trends.highlights.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {trends.highlights.map((h) => (
            <li key={h}>· {h}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intake vs outbound (14d)</CardTitle>
            <CardDescription>
              Cherry intake against local sale / export ship events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="intakeKg"
                    name="Intake kg"
                    stroke="var(--csolve-moss)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="soldKg"
                    name="Outbound kg"
                    stroke="var(--csolve-roast)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="transferKg"
                    name="Transfer kg"
                    stroke="var(--csolve-honey)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock by coffee form</CardTitle>
            <CardDescription>Active lot quantities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              {byForm.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active lot stock yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byForm} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="form" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="kg" name="kg" fill="var(--csolve-moss)" radius={3} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock by location</CardTitle>
            <CardDescription>Warehouse / mill / staging balances</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              {byLoc.length === 0 ? (
                <p className="text-sm text-muted-foreground">No location stock yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={byLoc}
                    layout="vertical"
                    margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip />
                    <Bar dataKey="kg" name="kg" fill="var(--csolve-bean)" radius={3} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forward demand (4 weeks)</CardTitle>
            <CardDescription>Projected green need and cherry intake</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={trends.forecast.map((f) => ({
                    week: f.week.slice(5),
                    green: f.projectedGreenNeedKg,
                    intake: f.projectedIntakeKg,
                  }))}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="green" name="Green need" fill="var(--csolve-roast)" radius={2} />
                  <Bar dataKey="intake" name="Intake plan" fill="var(--csolve-moss)" radius={2} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {trends.signals.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {trends.signals.map((s) => (
            <Link
              key={s.code}
              href={s.href}
              className="rounded-lg border border-[var(--frappe-border)] p-3 transition hover:border-[var(--frappe-primary)]"
            >
              <div className="flex items-center gap-2">
                {severityIcon(s.severity)}
                <span className="font-medium text-[var(--frappe-text)]">{s.title}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AiInsightsPanel() {
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [trends, setTrends] = useState<AiStockTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<AiInsightKind | "">("");
  const [status, setStatus] = useState<AiInsightStatus | "">("OPEN");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [autoFixed, setAutoFixed] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [list, sum, trendRes] = await Promise.all([
          api<{ data: AiInsight[] }>(
            buildListPath("/ai/insights", {
              params: {
                kind: kind || undefined,
                status: status || undefined,
              },
              limit: 100,
            })
          ),
          api<AiSummary>("/ai/summary"),
          api<AiStockTrends>("/ai/trends"),
        ]);
        setInsights(list.data ?? []);
        setSummary(sum);
        setTrends(trendRes);
        return sum;
      } catch (err) {
        toast.error(errorMessage(err));
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [kind, status]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ upserted: number; totalOpen: number }>(
        "/ai/refresh",
        {
          method: "POST",
          body: { includeDemo: true, forceReopen: true },
        }
      );
      toast.success(
        `Refreshed ${res.upserted} insight(s) · ${res.totalOpen} open`
      );
      setStatus("OPEN");
      await load(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void (async () => {
      const sum = await load();
      if (
        sum &&
        sum.open === 0 &&
        !autoFixed &&
        status === "OPEN" &&
        !kind
      ) {
        setAutoFixed(true);
        try {
          await api("/ai/refresh", {
            method: "POST",
            body: { includeDemo: true, forceReopen: true },
          });
          await load(true);
        } catch {
          /* empty state CTA handles retry */
        }
      }
    })();
  }, [load, autoFixed, status, kind]);

  const openCount = useMemo(
    () => insights.filter((i) => i.status === "OPEN").length,
    [insights]
  );

  async function feedback(id: string, decision: AiFeedbackDecision) {
    setBusyId(id);
    try {
      await api(`/ai/insights/${id}/feedback`, {
        method: "POST",
        body: { decision },
      });
      toast.success(
        decision === "ACCEPT"
          ? "Accepted — confirm the linked action yourself"
          : decision === "REJECT"
            ? "Rejected and logged"
            : "Dismissed"
      );
      await load(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !trends && insights.length === 0) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-6">
      {trends ? <StockTrendsSection trends={trends} /> : null}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <SparklesIcon className="size-4 text-[var(--frappe-primary)]" />
          <h2 className="text-base font-semibold text-[var(--frappe-text)]">
            Recommendations
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {summary?.open ?? openCount}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Accepted</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {summary?.accepted ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Rejected</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {summary?.rejected ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Accept rate</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {summary?.acceptRate != null
                  ? `${Math.round(summary.acceptRate * 100)}%`
                  : "—"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <p className="text-sm text-muted-foreground">
          {summary?.note ??
            "AI recommends only — humans confirm stock and money actions."}
        </p>

        <FrappeFilterBar>
          <Select
            value={kind || ALL}
            onValueChange={(v) =>
              setKind(v === ALL ? "" : (v as AiInsightKind))
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All kinds</SelectItem>
              {(Object.keys(KIND_LABEL) as AiInsightKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status || ALL}
            onValueChange={(v) =>
              setStatus(v === ALL ? "" : (v as AiInsightStatus))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="ACCEPTED">Accepted</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="DISMISSED">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <FrappeButtonSecondary type="button" onClick={() => void refresh()}>
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </FrappeButtonSecondary>
        </FrappeFilterBar>

        {insights.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <SparklesIcon className="size-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {status === "OPEN"
                  ? "No open recommendations. Refresh to regenerate stock-ops insights."
                  : "No insights for this filter."}
              </p>
              <FrappeButtonPrimary type="button" onClick={() => void refresh()}>
                Refresh stock insights
              </FrappeButtonPrimary>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {insights.map((insight) => (
              <Card key={insight.id}>
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {severityIcon(insight.severity)}
                    <Badge variant="outline">{KIND_LABEL[insight.kind]}</Badge>
                    <Badge variant="secondary" className="capitalize">
                      {insight.source.toLowerCase()}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {insight.status.toLowerCase()}
                    </Badge>
                    {insight.score != null ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        score {Number(insight.score).toFixed(0)}
                      </span>
                    ) : null}
                  </div>
                  <CardTitle className="text-base">
                    {insight.href ? (
                      <Link
                        href={insight.href}
                        className="hover:text-[var(--frappe-primary)] hover:underline"
                      >
                        {insight.title}
                      </Link>
                    ) : (
                      insight.title
                    )}
                  </CardTitle>
                  <CardDescription>{insight.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <InsightPayload insight={insight} />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Confidence {(Number(insight.confidence) * 100).toFixed(0)}%
                    {insight.code ? ` · ${insight.code}` : ""}
                  </p>
                  {insight.status === "OPEN" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busyId === insight.id}
                        onClick={() => void feedback(insight.id, "ACCEPT")}
                      >
                        <CheckIcon className="size-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === insight.id}
                        onClick={() => void feedback(insight.id, "REJECT")}
                      >
                        <XIcon className="size-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === insight.id}
                        onClick={() => void feedback(insight.id, "DISMISS")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
