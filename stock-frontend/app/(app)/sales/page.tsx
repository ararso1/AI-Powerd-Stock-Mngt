"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeFilterBar,
  FrappeListToolbar,
  FrappeButtonPrimary,
  FrappeButtonLink,
} from "@/components/frappe";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { formatMoney, formatDate } from "@/lib/format";
import { documentTotal } from "@/lib/document-utils";
import { formatCommissionRate, saleRepName } from "@/lib/sale-utils";
import { buildSalesListPath } from "@/lib/list-query";
import { apiList } from "@/lib/list-response";
import type { Sale, SaleChannel, SaleListTotals, UserAdmin } from "@/lib/types";
import { ListPageTotals } from "@/components/shared/list-page-totals";
import { useFetch } from "@/hooks/use-fetch";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PlusIcon } from "lucide-react";

type SaleRow = Pick<
  Sale,
  | "id"
  | "paymentMethod"
  | "channel"
  | "total"
  | "subtotal"
  | "totalAmount"
  | "createdAt"
  | "customer"
  | "location"
  | "status"
  | "soldByUser"
  | "soldBy"
  | "commissionPercent"
  | "commissionBasis"
  | "commissionAmount"
>;

const ALL = "__all__";

export default function SalesPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const canOnBehalf = hasPermission(user, "sales.on_behalf");

  const initialSoldBy = searchParams.get("soldByUserId") ?? "";
  const initialFrom = searchParams.get("from") ?? "";
  const initialTo = searchParams.get("to") ?? "";
  const initialChannel = (searchParams.get("channel") as SaleChannel | null) ?? "";
  const [includeVoided, setIncludeVoided] = useState(false);
  const [soldByUserId, setSoldByUserId] = useState(initialSoldBy);
  const [channel, setChannel] = useState<SaleChannel | "">(initialChannel);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const { data: users } = useFetch(
    () => (canOnBehalf ? apiList<UserAdmin>("/users") : Promise.resolve([])),
    [canOnBehalf]
  );

  const activeUsers = useMemo(
    () => (users ?? []).filter((u) => u.isActive !== false),
    [users]
  );

  const { rows, meta, totals, setPage, setLimit, loading } = usePaginatedList<
    SaleRow,
    SaleListTotals
  >(
    (page, limit) =>
      buildSalesListPath(
        {
          from: from || undefined,
          to: to || undefined,
          includeVoided,
          soldByUserId: soldByUserId || undefined,
          channel: channel || undefined,
          search: debouncedSearch || undefined,
        },
        page,
        limit
      ),
    [from, to, includeVoided, soldByUserId, channel, debouncedSearch]
  );

  return (
    <AppShell
      title="Sales Invoice"
      subtitle="List of sales transactions"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Sales Invoice" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <PermissionGate permission="sales.read">
            <FrappeButtonLink href="/sales/commissions">Commissions</FrappeButtonLink>
          </PermissionGate>
          <PermissionGate permission="sales.write">
            <FrappeButtonPrimary asChild>
              <Link href="/sales/new">
                <PlusIcon className="size-3.5" />
                Add Sale
              </Link>
            </FrappeButtonPrimary>
          </PermissionGate>
        </div>
      }
    >
      <PermissionGate permission="sales.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search sales..."
            className="max-w-sm"
          />
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
          <Select
            value={channel || ALL}
            onValueChange={(v) =>
              setChannel(v === ALL ? "" : (v as SaleChannel))
            }
          >
            <SelectTrigger className="w-[160px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All channels</SelectItem>
              <SelectItem value="LOCAL">Local</SelectItem>
              <SelectItem value="EXPORT">Export</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch
              id="include-voided"
              checked={includeVoided}
              onCheckedChange={setIncludeVoided}
            />
            <Label
              htmlFor="include-voided"
              className="text-sm font-normal text-[var(--frappe-text)]"
            >
              Include voided
            </Label>
          </div>
          {canOnBehalf ? (
            <div className="flex items-center gap-2">
              <Label className="text-sm text-[var(--frappe-text-muted)]">
                Sales rep
              </Label>
              <Select
                value={soldByUserId || "__all__"}
                onValueChange={(v) =>
                  setSoldByUserId(v === "__all__" ? "" : v)
                }
              >
                <SelectTrigger className="w-[200px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
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

        <FrappeListToolbar>
          <span className="text-[var(--frappe-text-muted)]">
            {meta.total} record{meta.total === 1 ? "" : "s"}
          </span>
          {totals ? (
            <ListPageTotals
              items={[
                { label: "Subtotal", value: formatMoney(totals.subtotal) },
                { label: "Total", value: formatMoney(totals.total) },
                { label: "Commission", value: formatMoney(totals.commission) },
              ]}
            />
          ) : null}
        </FrappeListToolbar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="Nothing to show"
            emptyDescription="Create your first sale invoice."
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={[
              {
                key: "id",
                header: "ID",
                cell: (r) => (
                  <Link
                    href={`/sales/${r.id}`}
                    className="font-medium text-[var(--frappe-primary)] hover:underline"
                  >
                    {r.id.slice(0, 8)}…
                  </Link>
                ),
              },
              {
                key: "date",
                header: "Date",
                cell: (r) => formatDate(r.createdAt),
              },
              {
                key: "channel",
                header: "Channel",
                cell: (r) => r.channel ?? "LOCAL",
              },
              {
                key: "customer",
                header: "Customer",
                cell: (r) =>
                  r.customer?.name ? (
                    <Link
                      href={`/sales/${r.id}`}
                      className="hover:text-[var(--frappe-primary)] hover:underline"
                    >
                      {r.customer.name}
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "soldBy",
                header: "Sales rep",
                cell: (r) => saleRepName(r) ?? "—",
              },
              {
                key: "location",
                header: "Location",
                cell: (r) => r.location?.name ?? "—",
              },
              {
                key: "payment",
                header: "Payment",
                cell: (r) => r.paymentMethod,
              },
              {
                key: "status",
                header: "Status",
                cell: (r) =>
                  r.status === "VOIDED" ? (
                    <Badge variant="secondary">Voided</Badge>
                  ) : (
                    "Posted"
                  ),
              },
              {
                key: "commission",
                header: "Commission",
                className: "text-right tabular-nums",
                cell: (r) =>
                  r.commissionAmount
                    ? formatMoney(r.commissionAmount)
                    : formatCommissionRate(
                        r.commissionPercent,
                        r.commissionBasis
                      ) ?? "—",
              },
              {
                key: "total",
                header: "Amount",
                className: "text-right",
                cell: (r) => formatMoney(documentTotal(r)),
              },
            ]}
          />
        )}
      </PermissionGate>
    </AppShell>
  );
}
