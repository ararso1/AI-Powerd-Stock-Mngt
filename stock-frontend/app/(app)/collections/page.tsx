"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { ListPageTotals } from "@/components/shared/list-page-totals";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeButtonPrimary,
  FrappeFilterBar,
  FrappeListToolbar,
} from "@/components/frappe";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildCollectionsListPath } from "@/lib/list-query";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import type {
  CollectionListTotals,
  CollectionTicket,
} from "@/lib/types";
import { useLocations } from "@/hooks/use-locations";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { PlusIcon } from "lucide-react";

const ALL = "__all__";

export default function CollectionsPage() {
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data: locations } = useLocations();

  const { rows, meta, totals, setPage, setLimit, loading } =
    usePaginatedList<CollectionTicket, CollectionListTotals>(
      (page, limit) =>
        buildCollectionsListPath(
          {
            search: debouncedSearch || undefined,
            locationId: locationId === ALL ? undefined : locationId,
            from: from || undefined,
            to: to || undefined,
          },
          page,
          limit
        ),
      [debouncedSearch, locationId, from, to]
    );

  return (
    <AppShell
      title="Collection"
      subtitle="Cherry intake from farmers — creates lot, purchase, and stock"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Collection" },
      ]}
      actions={
        <PermissionGate permission="collection.write">
          <FrappeButtonPrimary asChild>
            <Link href="/collections/new">
              <PlusIcon className="size-3.5" />
              New intake
            </Link>
          </FrappeButtonPrimary>
        </PermissionGate>
      }
    >
      <PermissionGate permission="collection.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search ticket, farmer, grade…"
          />
          <div className="grid gap-2">
            <Label className="text-sm text-[var(--frappe-text-muted)]">
              Location
            </Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All locations</SelectItem>
                {(locations ?? []).map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
        </FrappeFilterBar>
        <FrappeListToolbar>
          <span className="text-[var(--frappe-text-muted)]">
            {meta.total} ticket{meta.total === 1 ? "" : "s"}
          </span>
          {totals ? (
            <ListPageTotals
              items={[
                { label: "Weight", value: `${formatQty(totals.weightKg)} kg` },
                { label: "Total", value: formatMoney(totals.totalAmount) },
              ]}
            />
          ) : null}
        </FrappeListToolbar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="No collections yet"
            emptyDescription="Record cherry intake to open a lot and update stock."
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={[
              {
                key: "ticket",
                header: "Ticket",
                cell: (r) => (
                  <Link
                    href={`/collections/${r.id}`}
                    className="font-medium text-[var(--frappe-primary)] hover:underline"
                  >
                    {r.ticketNumber}
                  </Link>
                ),
              },
              {
                key: "farmer",
                header: "Farmer",
                cell: (r) => r.supplier?.name ?? "—",
              },
              {
                key: "weight",
                header: "Weight",
                cell: (r) => `${formatQty(r.weightKg)} kg`,
              },
              {
                key: "grade",
                header: "Grade",
                cell: (r) => r.grade ?? "—",
              },
              {
                key: "total",
                header: "Total",
                cell: (r) => formatMoney(r.totalAmount),
              },
              {
                key: "lot",
                header: "Lot",
                cell: (r) =>
                  r.lot ? (
                    <Link
                      href={`/lots/${r.lotId}`}
                      className="text-[var(--frappe-primary)] hover:underline"
                    >
                      {r.lot.code}
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "pay",
                header: "Pay",
                cell: (r) => (
                  <Badge variant="outline">{r.paymentMethod}</Badge>
                ),
              },
              {
                key: "date",
                header: "Date",
                cell: (r) => formatDate(r.createdAt),
              },
            ]}
          />
        )}
      </PermissionGate>
    </AppShell>
  );
}
