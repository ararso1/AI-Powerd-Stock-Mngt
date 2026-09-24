"use client";

import Link from "next/link";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PackageIcon,
  ShipIcon,
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
import type { ExportDashboardData } from "@/lib/types";

export function ExportDashboard({ data }: { data: ExportDashboardData }) {
  const pulse = data.pulse;
  const contracts = data.contracts;
  const commercial = data.commercial;
  const links = data.links ?? {};
  const pnl = data.profitAndLoss;
  const fin = data.financialOverview;
  const analytics = data.analytics;
  const insights = data.executiveInsights ?? [];
  const market = data.market;
  const pipeline = data.pipeline;

  return (
    <div className="flex flex-col gap-6">
      <InsightsGrid
        insights={insights}
        insightsHref={links.insights ?? "/insights"}
        emptyHint="No export insights yet — add contracts, allocations, or green stock."
      />

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
                <CardTitle className="text-base">
                  Arabica KC · 30-day USD/kg
                </CardTitle>
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
                    <div
                      key={String(inst.symbol)}
                      className="rounded-md border p-3"
                    >
                      <p className="text-xs text-muted-foreground">
                        {inst.name}
                      </p>
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

      {pulse ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <ShipIcon className="size-4 text-[var(--csolve-moss)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
              Export pulse
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <MetricLink
              href={links.greenLots ?? "/lots?form=GREEN"}
              label="Green stock"
              value={`${formatQty(pulse.greenStockKg)} kg`}
            />
            <MetricLink
              href={links.exportStaged ?? "/exports?status=STAGED"}
              label="Export staged"
              value={`${formatQty(pulse.exportStagedKg)} kg`}
            />
            <MetricLink
              href="/sales?channel=EXPORT"
              label="Export sales"
              value={formatMoney(pulse.exportSalesToday)}
            />
            <MetricLink
              href={links.openContracts ?? "/exports"}
              label="Open contracts"
              value={String(contracts?.openContracts ?? 0)}
              hint={`${contracts?.coveragePercent ?? 0}% covered`}
            />
            <MetricLink
              href={links.notifications ?? "/notifications"}
              label="Open alerts"
              value={String(pulse.openAlerts)}
            />
          </div>
        </section>
      ) : null}

      {analytics ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
            Export analytics
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageIcon className="size-4" />
                  Green inventory
                </CardTitle>
                <CardDescription>
                  Available vs reserved / export-committed stock
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
                    label="Export committed"
                    value={`${formatQty(analytics.inventory.exportStockKg)} kg`}
                    href={links.exportStaged ?? "/exports"}
                  />
                  <KpiTile
                    label="Stock value"
                    value={formatMoney(analytics.inventory.stockValue)}
                    href="/inventory"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUpIcon className="size-4" />
                  Export trading
                </CardTitle>
                <CardDescription>
                  Contract sales and shipped value for the period
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <KpiTile
                    label="Export sales"
                    value={formatMoney(analytics.trading.exportSalesValue)}
                    href="/sales?channel=EXPORT"
                  />
                  <KpiTile
                    label="Sales volume"
                    value={`${formatQty(analytics.trading.salesVolumeKg)} kg`}
                    href="/sales?channel=EXPORT"
                  />
                  <KpiTile
                    label="Shipped value"
                    value={formatMoney(analytics.export.exportValue)}
                    href="/exports"
                  />
                </div>
                <MiniBarChart data={analytics.trading.chart} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShipIcon className="size-4" />
                  Contracts & shipments
                </CardTitle>
                <CardDescription>
                  Pipeline volume, pending ship, and payments
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
                    label="Outstanding payments"
                    value={formatMoney(
                      analytics.export.outstandingExportPayments
                    )}
                    href={links.credits ?? "/credits"}
                  />
                </div>
              </CardContent>
            </Card>

            {pipeline ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <WorkflowIcon className="size-4" />
                    Export pipeline
                  </CardTitle>
                  <CardDescription>
                    Contract count by lifecycle status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MiniBarChart data={pipeline.chart} />
                </CardContent>
              </Card>
            ) : null}
          </div>
        </section>
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
              Export revenue, payments, and liquidity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/sales?channel=EXPORT">
                <p className="text-xs text-muted-foreground">Export revenue</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(commercial?.exportRevenue ?? "0")}
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
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  Export sales
                </p>
                <p className="font-semibold tabular-nums">
                  {formatMoney(data.dailySales)}
                </p>
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
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Liquidity accounts</CardTitle>
            <CardDescription>
              Cash {formatMoney(fin.cashTotal)} · Bank{" "}
              {formatMoney(fin.bankTotal)}
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
    </div>
  );
}
