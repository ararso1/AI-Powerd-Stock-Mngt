"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { PageLoading } from "@/components/shared/page-loading";
import { api } from "@/lib/api";
import { applyCurrencyFromResponse } from "@/lib/currency";
import { errorMessage, formatMoney, formatQty } from "@/lib/format";
import { buildListPath } from "@/lib/list-query";
import type { DashboardData } from "@/lib/types";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  FactoryIcon,
  InfoIcon,
  PackageIcon,
  ScaleIcon,
  ShipIcon,
  SparklesIcon,
  TrendingUpIcon,
  WalletIcon,
  WorkflowIcon,
} from "lucide-react";

const POLL_MS = 45000;
const CHART_COLORS = ["#2f6f4e", "#c47b3a", "#4a6fa5", "#8b5e3c", "#6b8f71"];

function MetricLink({
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

function KpiTile({
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

function MiniBarChart({
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

function severityIcon(severity: string) {
  if (severity === "critical") {
    return <AlertTriangleIcon className="size-4 text-red-600" />;
  }
  if (severity === "warn") {
    return <AlertTriangleIcon className="size-4 text-amber-600" />;
  }
  return <InfoIcon className="size-4 text-[var(--csolve-moss)]" />;
}

function insightTone(tone: string) {
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

export function CommandCenter() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load(silent = false) {
      if (!silent) setLoading(true);
      try {
        const res = await api<DashboardData>(
          buildListPath("/dashboard", {
            params: {
              from: from || undefined,
              to: to || undefined,
            },
          })
        );
        if (cancelled) return;
        applyCurrencyFromResponse(res);
        setData(res);
      } catch (e) {
        if (!cancelled && !silent) toast.error(errorMessage(e));
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(true), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [from, to]);

  if (loading && !data) return <PageLoading />;
  if (!data) return null;

  const pulse = data.pulse;
  const trace = data.traceability;
  const commercial = data.commercial;
  const contracts = data.contracts;
  const links = data.links ?? {};
  const pnl = data.profitAndLoss;
  const fin = data.financialOverview;
  const analytics = data.analytics;
  const insights = data.executiveInsights ?? [];
  const market = data.market;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--frappe-text-muted)]">
            Executive analytics across inventory, trading, quality, finance,
            production, and export — with live AI insights on top.
          </p>
          {data.asOf ? (
            <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
              As of {new Date(data.asOf).toLocaleString()} · refreshes every 45s
            </p>
          ) : null}
        </div>
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-[var(--csolve-moss)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
              AI Executive Insights
            </h2>
          </div>
          <Link
            href={links.insights ?? "/insights"}
            className="text-xs font-medium text-[var(--frappe-primary)] hover:underline"
          >
            Open AI advice →
          </Link>
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
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No executive insights yet — add sales, collections, or credits to
              surface stock days, credit risk, quality, and profit mix.
            </CardContent>
          </Card>
        )}
      </section>

      {market ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
              ICE market prices
            </h2>
            <Link
              href={links.marketPrices ?? "/market-prices"}
              className="text-xs font-medium text-[var(--frappe-primary)] hover:underline"
            >
              Open market prices →
            </Link>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Arabica KC · 30-day USD/kg</CardTitle>
                <CardDescription>
                  FX 1 USD = {market.fx.rate.toFixed(2)} ETB
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={market.chart30d}
                      margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="usdPerKg"
                        stroke="#2f6f4e"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Spot & valuation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(market.instruments ?? []).map((raw) => {
                  const inst = raw as {
                    symbol?: string;
                    name?: string;
                    available?: boolean;
                    usdPerKg?: number;
                    etbPerKg?: number;
                    change7dPercent?: number | null;
                  };
                  if (!inst.available) return null;
                  return (
                    <div key={String(inst.symbol)} className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">{inst.name}</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {Number(inst.usdPerKg).toFixed(3)} USD/kg
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Number(inst.etbPerKg).toFixed(1)} ETB/kg · 7d{" "}
                        {inst.change7dPercent == null
                          ? "—"
                          : `${inst.change7dPercent > 0 ? "+" : ""}${inst.change7dPercent}%`}
                      </p>
                    </div>
                  );
                })}
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Green stock market vs book
                  </p>
                  <p className="font-semibold tabular-nums">
                    {formatMoney(String(market.valuation.marketValueEtb))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Book {formatMoney(String(market.valuation.bookValueEtb))}
                    {market.valuation.gapPercent != null
                      ? ` · gap ${market.valuation.gapPercent}%`
                      : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {analytics ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
            Analytical dashboard
          </h2>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageIcon className="size-4" />
                  Inventory
                </CardTitle>
                <CardDescription>
                  Total, available, reserved, and export-committed stock
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <KpiTile
                    label="Total stock"
                    value={`${formatQty(analytics.inventory.totalStockKg)} kg`}
                    href="/inventory"
                  />
                  <KpiTile
                    label="Stock value"
                    value={formatMoney(analytics.inventory.stockValue)}
                    href="/inventory"
                  />
                  <KpiTile
                    label="Available"
                    value={`${formatQty(analytics.inventory.availableKg)} kg`}
                    href="/inventory"
                  />
                  <KpiTile
                    label="Reserved"
                    value={`${formatQty(analytics.inventory.reservedKg)} kg`}
                    href="/inventory"
                  />
                  <KpiTile
                    label="Export stock"
                    value={`${formatQty(analytics.inventory.exportStockKg)} kg`}
                    href={links.exportStaged ?? "/exports"}
                  />
                  <KpiTile
                    label="Low-stock items"
                    value={String(analytics.inventory.lowStockItems)}
                    href="/inventory?lowStock=1"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUpIcon className="size-4" />
                  Trading
                </CardTitle>
                <CardDescription>
                  Purchases vs local and export sales for the period
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <KpiTile
                    label="Total purchases"
                    value={formatMoney(analytics.trading.totalPurchases)}
                    href="/purchases"
                  />
                  <KpiTile
                    label="Local sales"
                    value={formatMoney(analytics.trading.localSalesValue)}
                    href={links.localSales ?? "/sales?channel=LOCAL"}
                  />
                  <KpiTile
                    label="Export sales"
                    value={formatMoney(analytics.trading.exportSalesValue)}
                    href="/sales?channel=EXPORT"
                  />
                  <KpiTile
                    label="Sales volume"
                    value={`${formatQty(analytics.trading.salesVolumeKg)} kg`}
                    href="/sales"
                  />
                  <KpiTile
                    label="Sales value"
                    value={formatMoney(analytics.trading.salesValue)}
                    href="/sales"
                  />
                </div>
                <MiniBarChart data={analytics.trading.chart} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ScaleIcon className="size-4" />
                  Quality
                </CardTitle>
                <CardDescription>
                  Acceptance, rejection, grade mix, and supplier ranking
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <KpiTile
                    label="Accepted qty"
                    value={`${formatQty(analytics.quality.acceptedQtyKg)} kg`}
                    href={links.collectionsToday ?? "/collections"}
                  />
                  <KpiTile
                    label="Rejected qty"
                    value={`${formatQty(analytics.quality.rejectedQtyKg)} kg`}
                    href="/collections"
                  />
                  <KpiTile
                    label="Rejection %"
                    value={`${analytics.quality.rejectionPercent}%`}
                    href="/collections"
                  />
                </div>
                <MiniBarChart
                  data={analytics.quality.gradeDistribution.map((g) => ({
                    label: g.grade,
                    value: g.kg,
                  }))}
                />
                {analytics.quality.supplierRanking.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Reject %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.quality.supplierRanking.slice(0, 5).map((s) => (
                        <TableRow key={s.supplierName}>
                          <TableCell>{s.supplierName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.rejectionPercent}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <WalletIcon className="size-4" />
                  Finance
                </CardTitle>
                <CardDescription>
                  Receivables, payables, overdue, and paid vs unpaid
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <KpiTile
                    label="Receivables"
                    value={formatMoney(analytics.finance.totalReceivables)}
                    href={links.credits ?? "/credits"}
                  />
                  <KpiTile
                    label="Payables"
                    value={formatMoney(analytics.finance.totalPayables)}
                    href="/credits?tab=suppliers"
                  />
                  <KpiTile
                    label="Customer outstanding"
                    value={formatMoney(analytics.finance.customerOutstanding)}
                    href="/credits"
                  />
                  <KpiTile
                    label="Supplier outstanding"
                    value={formatMoney(analytics.finance.supplierOutstanding)}
                    href="/credits?tab=suppliers"
                  />
                  <KpiTile
                    label="Overdue balances"
                    value={formatMoney(analytics.finance.overdueBalances)}
                    href="/credits?overdue=1"
                  />
                  <KpiTile
                    label="Paid / unpaid"
                    value={`${formatMoney(analytics.finance.paidAmount)} / ${formatMoney(analytics.finance.unpaidAmount)}`}
                    href="/credits"
                  />
                </div>
                <MiniBarChart data={analytics.finance.chart} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FactoryIcon className="size-4" />
                  Production
                </CardTitle>
                <CardDescription>
                  Processing volume, roast, yield, and loss
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <KpiTile
                    label="Processing volume"
                    value={`${formatQty(analytics.production.processingVolumeKg)} kg`}
                    href={links.processWip ?? "/process-runs"}
                  />
                  <KpiTile
                    label="Roasting volume"
                    value={`${formatQty(analytics.production.roastingVolumeKg)} kg`}
                    href="/process-runs"
                  />
                  <KpiTile
                    label="Production yield"
                    value={`${analytics.production.productionYieldPercent}%`}
                    href="/process-runs"
                  />
                  <KpiTile
                    label="Processing loss"
                    value={`${formatQty(analytics.production.processingLossKg)} kg`}
                    href="/process-runs"
                  />
                  <KpiTile
                    label="Wastage"
                    value={`${formatQty(analytics.production.wastageKg)} kg`}
                    href="/process-runs"
                  />
                </div>
                <MiniBarChart data={analytics.production.chart} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShipIcon className="size-4" />
                  Export
                </CardTitle>
                <CardDescription>
                  Contracts, shipments, volume, and outstanding payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <KpiTile
                    label="Export volume"
                    value={`${formatQty(analytics.export.exportVolumeKg)} kg`}
                    href={links.openContracts ?? "/exports"}
                  />
                  <KpiTile
                    label="Export value"
                    value={formatMoney(analytics.export.exportValue)}
                    href="/exports"
                  />
                  <KpiTile
                    label="Active contracts"
                    value={String(analytics.export.activeContracts)}
                    href="/exports"
                  />
                  <KpiTile
                    label="Pending shipments"
                    value={String(analytics.export.pendingShipments)}
                    href="/exports?status=STAGED"
                  />
                  <KpiTile
                    label="Shipped quantity"
                    value={`${formatQty(analytics.export.shippedQuantityKg)} kg`}
                    href="/exports"
                  />
                  <KpiTile
                    label="Outstanding export payments"
                    value={formatMoney(
                      analytics.export.outstandingExportPayments
                    )}
                    href="/credits"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {pulse ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <ScaleIcon className="size-4 text-[var(--csolve-moss)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
              Pulse
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <MetricLink
              href={links.collectionsToday ?? "/collections"}
              label="Intake today"
              value={`${formatQty(pulse.intakeKgToday)} kg`}
            />
            <MetricLink
              href={links.processWip ?? "/process-runs"}
              label="Process WIP"
              value={`${formatQty(pulse.processWipKg)} kg`}
              hint={`${pulse.processWipRuns} run(s)`}
            />
            <MetricLink
              href={links.greenLots ?? "/lots"}
              label="Green stock"
              value={`${formatQty(pulse.greenStockKg)} kg`}
            />
            <MetricLink
              href="/lots?form=ROASTED"
              label="Roast today"
              value={`${formatQty(pulse.roastOutputKgToday)} kg`}
            />
            <MetricLink
              href={links.localSales ?? "/sales?channel=LOCAL"}
              label="Local sales"
              value={formatMoney(pulse.localSalesToday)}
            />
            <MetricLink
              href={links.exportStaged ?? "/exports?status=STAGED"}
              label="Export staged"
              value={`${formatQty(pulse.exportStagedKg)} kg`}
            />
            <MetricLink
              href={links.notifications ?? "/notifications"}
              label="Open alerts"
              value={String(pulse.openAlerts)}
            />
            <MetricLink
              href="/inventory"
              label="Inventory value"
              value={formatMoney(data.totalInventoryValue)}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {trace ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2Icon className="size-4" />
                Traceability health
              </CardTitle>
              <CardDescription>
                Lot-linked coffee stock and QC / yield signals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Lot-linked</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {trace.lotLinkedStockPercent}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Linked kg</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatQty(trace.lotLinkedStockKg)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unlinked kg</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatQty(trace.unlinkedStockKg)}
                  </p>
                </div>
                <Link href={links.qcHoldLots ?? "/lots?status=HOLD"}>
                  <p className="text-xs text-muted-foreground">QC hold lots</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {trace.qcHoldLots}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatQty(trace.qcHoldKg)} kg
                  </p>
                </Link>
              </div>
              {trace.shrinkageSignals.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Yield shortfalls
                  </p>
                  <ul className="space-y-1 text-sm">
                    {trace.shrinkageSignals.map((s) => (
                      <li key={s.processRunId}>
                        <Link
                          href={`/process-runs/${s.processRunId}`}
                          className="text-[var(--frappe-primary)] hover:underline"
                        >
                          {s.runNumber}
                        </Link>
                        <span className="text-muted-foreground">
                          {" "}
                          · {s.variancePercent}% vs expected
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No significant yield shortfalls in recent runs.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {contracts ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShipIcon className="size-4" />
                Contracts & risk
              </CardTitle>
              <CardDescription>
                {contracts.openContracts} open · coverage{" "}
                {contracts.coveragePercent}% (
                {formatQty(contracts.allocatedKg)} /{" "}
                {formatQty(contracts.openVolumeKg)} kg)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contracts.shipWindowRisk.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Ship window risk
                  </p>
                  <ul className="space-y-2 text-sm">
                    {contracts.shipWindowRisk.map((r) => (
                      <li
                        key={r.contractId}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <Link
                          href={`/exports/${r.contractId}`}
                          className="font-medium text-[var(--frappe-primary)] hover:underline"
                        >
                          {r.contractNumber}
                        </Link>
                        <Badge variant="outline">
                          {r.daysRemaining ?? "?"}d ·{" "}
                          {formatQty(r.unallocatedKg)} kg open
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No contracts inside a 14-day ship window with unallocated kg.
                </p>
              )}
              {contracts.missingDocs.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Missing dossier items
                  </p>
                  <ul className="space-y-1 text-sm">
                    {contracts.missingDocs.map((d) => (
                      <li key={d.contractId}>
                        <Link
                          href={`/exports/${d.contractId}`}
                          className="text-[var(--frappe-primary)] hover:underline"
                        >
                          {d.contractNumber}
                        </Link>
                        <span className="text-muted-foreground">
                          {" "}
                          · {d.missing.slice(0, 2).join(", ")}
                          {d.missing.length > 2 ? "…" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {data.recommendations && data.recommendations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <WorkflowIcon className="size-4" />
              Recommended actions
            </CardTitle>
            <CardDescription>
              Rules-based decision support — confirm before acting.{" "}
              <Link
                href="/insights"
                className="text-[var(--frappe-primary)] hover:underline"
              >
                Open AI advice
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-[var(--frappe-border)]">
              {data.recommendations.map((r) => (
                <li key={r.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="mt-0.5">{severityIcon(r.severity)}</div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={r.href}
                      className="font-medium text-[var(--frappe-text)] hover:text-[var(--frappe-primary)] hover:underline"
                    >
                      {r.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">{r.detail}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {r.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commercial</CardTitle>
            <CardDescription>
              Channel mix and exposure for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href={links.localSales ?? "/sales?channel=LOCAL"}>
                <p className="text-xs text-muted-foreground">Local revenue</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(commercial?.localRevenue ?? "0")}
                </p>
              </Link>
              <Link href="/sales?channel=EXPORT">
                <p className="text-xs text-muted-foreground">Export revenue</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(commercial?.exportRevenue ?? "0")}
                </p>
              </Link>
              <div>
                <p className="text-xs text-muted-foreground">Customer credit</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(commercial?.customerCreditOutstanding ?? "0")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Supplier credit</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(commercial?.supplierCreditOutstanding ?? "0")}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Liquidity</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(
                    commercial?.totalLiquidity ??
                      fin.totalLiquidity ??
                      fin.totalBankBalance
                  )}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Daily sales</p>
                <p className="font-semibold tabular-nums">
                  {formatMoney(data.dailySales)}
                </p>
                <ArrowUpIcon className="mt-1 size-3 text-emerald-600" />
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Daily purchases</p>
                <p className="font-semibold tabular-nums">
                  {formatMoney(data.dailyPurchases)}
                </p>
                <ArrowDownIcon className="mt-1 size-3 text-amber-600" />
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Gross profit</p>
                <p className="font-semibold tabular-nums">
                  {formatMoney(pnl.grossProfit)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Net profit</p>
                <p className="font-semibold tabular-nums">
                  {formatMoney(pnl.netProfit)}
                </p>
                <TrendingUpIcon className="mt-1 size-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageIcon className="size-4" />
              Stock by location
            </CardTitle>
            <CardDescription>
              {data.showroomCount} showroom
              {data.showroomCount === 1 ? "" : "s"} · full P&amp;L on{" "}
              <Link
                href={links.profitLoss ?? "/profit-loss"}
                className="text-[var(--frappe-primary)] hover:underline"
              >
                Profit &amp; Loss
              </Link>
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.stockValueByLocation.map((row) => (
                <TableRow key={row.locationId}>
                  <TableCell>{row.locationName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liquidity accounts</CardTitle>
          <CardDescription>
            Cash {formatMoney(fin.cashTotal)} · Bank {formatMoney(fin.bankTotal)}
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>CCY</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fin.bankAccounts.map((acc) => (
              <TableRow key={acc.id}>
                <TableCell>
                  {acc.name}
                  {acc.bankName ? (
                    <span className="ml-1 text-muted-foreground">
                      ({acc.bankName})
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{acc.accountType ?? "BANK"}</Badge>
                </TableCell>
                <TableCell>{acc.currencyCode ?? "ETB"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(acc.balance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
