"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FactoryIcon,
  PackageIcon,
  ScaleIcon,
  ShipIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  WalletIcon,
  WorkflowIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CHART_COLORS,
  GroupedBarChart,
  InsightsGrid,
  KpiTile,
  MetricLink,
  MiniBarChart,
  severityIcon,
} from "@/components/dashboard/dashboard-shared";
import { formatMoney, formatQty } from "@/lib/format";
import type { ExportDashboardData } from "@/lib/types";

const FLOW_STEPS = [
  { key: "purchase", label: "Purchase", href: "/purchases?purchaseType=EXPORT" },
  { key: "inventory", label: "Warehouse", href: "/lots?form=GREEN" },
  { key: "processing", label: "Processing", href: "/process-runs?workflow=EXPORT" },
  { key: "packaging", label: "Packaging", href: "/process-runs?workflow=EXPORT" },
  { key: "store", label: "Export store", href: "/exports" },
  { key: "ship", label: "Shipment", href: "/exports" },
] as const;

export function ExportDashboard({ data }: { data: ExportDashboardData }) {
  const flow = data.flow;
  const activity = data.activity;
  const readiness = data.readiness;
  const charts = data.charts;
  const links = data.links ?? {};
  const commercial = data.commercial;
  const finance = data.finance;
  const fin = data.financialOverview;
  const insights = data.executiveInsights ?? [];
  const pipeline = data.pipeline;
  const contracts = data.contracts;

  return (
    <div className="flex flex-col gap-6">
      <InsightsGrid
        insights={insights}
        insightsHref={links.insights ?? "/exports"}
        emptyHint="No export insights yet — add export purchases, process runs, or export-store lots."
      />

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ScaleIcon className="size-4 text-[var(--csolve-moss)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
            Export flow
          </h2>
        </div>
        <p className="mb-3 text-sm text-[var(--frappe-text-muted)]">
          Purchase for export through processing, packaging, the export store,
          and shipment readiness.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {FLOW_STEPS.map((step, index) => (
            <FlowStep key={step.key} index={index + 1} step={step} data={data} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ShipIcon className="size-4 text-[var(--csolve-moss)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
            Executive KPIs
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricLink
            href={links.purchases ?? "/purchases?purchaseType=EXPORT"}
            label="Purchased"
            value={`${formatQty(flow.purchaseKg)} kg`}
            hint={`${flow.purchaseCount} purchase${flow.purchaseCount === 1 ? "" : "s"}`}
          />
          <MetricLink
            href={links.greenLots ?? "/lots?form=GREEN"}
            label="Ready to process"
            value={`${formatQty(flow.inventoryKg)} kg`}
            hint={formatMoney(flow.inventoryValue)}
          />
          <MetricLink
            href={links.processRuns ?? "/process-runs?workflow=EXPORT"}
            label="Open process runs"
            value={String(flow.openRuns)}
            hint={`${flow.completedRuns} completed`}
          />
          <MetricLink
            href={links.exportStore ?? "/exports"}
            label="Export store"
            value={`${formatQty(flow.exportStoreKg)} kg`}
            hint={`${flow.exportStoreLots} lot${flow.exportStoreLots === 1 ? "" : "s"}`}
          />
          <MetricLink
            href={links.openContracts ?? "/exports"}
            label="Ship ready lots"
            value={String(readiness.shipReadyLots)}
            hint={`${readiness.docsReadyLots} docs · ${readiness.ectaReadyLots} ECTA`}
          />
          <MetricLink
            href="/sales?channel=EXPORT"
            label="Export sales"
            value={formatMoney(flow.salesValue)}
            hint={`${formatQty(flow.salesKg)} kg`}
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FactoryIcon className="size-4" />
              Processing progress
            </CardTitle>
            <CardDescription>
              Kilograms sitting at each export process stage right now
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <KpiTile
                label="Processing started"
                value={`${formatQty(flow.processingStartedKg)} kg`}
                href={links.processRuns}
              />
              <KpiTile
                label="Cleaning"
                value={`${formatQty(flow.cleaningKg)} kg`}
                href={links.processRuns}
              />
              <KpiTile
                label="Packaging"
                value={`${formatQty(flow.packagingKg)} kg`}
                href={links.processRuns}
              />
              <KpiTile
                label="Cleaning yield"
                value={`${activity.yieldPercent}%`}
              />
              <KpiTile
                label="Packaged this period"
                value={`${formatQty(activity.packagedKg)} kg`}
              />
              <KpiTile
                label="High loss runs"
                value={String(activity.highLossRuns)}
                href={links.processRuns}
              />
            </div>
            <MiniBarChart data={charts.processing} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageIcon className="size-4" />
              Stock movement
            </CardTitle>
            <CardDescription>
              Available warehouse stock through export store and shipment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <KpiTile
                label="Available"
                value={`${formatQty(flow.inventoryKg)} kg`}
                href={links.greenLots}
              />
              <KpiTile
                label="Reserved"
                value={`${formatQty(flow.reservedKg)} kg`}
                href={links.exportStore}
              />
              <KpiTile
                label="Staged"
                value={`${formatQty(flow.stagedKg)} kg`}
                href="/exports?status=STAGED"
              />
              <KpiTile
                label="Shipped"
                value={`${formatQty(flow.shippedKg)} kg`}
                href="/exports?status=SHIPPED"
              />
              <KpiTile
                label="Reject"
                value={`${formatQty(flow.rejectKg)} kg`}
              />
              <KpiTile
                label="Loaded to port"
                value={String(readiness.loadedLots)}
                href={links.exportStore}
              />
            </div>
            <MiniBarChart data={charts.stockMovement} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUpIcon className="size-4" />
              Export volume trend
            </CardTitle>
            <CardDescription>
              Purchased, packaged, and shipped kilograms over the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GroupedBarChart
              data={charts.volumeTrend}
              emptyMessage="No export volume movement in this period."
              series={[
                { key: "purchasedKg", name: "Purchased", color: CHART_COLORS[0] },
                { key: "packagedKg", name: "Packaged", color: CHART_COLORS[1] },
                { key: "shippedKg", name: "Shipped", color: CHART_COLORS[2] },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCartIcon className="size-4" />
              Export sales trend
            </CardTitle>
            <CardDescription>
              Export channel sales volume across the period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {charts.salesTrend.length === 0 ? (
              <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                No export sales in this period.
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={charts.salesTrend}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e5e7eb"
                    />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="kg"
                      name="kg"
                      stroke={CHART_COLORS[0]}
                      fill={CHART_COLORS[0]}
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageIcon className="size-4" />
              Coffee grades
            </CardTitle>
            <CardDescription>
              Kilograms by grade across export warehouse and export-store stock
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MiniBarChart data={charts.grades} />
          </CardContent>
        </Card>

        {pipeline ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <WorkflowIcon className="size-4" />
                Contract pipeline
              </CardTitle>
              <CardDescription>
                Open contracts {flow.openContracts} · volume{" "}
                {formatQty(flow.openVolumeKg)} kg · allocated{" "}
                {formatQty(flow.allocatedKg)} kg
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MiniBarChart data={pipeline.chart} />
            </CardContent>
          </Card>
        ) : null}
      </div>

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

      {data.recommendations && data.recommendations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <WorkflowIcon className="size-4" />
              Recommended export actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-[var(--frappe-border)]">
              {data.recommendations.map((r) => (
                <li key={r.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="mt-0.5">{severityIcon(r.severity)}</div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={r.href}
                      className="font-medium hover:text-[var(--frappe-primary)] hover:underline"
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
            <CardTitle className="flex items-center gap-2 text-base">
              <WalletIcon className="size-4" />
              Export commercial
            </CardTitle>
            <CardDescription>
              Revenue, payments, and liquidity for the export channel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/sales?channel=EXPORT">
                <p className="text-xs text-muted-foreground">Export revenue</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(commercial?.exportRevenue ?? finance.revenue)}
                </p>
              </Link>
              <div>
                <p className="text-xs text-muted-foreground">
                  Outstanding export payments
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(commercial?.outstandingExportPayments ?? "0")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Customer credit</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(commercial?.customerCreditOutstanding ?? "0")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Supplier credit</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(commercial?.supplierCredit ?? "0")}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Gross profit</p>
                <p className="font-semibold tabular-nums">
                  {formatMoney(finance.grossProfit)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Net profit</p>
                <p className="font-semibold tabular-nums">
                  {formatMoney(finance.netProfit)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Liquidity</p>
                <p className="font-semibold tabular-nums">
                  {formatMoney(
                    commercial?.totalLiquidity ??
                      fin.totalLiquidity ??
                      fin.totalBankBalance
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipment readiness</CardTitle>
            <CardDescription>
              Export-store lots progressing through documentation and ECTA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <KpiTile
                label="Export lots"
                value={String(readiness.exportStoreLots)}
                href={links.exportStore}
              />
              <KpiTile
                label="Documents complete"
                value={String(readiness.docsReadyLots)}
                href={links.exportStore}
              />
              <KpiTile
                label="ECTA recorded"
                value={String(readiness.ectaReadyLots)}
                href={links.exportStore}
              />
              <KpiTile
                label="Ship ready"
                value={String(readiness.shipReadyLots)}
                href={links.exportStore}
              />
              <KpiTile
                label="Loaded to port"
                value={String(readiness.loadedLots)}
                href={links.exportStore}
              />
              <KpiTile
                label="Open contracts"
                value={String(flow.openContracts)}
                href={links.openContracts}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FlowStep({
  index,
  step,
  data,
}: {
  index: number;
  step: (typeof FLOW_STEPS)[number];
  data: ExportDashboardData;
}) {
  const flow = data.flow;
  const readiness = data.readiness;
  let primary = "—";
  let secondary = "";
  switch (step.key) {
    case "purchase":
      primary = `${formatQty(flow.purchaseKg)} kg`;
      secondary = `${flow.purchaseCount} buys · ${formatMoney(flow.purchaseValue)}`;
      break;
    case "inventory":
      primary = `${formatQty(flow.inventoryKg)} kg`;
      secondary = formatMoney(flow.inventoryValue);
      break;
    case "processing":
      primary = `${formatQty(
        (
          parseFloat(flow.processingStartedKg) + parseFloat(flow.cleaningKg)
        ).toFixed(3)
      )} kg`;
      secondary = `${flow.openRuns} open run${flow.openRuns === 1 ? "" : "s"}`;
      break;
    case "packaging":
      primary = `${formatQty(flow.packagingKg)} kg`;
      secondary = `${formatQty(data.activity.packagedKg)} kg packaged`;
      break;
    case "store":
      primary = `${formatQty(flow.exportStoreKg)} kg`;
      secondary = `${flow.exportStoreLots} lots · ${readiness.shipReadyLots} ship ready`;
      break;
    case "ship":
      primary = `${formatQty(flow.shippedKg)} kg`;
      secondary = `${readiness.loadedLots} loaded to port`;
      break;
  }
  return (
    <Link
      href={step.href}
      className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4 transition hover:border-[var(--frappe-primary)]"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-[var(--frappe-primary)]/10 text-xs font-semibold text-[var(--frappe-primary)]">
          {index}
        </span>
        <p className="text-sm font-semibold text-[var(--frappe-text)]">
          {step.label}
        </p>
      </div>
      <p className="mt-3 text-xl font-semibold tabular-nums text-[var(--frappe-text)]">
        {primary}
      </p>
      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">{secondary}</p>
    </Link>
  );
}
