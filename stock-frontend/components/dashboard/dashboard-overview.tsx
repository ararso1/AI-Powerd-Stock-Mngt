"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
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
import { formatMoney, errorMessage } from "@/lib/format";
import { buildListPath } from "@/lib/list-query";
import type { DashboardData } from "@/lib/types";
import { toast } from "sonner";
import {
  TrendingUpIcon,
  PackageIcon,
  ArrowDownIcon,
  ArrowUpIcon,
} from "lucide-react";

export function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api<DashboardData>(
          buildListPath("/dashboard", {
            params: {
              from: from || undefined,
              to: to || undefined,
            },
          })
        );
        applyCurrencyFromResponse(res);
        setData(res);
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to]);

  if (loading && !data) return <PageLoading />;
  if (!data) return null;

  const { profitAndLoss: pnl, financialOverview: fin } = data;

  return (
    <div className="flex flex-col gap-6">
      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
      />
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total inventory value</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(data.totalInventoryValue)}
            </CardTitle>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            <PackageIcon className="mr-2 size-4" />
            Across all locations
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Daily sales</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(data.dailySales)}
            </CardTitle>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            <ArrowUpIcon className="mr-2 size-4 text-emerald-600" />
            Today
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Daily purchases</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(data.dailyPurchases)}
            </CardTitle>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            <ArrowDownIcon className="mr-2 size-4 text-amber-600" />
            Today
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Net profit</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(pnl.netProfit)}
            </CardTitle>
            <Badge variant="outline" className="mt-2 w-fit">
              <TrendingUpIcon />
              P&amp;L summary
            </Badge>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            Gross: {formatMoney(pnl.grossProfit)}
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stock by location</CardTitle>
            <CardDescription>
              {data.showroomCount} showroom
              {data.showroomCount === 1 ? "" : "s"} tracked
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

        <Card>
          <CardHeader>
            <CardTitle>Financial overview</CardTitle>
            <CardDescription>
              Total liquidity:{" "}
              {formatMoney(
                fin.totalLiquidity ?? fin.totalBankBalance
              )}
              {fin.cashTotal != null && fin.bankTotal != null ? (
                <>
                  {" "}
                  · Cash {formatMoney(fin.cashTotal)} · Bank{" "}
                  {formatMoney(fin.bankTotal)}
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
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
                    <Badge variant="outline">
                      {acc.accountType ?? "BANK"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(acc.balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profit &amp; loss</CardTitle>
        </CardHeader>
        <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Revenue", pnl.revenue],
            ["COGS", pnl.costOfGoodsSold],
            ["Gross profit", pnl.grossProfit],
            ["Expenses", pnl.totalExpenses],
            ["Net profit", pnl.netProfit],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {formatMoney(value as string)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
