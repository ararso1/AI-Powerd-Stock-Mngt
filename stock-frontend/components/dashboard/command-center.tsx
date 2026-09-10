"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  InfoIcon,
  PackageIcon,
  ScaleIcon,
  ShipIcon,
  TrendingUpIcon,
  WorkflowIcon,
} from "lucide-react";

const POLL_MS = 45000;

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

function severityIcon(severity: string) {
  if (severity === "critical") {
    return <AlertTriangleIcon className="size-4 text-red-600" />;
  }
  if (severity === "warn") {
    return <AlertTriangleIcon className="size-4 text-amber-600" />;
  }
  return <InfoIcon className="size-4 text-[var(--csolve-moss)]" />;
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--frappe-text-muted)]">
            Where is the coffee? Is quality OK? Are we covering contracts? Are we
            making money?
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
                Open AI Insights
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
