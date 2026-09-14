"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { PermissionGate } from "@/components/permission-gate";
import { PageLoading } from "@/components/shared/page-loading";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { errorMessage, formatMoney, formatQty } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { RefreshCwIcon } from "lucide-react";
import Link from "next/link";

type Instrument = {
  symbol: string;
  name: string;
  available: boolean;
  priceDate?: string;
  nativePrice?: number;
  nativeUnit?: string;
  source?: string;
  change7dPercent?: number | null;
  change30dPercent?: number | null;
  usdPerKg?: number;
  etbPerKg?: number;
  usdPerQuintal?: number;
  etbPerQuintal?: number;
  usdPerTon?: number;
  etbPerTon?: number;
};

type CurrentResponse = {
  asOf: string;
  fx: { rate: number; rateDate: string; source: string };
  instruments: Instrument[];
};

type HistoryPoint = {
  date: string;
  usdPerKg: number;
  etbPerKg: number;
  usdPerQuintal: number;
  etbPerQuintal: number;
};

type Valuation = {
  totalKg: number;
  bookValueEtb: number;
  marketValueEtb: number;
  marketValueUsd: number;
  gapEtb: number;
  gapPercent: number | null;
  byGrade: Array<{
    grade: string;
    kg: number;
    bookEtb: number;
    marketEtb: number;
  }>;
};

type ExportRow = {
  contractId: string;
  contractNumber: string;
  grade: string | null;
  contractUsdPerKg: number;
  marketUsdPerKg: number;
  suggestedUsdPerKg: number;
  spreadPercent: number | null;
};

function pctLabel(v?: number | null) {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function MarketPricesPanel() {
  const { user } = useAuth();
  const canSync = hasPermission(user, "market_prices.write");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [current, setCurrent] = useState<CurrentResponse | null>(null);
  const [historyKc, setHistoryKc] = useState<HistoryPoint[]>([]);
  const [historyRc, setHistoryRc] = useState<HistoryPoint[]>([]);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [gradeG1, setGradeG1] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [cur, kc, rc, val, exp, g1] = await Promise.all([
        api<CurrentResponse>("/market-prices/current"),
        api<{ series: HistoryPoint[] }>("/market-prices/history?symbol=KC"),
        api<{ series: HistoryPoint[] }>("/market-prices/history?symbol=RC"),
        api<Valuation>("/market-prices/valuation"),
        api<{ contracts: ExportRow[] }>("/market-prices/export-guidance"),
        api<Record<string, unknown>>(
          "/market-prices/grade-price?grade=G1&coffeeType=ARABICA"
        ),
      ]);
      setCurrent(cur);
      setHistoryKc(kc.series.slice(-60));
      setHistoryRc(rc.series.slice(-60));
      setValuation(val);
      setExports(exp.contracts.slice(0, 12));
      setGradeG1(g1);
    } catch (e) {
      if (!silent) toast.error(errorMessage(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSync() {
    setSyncing(true);
    try {
      const res = await api<{ upserted?: number }>("/market-prices/sync", {
        method: "POST",
      });
      toast.success(`Synced ${res.upserted ?? 0} price bars`);
      await load(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSyncing(false);
    }
  }

  if (loading && !current) return <PageLoading />;

  const chartData = historyKc.map((p, i) => ({
    date: p.date.slice(5),
    arabicaUsd: Number(p.usdPerKg.toFixed(3)),
    robustaUsd: historyRc[i]
      ? Number(historyRc[i].usdPerKg.toFixed(3))
      : historyRc.find((r) => r.date === p.date)?.usdPerKg,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            ICE Arabica (KC) and Robusta (RC) with USD/ETB conversion, grade
            differentials, and inventory / export comparisons.
          </p>
          {current?.fx ? (
            <p className="mt-1 text-xs text-muted-foreground">
              FX 1 USD = {current.fx.rate.toFixed(2)} ETB · {current.fx.source} ·{" "}
              {current.fx.rateDate}
            </p>
          ) : null}
        </div>
        {canSync ? (
          <Button onClick={() => void onSync()} disabled={syncing}>
            <RefreshCwIcon className="mr-2 size-4" />
            {syncing ? "Syncing…" : "Sync prices"}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(current?.instruments ?? []).map((inst) => (
          <Card key={inst.symbol}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{inst.name}</span>
                <Badge variant="outline">{inst.symbol}</Badge>
              </CardTitle>
              <CardDescription>
                {inst.available
                  ? `${inst.priceDate} · ${inst.source}`
                  : "No price yet — run Sync"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inst.available ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">USD / kg</p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {inst.usdPerKg?.toFixed(3)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">ETB / kg</p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {inst.etbPerKg?.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Native</p>
                      <p className="text-sm font-medium tabular-nums">
                        {inst.nativePrice?.toFixed(2)} {inst.nativeUnit}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div className="rounded-md border p-2">
                      <p className="text-xs text-muted-foreground">7d</p>
                      <p className="font-semibold tabular-nums">
                        {pctLabel(inst.change7dPercent)}
                      </p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="text-xs text-muted-foreground">30d</p>
                      <p className="font-semibold tabular-nums">
                        {pctLabel(inst.change30dPercent)}
                      </p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="text-xs text-muted-foreground">ETB / quintal</p>
                      <p className="font-semibold tabular-nums">
                        {formatMoney(String(inst.etbPerQuintal ?? 0))}
                      </p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="text-xs text-muted-foreground">USD / ton</p>
                      <p className="font-semibold tabular-nums">
                        {inst.usdPerTon?.toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Waiting for sync.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historical trend (USD/kg)</CardTitle>
          <CardDescription>Last ~60 sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="arabicaUsd"
                  name="Arabica KC"
                  stroke="#2f6f4e"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="robustaUsd"
                  name="Robusta RC"
                  stroke="#c47b3a"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade 1 Arabica (market + differential)</CardTitle>
            <CardDescription>
              Linked to ICE KC with configured grade basis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {gradeG1?.available ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Market USD/kg</p>
                  <p className="font-semibold tabular-nums">
                    {Number(gradeG1.marketUsdPerKg).toFixed(3)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Differential</p>
                  <p className="font-semibold tabular-nums">
                    {Number(gradeG1.differentialUsdPerKg).toFixed(3)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Grade USD/kg</p>
                  <p className="font-semibold tabular-nums">
                    {Number(gradeG1.usdPerKg).toFixed(3)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Grade ETB/kg</p>
                  <p className="font-semibold tabular-nums">
                    {Number(gradeG1.etbPerKg).toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Suggest export USD/kg</p>
                  <p className="font-semibold tabular-nums">
                    {Number(gradeG1.suggestExportUsdPerKg).toFixed(3)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Local ETB/kg hint</p>
                  <p className="font-semibold tabular-nums">
                    {Number(gradeG1.suggestLocalEtbPerKg).toFixed(1)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No grade price yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory at market</CardTitle>
            <CardDescription>
              Green lots valued vs book cost (ETB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {valuation ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Green kg</p>
                    <p className="font-semibold tabular-nums">
                      {formatQty(String(valuation.totalKg))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gap</p>
                    <p className="font-semibold tabular-nums">
                      {pctLabel(valuation.gapPercent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Book value</p>
                    <p className="font-semibold tabular-nums">
                      {formatMoney(String(valuation.bookValueEtb))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Market value</p>
                    <p className="font-semibold tabular-nums">
                      {formatMoney(String(valuation.marketValueEtb))}
                    </p>
                  </div>
                </div>
                {valuation.byGrade.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grade</TableHead>
                        <TableHead className="text-right">Kg</TableHead>
                        <TableHead className="text-right">Market ETB</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {valuation.byGrade.slice(0, 6).map((g) => (
                        <TableRow key={g.grade}>
                          <TableCell>{g.grade}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatQty(String(g.kg))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(String(g.marketEtb))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No valuation.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export contracts vs market</CardTitle>
          <CardDescription>
            Open contracts compared to ICE-linked grade price
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open export contracts.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Contract</TableHead>
                  <TableHead className="text-right">Market</TableHead>
                  <TableHead className="text-right">Spread</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.map((c) => (
                  <TableRow key={c.contractId}>
                    <TableCell>
                      <Link
                        href={`/exports/${c.contractId}`}
                        className="text-[var(--frappe-primary)] hover:underline"
                      >
                        {c.contractNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{c.grade ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.contractUsdPerKg.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.marketUsdPerKg.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pctLabel(c.spreadPercent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MarketPricesPage() {
  return (
    <AppShell
      title="Market prices"
      subtitle="ICE Arabica (KC) & Robusta (RC) — USD/ETB, grades, valuation"
      layout="default"
      breadcrumbs={[{ label: "Overview" }, { label: "Market prices" }]}
    >
      <PermissionGate
        permissions={[
          "market_prices.read",
          "insights.read",
          "dashboard.read",
        ]}
        fallback={
          <p className="text-muted-foreground">
            You do not have permission to view market prices.
          </p>
        }
      >
        <MarketPricesPanel />
      </PermissionGate>
    </AppShell>
  );
}
