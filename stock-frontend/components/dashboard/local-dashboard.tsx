"use client";

import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  FactoryIcon,
  PackageIcon,
  ScaleIcon,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  InsightsGrid,
  KpiTile,
  MetricLink,
  MiniBarChart,
  severityIcon,
} from "@/components/dashboard/dashboard-shared";
import { formatMoney, formatQty } from "@/lib/format";
import type { LocalDashboardData } from "@/lib/types";

export function LocalDashboard({ data }: { data: LocalDashboardData }) {
  const pulse = data.pulse;
  const trace = data.traceability;
  const commercial = data.commercial;
  const links = data.links ?? {};
  const pnl = data.profitAndLoss;
  const fin = data.financialOverview;
  const analytics = data.analytics;
  const insights = data.executiveInsights ?? [];

  return (
    <div className="flex flex-col gap-6">
      <InsightsGrid
        insights={insights}
        insightsHref={links.insights ?? "/insights"}
        emptyHint="No local-market insights yet — add collections, process runs, or local sales."
      />

      {pulse ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <ScaleIcon className="size-4 text-[var(--csolve-moss)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
              Local pulse
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <MetricLink
              href={links.collectionsToday ?? "/collections"}
              label="Intake"
              value={`${formatQty(pulse.intakeKgToday)} kg`}
            />
            <MetricLink
              href={links.processWip ?? "/process-runs"}
              label="Process WIP"
              value={`${formatQty(pulse.processWipKg)} kg`}
              hint={`${pulse.processWipRuns} run(s)`}
            />
            <MetricLink
              href="/lots?form=ROASTED"
              label="Roast output"
              value={`${formatQty(pulse.roastOutputKgToday)} kg`}
            />
            <MetricLink
              href="/lots?form=ROASTED"
              label="Roasted stock"
              value={`${formatQty(pulse.roastedStockKg)} kg`}
            />
            <MetricLink
              href={links.localSales ?? "/sales?channel=LOCAL"}
              label="Local sales"
              value={formatMoney(pulse.localSalesToday)}
            />
            <MetricLink
              href={links.greenLots ?? "/lots?form=GREEN"}
              label="Green stock"
              value={`${formatQty(pulse.greenStockKg)} kg`}
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

      {analytics ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
            Local analytics
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageIcon className="size-4" />
                  Inventory
                </CardTitle>
                <CardDescription>
                  Available stock and low-stock signals for local ops
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                  Purchases vs local roasted / packaged sales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <KpiTile
                    label="Purchases"
                    value={formatMoney(analytics.trading.totalPurchases)}
                    href="/purchases"
                  />
                  <KpiTile
                    label="Local sales"
                    value={formatMoney(analytics.trading.localSalesValue)}
                    href={links.localSales ?? "/sales?channel=LOCAL"}
                  />
                  <KpiTile
                    label="Sales volume"
                    value={`${formatQty(analytics.trading.salesVolumeKg)} kg`}
                    href="/sales?channel=LOCAL"
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
                  Intake acceptance, rejection, and grade mix
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
                  Receivables, payables, and collection pressure
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
                    label="Overdue"
                    value={formatMoney(analytics.finance.overdueBalances)}
                    href="/credits?overdue=1"
                  />
                  <KpiTile
                    label="Paid"
                    value={formatMoney(analytics.finance.paidAmount)}
                    href="/credits"
                  />
                  <KpiTile
                    label="Unpaid"
                    value={formatMoney(analytics.finance.unpaidAmount)}
                    href="/credits"
                  />
                </div>
                <MiniBarChart data={analytics.finance.chart} />
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FactoryIcon className="size-4" />
                  Production
                </CardTitle>
                <CardDescription>
                  Mill / roast / pack yield for the local chain
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
                    label="Yield"
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
          </div>
        </section>
      ) : null}

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
            ) : (
              <p className="text-sm text-muted-foreground">
                No significant yield shortfalls in recent runs.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {data.recommendations && data.recommendations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <WorkflowIcon className="size-4" />
              Recommended local actions
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
            <CardTitle className="text-base">Local commercial</CardTitle>
            <CardDescription>
              Domestic revenue, credit exposure, and liquidity
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
              <div>
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
                <p className="text-xs text-muted-foreground">Local sales</p>
                <p className="font-semibold tabular-nums">
                  {formatMoney(data.dailySales)}
                </p>
                <ArrowUpIcon className="mt-1 size-3 text-emerald-600" />
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Purchases</p>
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
              {data.showroomCount === 1 ? "" : "s"} ·{" "}
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
    </div>
  );
}
