"use client";

import { useState } from "react";
import { DataCardTable } from "@/components/shared/data-card-table";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { PageLoading } from "@/components/shared/page-loading";
import { FrappeFilterBar, FrappeListToolbar } from "@/components/frappe";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { useLocations } from "@/hooks/use-locations";
import {
  STOCK_ADJUSTMENT_REASON_OPTIONS,
  stockAdjustmentReasonLabel,
} from "@/lib/inventory-adjustments";
import { buildInventoryAdjustmentsListPath } from "@/lib/list-query";
import { formatDate, formatQty } from "@/lib/format";
import type {
  StockAdjustment,
  StockAdjustmentDirection,
  StockAdjustmentReason,
} from "@/lib/types";

const ALL = "__all__";

export function InventoryAdjustmentsPanel() {
  const [locationId, setLocationId] = useState(ALL);
  const [direction, setDirection] = useState<StockAdjustmentDirection | "">(
    ""
  );
  const [reason, setReason] = useState<StockAdjustmentReason | "">("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data: locations } = useLocations();

  const { rows, meta, setPage, setLimit, loading } =
    usePaginatedList<StockAdjustment>(
      (page, limit) =>
        buildInventoryAdjustmentsListPath(
          {
            locationId: locationId === ALL ? undefined : locationId,
            direction: direction || undefined,
            reason: reason || undefined,
            search: debouncedSearch || undefined,
            from: from || undefined,
            to: to || undefined,
          },
          page,
          limit
        ),
      [locationId, direction, reason, debouncedSearch, from, to]
    );

  return (
    <div className="space-y-3">
      <FrappeFilterBar>
        <div className="grid gap-2">
          <Label className="text-sm text-[var(--frappe-text-muted)]">
            Location
          </Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="h-9 w-full min-w-[200px] border-[var(--frappe-border)] bg-[var(--frappe-surface)] sm:w-[240px]">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All locations</SelectItem>
              {(locations ?? []).map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name} ({loc.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-sm text-[var(--frappe-text-muted)]">
            Direction
          </Label>
          <Select
            value={direction || ALL}
            onValueChange={(v) =>
              setDirection(v === ALL ? "" : (v as StockAdjustmentDirection))
            }
          >
            <SelectTrigger className="h-9 w-[140px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              <SelectItem value="in">In</SelectItem>
              <SelectItem value="out">Out</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-sm text-[var(--frappe-text-muted)]">
            Reason
          </Label>
          <Select
            value={reason || ALL}
            onValueChange={(v) =>
              setReason(v === ALL ? "" : (v as StockAdjustmentReason))
            }
          >
            <SelectTrigger className="h-9 w-[180px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
              <SelectValue placeholder="All reasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All reasons</SelectItem>
              {STOCK_ADJUSTMENT_REASON_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ListSearchField
          value={search}
          onChange={setSearch}
          placeholder="Search notes or reference…"
        />
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />
      </FrappeFilterBar>
      <FrappeListToolbar>
        <span className="text-[var(--frappe-text-muted)]">
          {meta.total} adjustment{meta.total === 1 ? "" : "s"}
        </span>
      </FrappeListToolbar>
      {loading ? (
        <PageLoading />
      ) : (
        <DataCardTable
          rows={rows}
          emptyTitle="No adjustments"
          emptyDescription="Post an adjustment from a stock row to change quantity with an audit trail."
          pagination={{
            meta,
            onPageChange: setPage,
            onLimitChange: setLimit,
            disabled: loading,
          }}
          columns={[
            {
              key: "date",
              header: "Date",
              cell: (r) => formatDate(r.createdAt),
            },
            {
              key: "item",
              header: "Item",
              cell: (r) =>
                r.item?.description ??
                (r.itemId ? `${r.itemId.slice(0, 8)}…` : "—"),
            },
            {
              key: "location",
              header: "Location",
              cell: (r) => r.location?.name ?? "—",
            },
            {
              key: "direction",
              header: "Direction",
              cell: (r) => (
                <Badge variant={r.direction === "in" ? "outline" : "secondary"}>
                  {r.direction === "in" ? "In" : "Out"}
                </Badge>
              ),
            },
            {
              key: "qty",
              header: "Qty",
              className: "text-right tabular-nums",
              cell: (r) =>
                `${r.direction === "out" ? "−" : "+"}${formatQty(r.quantity)}`,
            },
            {
              key: "before",
              header: "Before",
              className: "text-right tabular-nums",
              cell: (r) => formatQty(r.quantityBefore),
            },
            {
              key: "after",
              header: "After",
              className: "text-right tabular-nums",
              cell: (r) => formatQty(r.quantityAfter),
            },
            {
              key: "reason",
              header: "Reason",
              cell: (r) => stockAdjustmentReasonLabel(r.reason),
            },
            {
              key: "ref",
              header: "Reference",
              cell: (r) => r.reference || "—",
            },
            {
              key: "notes",
              header: "Notes",
              cell: (r) => r.notes || "—",
            },
            {
              key: "by",
              header: "By",
              cell: (r) => r.createdBy?.fullName ?? "—",
            },
          ]}
        />
      )}
    </div>
  );
}
