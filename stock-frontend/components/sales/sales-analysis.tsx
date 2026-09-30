"use client";

import { useMemo, useState } from "react";
import { GroupedBarChart } from "@/components/dashboard/dashboard-shared";
import { FrappeFilterBar } from "@/components/frappe";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { PageLoading } from "@/components/shared/page-loading";
import { SearchSelect } from "@/components/shared/search-select";
import { useFetch } from "@/hooks/use-fetch";
import { api } from "@/lib/api";
import { formatMoney, formatQty } from "@/lib/format";
import { fetchCustomers, formatPartyLabel } from "@/lib/party-fetch";
import type { SaleChannel } from "@/lib/types";

type PaymentFilter = "" | "CASH" | "BANK" | "CREDIT" | "PARTIAL" | "OUTSTANDING";

type SalesAnalysisData = {
  saleCount: number;
  totalAmount: number;
  totalQuantityKg: number;
  returnsAmount: number;
  netAmount: number;
  outstandingAmount: number;
  outstandingCount: number;
  trendBucket: "day" | "month";
  byCoffee: Array<{
    type: string;
    label: string;
    quantityKg: number;
    amount: number;
  }>;
  trend: Array<{
    label: string;
    amount: number;
    quantityKg: number;
    roastAmount: number;
    groundAmount: number;
    roastKg: number;
    groundKg: number;
  }>;
};

const ALL = "__all__";

function analysisPath(filters: {
  from: string;
  to: string;
  channel: SaleChannel | "";
  customerId: string;
  paymentStatus: PaymentFilter;
}) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.customerId) params.set("customerId", filters.customerId);
  if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
  const query = params.toString();
  return `/sales/analysis${query ? `?${query}` : ""}`;
}

export function SalesAnalysis() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [channel, setChannel] = useState<SaleChannel | "">("");
  const [customerId, setCustomerId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentFilter>("");

  const { data: customers } = useFetch(() => fetchCustomers(), []);
  const path = analysisPath({ from, to, channel, customerId, paymentStatus });
  const { data, loading } = useFetch(
    () => api<SalesAnalysisData>(path),
    [path]
  );

  const customerOptions = useMemo(
    () => [
      { value: "", label: "All customers" },
      ...(customers ?? []).map((customer) => ({
        value: customer.id,
        label: formatPartyLabel(customer),
      })),
    ],
    [customers]
  );

  const coffeeChart = (data?.byCoffee ?? [])
    .filter((row) => row.amount > 0 || row.quantityKg > 0)
    .map((row) => ({ label: row.label, amount: row.amount }));

  return (
    <div className="flex flex-col gap-4">
      <FrappeFilterBar>
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />
        <div className="grid gap-2">
          <Label className="text-sm text-[var(--frappe-text-muted)]">
            Sales type
          </Label>
          <Select
            value={channel || ALL}
            onValueChange={(value) =>
              setChannel(value === ALL ? "" : (value as SaleChannel))
            }
          >
            <SelectTrigger className="w-[160px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
              <SelectValue placeholder="Sales type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sales types</SelectItem>
              <SelectItem value="LOCAL">Local</SelectItem>
              <SelectItem value="EXPORT">Export</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-[220px] gap-2">
          <Label className="text-sm text-[var(--frappe-text-muted)]">
            Customer
          </Label>
          <SearchSelect
            value={customerId}
            onValueChange={setCustomerId}
            options={customerOptions}
            placeholder="All customers"
            searchPlaceholder="Search customers…"
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-sm text-[var(--frappe-text-muted)]">
            Payment status
          </Label>
          <Select
            value={paymentStatus || ALL}
            onValueChange={(value) =>
              setPaymentStatus(value === ALL ? "" : (value as PaymentFilter))
            }
          >
            <SelectTrigger className="w-[180px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
              <SelectValue placeholder="Payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="BANK">Bank transfer</SelectItem>
              <SelectItem value="CREDIT">Credit</SelectItem>
              <SelectItem value="PARTIAL">Partially paid</SelectItem>
              <SelectItem value="OUTSTANDING">Outstanding</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FrappeFilterBar>

      <p className="text-sm text-[var(--frappe-text-muted)]">
        Totals, coffee breakdown, and charts use posted sales that match these
        filters.
      </p>

      {loading ? (
        <PageLoading />
      ) : !data ? (
        <p className="text-sm text-[var(--frappe-text-muted)]">
          Sales analysis could not be loaded.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Total sales</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoney(data.totalAmount)}
                </CardTitle>
                <p className="text-xs text-[var(--frappe-text-muted)]">
                  {data.saleCount} invoice{data.saleCount === 1 ? "" : "s"}
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Quantity sold</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatQty(data.totalQuantityKg)} kg
                </CardTitle>
                <p className="text-xs text-[var(--frappe-text-muted)]">
                  Coffee weight, with packs converted to kg
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Outstanding / credit</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoney(data.outstandingAmount)}
                </CardTitle>
                <p className="text-xs text-[var(--frappe-text-muted)]">
                  {data.outstandingCount} open credit sale
                  {data.outstandingCount === 1 ? "" : "s"}
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Net sales</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoney(data.netAmount)}
                </CardTitle>
                <p className="text-xs text-[var(--frappe-text-muted)]">
                  Returns {formatMoney(data.returnsAmount)}
                </p>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-visible">
              <CardHeader>
                <CardDescription>Amount by coffee type</CardDescription>
              </CardHeader>
              <div className="px-4 pb-4">
                <GroupedBarChart
                  data={coffeeChart}
                  series={[
                    { key: "amount", name: "Amount", color: "#2f6f4e" },
                  ]}
                  emptyMessage="No sales in this period."
                  margin={{ top: 12, right: 8, left: 8, bottom: 0 }}
                />
              </div>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Quantity and amount by coffee type</CardDescription>
              </CardHeader>
              <div className="overflow-x-auto px-4 pb-4">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--frappe-border)] text-left text-[var(--frappe-text-muted)]">
                      <th className="py-2 font-medium">Coffee</th>
                      <th className="py-2 text-right font-medium">Quantity</th>
                      <th className="py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCoffee.map((row) => (
                      <tr
                        key={row.type}
                        className="border-b border-[var(--frappe-border)] last:border-0"
                      >
                        <td className="py-2">{row.label}</td>
                        <td className="py-2 text-right tabular-nums">
                          {formatQty(row.quantityKg)} kg
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatMoney(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-visible">
              <CardHeader>
                <CardDescription>Sales amount over time</CardDescription>
                <CardTitle className="text-base font-medium">
                  {data.trendBucket === "day" ? "Daily" : "Monthly"}
                </CardTitle>
              </CardHeader>
              <div className="px-4 pb-4">
                <GroupedBarChart
                  data={data.trend}
                  series={[
                    {
                      key: "amount",
                      name: "Sales amount",
                      color: "#2f6f4e",
                    },
                  ]}
                  emptyMessage="No sales in this period."
                  margin={{ top: 12, right: 8, left: 8, bottom: 0 }}
                />
              </div>
            </Card>
            <Card className="overflow-visible">
              <CardHeader>
                <CardDescription>
                  Roast and ground quantity over time
                </CardDescription>
                <CardTitle className="text-base font-medium">
                  {data.trendBucket === "day" ? "Daily" : "Monthly"}
                </CardTitle>
              </CardHeader>
              <div className="px-4 pb-4">
                <GroupedBarChart
                  data={data.trend}
                  series={[
                    { key: "roastKg", name: "Roast kg", color: "#2f6f4e" },
                    { key: "groundKg", name: "Ground kg", color: "#c47b3a" },
                  ]}
                  emptyMessage="No roast or ground sales in this period."
                  margin={{ top: 12, right: 8, left: 8, bottom: 0 }}
                />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
