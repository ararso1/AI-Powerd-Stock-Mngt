"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeFilterBar,
  FrappeListToolbar,
  FrappeButtonPrimary,
} from "@/components/frappe";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatMoney, formatDate } from "@/lib/format";
import { documentTotal } from "@/lib/document-utils";
import { buildPurchasesListPath } from "@/lib/list-query";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PlusIcon } from "lucide-react";

import type { Purchase, PurchaseListTotals } from "@/lib/types";
import { ListPageTotals } from "@/components/shared/list-page-totals";

type PurchaseRow = Pick<
  Purchase,
  | "id"
  | "paymentMethod"
  | "total"
  | "subtotal"
  | "totalAmount"
  | "createdAt"
  | "supplier"
  | "location"
  | "status"
>;

export default function PurchasesPage() {
  const [search, setSearch] = useState("");
  const [includeVoided, setIncludeVoided] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { rows, meta, totals, setPage, setLimit, loading } = usePaginatedList<
    PurchaseRow,
    PurchaseListTotals
  >(
    (page, limit) =>
      buildPurchasesListPath(
        {
          from: from || undefined,
          to: to || undefined,
          includeVoided,
          search: debouncedSearch || undefined,
        },
        page,
        limit
      ),
    [from, to, includeVoided, debouncedSearch]
  );

  return (
    <AppShell
      title="Purchase"
      subtitle="List of all purchase transactions"
      breadcrumbs={[{ label: "Stock", href: "/dashboard" }, { label: "Purchase" }]}
      actions={
        <PermissionGate permission="purchase.write">
          <FrappeButtonPrimary asChild>
            <Link href="/purchases/new">
              <PlusIcon className="size-3.5" />
              Add Purchase
            </Link>
          </FrappeButtonPrimary>
        </PermissionGate>
      }
    >
      <PermissionGate permission="purchase.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search purchases..."
          />
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
          <div className="flex items-center gap-2">
            <Switch
              id="purchase-include-voided"
              checked={includeVoided}
              onCheckedChange={setIncludeVoided}
            />
            <Label
              htmlFor="purchase-include-voided"
              className="text-sm font-normal text-[var(--frappe-text)]"
            >
              Include voided
            </Label>
          </div>
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
            emptyDescription="Create your first purchase to receive stock."
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
                    href={`/purchases/${r.id}`}
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
                key: "supplier",
                header: "Supplier",
                cell: (r) =>
                  r.supplier?.name ? (
                    <Link
                      href={`/purchases/${r.id}`}
                      className="hover:text-[var(--frappe-primary)] hover:underline"
                    >
                      {r.supplier.name}
                    </Link>
                  ) : (
                    "—"
                  ),
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
