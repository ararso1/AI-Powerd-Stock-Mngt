"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeFilterBar,
  FrappeListToolbar,
  FrappeButtonLink,
} from "@/components/frappe";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiList } from "@/lib/list-response";
import { buildCommissionsSummaryPath } from "@/lib/list-query";
import {
  firstDayOfMonthIso,
  todayIso,
} from "@/lib/sales-query";
import { formatMoney } from "@/lib/format";
import {
  commissionRowRepName,
  commissionRowSubtotal,
} from "@/lib/sale-utils";
import type { SalesCommissionSummaryRow, UserAdmin } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export default function SalesCommissionsPage() {
  const { user } = useAuth();
  const canFilterRep = hasPermission(user, "sales.on_behalf");
  const [from, setFrom] = useState(firstDayOfMonthIso);
  const [to, setTo] = useState(todayIso);
  const [soldByUserId, setSoldByUserId] = useState("");

  const { data: users } = useFetch(
    () => (canFilterRep ? apiList<UserAdmin>("/users") : Promise.resolve([])),
    [canFilterRep]
  );

  const activeUsers = useMemo(
    () => (users ?? []).filter((u) => u.isActive !== false),
    [users]
  );

  const { rows, allRows, meta, setPage, setLimit, loading } =
    usePaginatedList<SalesCommissionSummaryRow>(
      (page, limit) =>
        buildCommissionsSummaryPath(
          {
            from,
            to,
            soldByUserId: soldByUserId || undefined,
          },
          page,
          limit
        ),
      [from, to, soldByUserId]
    );

  const totals = useMemo(() => {
    let sales = 0;
    let commission = 0;
    let count = 0;
    for (const r of allRows) {
      count += r.saleCount;
      sales += parseFloat(commissionRowSubtotal(r)) || 0;
      commission += parseFloat(r.totalCommission) || 0;
    }
    return { count, sales, commission };
  }, [allRows]);

  return (
    <AppShell
      title="Sales commissions"
      subtitle="Per-rep totals for active (non-voided) sales"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Sales Invoice", href: "/sales" },
        { label: "Commissions" },
      ]}
      actions={
        <FrappeButtonLink href="/sales">← Sales list</FrappeButtonLink>
      }
    >
      <PermissionGate permission="sales.read">
        <FrappeFilterBar className="items-end">
          <div className="grid gap-2">
            <Label htmlFor="comm-from">From</Label>
            <Input
              id="comm-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="comm-to">To</Label>
            <Input
              id="comm-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-[160px]"
            />
          </div>
          {canFilterRep ? (
            <div className="grid gap-2">
              <Label>Sales rep</Label>
              <Select
                value={soldByUserId || "__all__"}
                onValueChange={(v) =>
                  setSoldByUserId(v === "__all__" ? "" : v)
                }
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All reps" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All reps</SelectItem>
                  {activeUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </FrappeFilterBar>

        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Sales count</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {totals.count}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total subtotal</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatMoney(totals.sales)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total commission</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatMoney(totals.commission)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <FrappeListToolbar>
          <span className="text-[var(--frappe-text-muted)]">
            {meta.total} rep{meta.total === 1 ? "" : "s"}
          </span>
        </FrappeListToolbar>

        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows.map((r) => ({ ...r, id: r.soldByUserId }))}
            emptyTitle="No commission data"
            emptyDescription="No sales in this date range for the selected filters."
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={[
              {
                key: "rep",
                header: "Sales rep",
                cell: (r) => commissionRowRepName(r),
              },
              {
                key: "count",
                header: "Sales",
                className: "text-right tabular-nums",
                cell: (r) => r.saleCount,
              },
              {
                key: "sales",
                header: "Subtotal",
                className: "text-right tabular-nums",
                cell: (r) => formatMoney(commissionRowSubtotal(r)),
              },
              {
                key: "commission",
                header: "Commission",
                className: "text-right tabular-nums",
                cell: (r) => formatMoney(r.totalCommission),
              },
              {
                key: "view",
                header: "",
                cell: (r) => (
                  <Link
                    href={`/sales?soldByUserId=${r.soldByUserId}&from=${from}&to=${to}`}
                    className="text-sm text-[var(--frappe-primary)] hover:underline"
                  >
                    View sales
                  </Link>
                ),
              },
            ]}
          />
        )}
      </PermissionGate>
    </AppShell>
  );
}
