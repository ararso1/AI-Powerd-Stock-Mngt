"use client";

import { useState } from "react";
import Link from "next/link";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { FrappeFilterBar, FrappeListToolbar } from "@/components/frappe";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { buildListPath } from "@/lib/list-query";
import { formatDate, formatQty } from "@/lib/format";
import type {
  PurchaseType,
  StockMovement,
  StockMovementDirection,
  StockMovementSourceType,
} from "@/lib/types";
import { useLocations } from "@/hooks/use-locations";
import { usePaginatedList } from "@/hooks/use-paginated-list";

const ALL = "__all__";

const SOURCE_OPTIONS: { value: StockMovementSourceType; label: string }[] = [
  { value: "COLLECTION", label: "Collection / purchase" },
  { value: "PRODUCTION_OUTPUT", label: "Production output" },
  { value: "PRODUCTION_CONSUMPTION", label: "Production consumption" },
  { value: "PRODUCTION_LOSS", label: "Production loss" },
  { value: "TRANSFER_IN", label: "Transfer in" },
  { value: "TRANSFER_OUT", label: "Transfer out" },
  { value: "SALE_LOCAL", label: "Local sale" },
  { value: "SALE_EXPORT", label: "Export sale" },
  { value: "SALE_RETURN", label: "Sale return" },
  { value: "EXPORT_SHIPMENT", label: "Export shipment" },
  { value: "REJECTION", label: "Rejection" },
  { value: "DAMAGE", label: "Damage" },
  { value: "WASTAGE", label: "Wastage" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "OTHER", label: "Other" },
];

export function InventoryMovementsPanel() {
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState(ALL);
  const [direction, setDirection] = useState<StockMovementDirection | "">(
    ""
  );
  const [sourceType, setSourceType] = useState<StockMovementSourceType | "">(
    ""
  );
  const [purchaseType, setPurchaseType] = useState<PurchaseType | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data: locations } = useLocations();

  const { rows, meta, setPage, setLimit, loading } =
    usePaginatedList<StockMovement>(
      (page, limit) =>
        buildListPath("/inventory/movements", {
          params: {
            search: debouncedSearch || undefined,
            locationId: locationId === ALL ? undefined : locationId,
            direction: direction || undefined,
            sourceType: sourceType || undefined,
            purchaseType: purchaseType || undefined,
            from: from || undefined,
            to: to || undefined,
          },
          page,
          limit,
        }),
      [debouncedSearch, locationId, direction, sourceType, purchaseType, from, to]
    );

  return (
    <div className="space-y-3">
      <FrappeFilterBar>
        <ListSearchField
          value={search}
          onChange={setSearch}
          placeholder="Search product, batch, reference…"
        />
        <div className="grid gap-2">
          <Label className="text-sm text-[var(--frappe-text-muted)]">
            Location
          </Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-[200px]">
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
        <div className="grid gap-2">
          <Label className="text-sm text-[var(--frappe-text-muted)]">
            Direction
          </Label>
          <Select
            value={direction || ALL}
            onValueChange={(v) =>
              setDirection(v === ALL ? "" : (v as StockMovementDirection))
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              <SelectItem value="IN">Stock IN</SelectItem>
              <SelectItem value="OUT">Stock OUT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-sm text-[var(--frappe-text-muted)]">
            Source
          </Label>
          <Select
            value={sourceType || ALL}
            onValueChange={(v) =>
              setSourceType(v === ALL ? "" : (v as StockMovementSourceType))
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              {SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-sm text-[var(--frappe-text-muted)]">
            Purchase type
          </Label>
          <Select
            value={purchaseType || ALL}
            onValueChange={(v) =>
              setPurchaseType(v === ALL ? "" : (v as PurchaseType))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              <SelectItem value="LOCAL">Local market</SelectItem>
              <SelectItem value="EXPORT">Export</SelectItem>
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
          {meta.total} movement{meta.total === 1 ? "" : "s"}
        </span>
      </FrappeListToolbar>
      {loading ? (
        <PageLoading />
      ) : (
        <DataCardTable
          rows={rows}
          emptyTitle="No stock movements yet"
          emptyDescription="Movements appear when you collect, process, transfer, sell, return, or adjust stock."
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
              cell: (r) => formatDate(r.movedAt),
            },
            {
              key: "dir",
              header: "Dir",
              cell: (r) => (
                <Badge variant={r.direction === "IN" ? "outline" : "secondary"}>
                  {r.direction}
                </Badge>
              ),
            },
            {
              key: "product",
              header: "Product",
              cell: (r) => r.item?.description ?? r.item?.sku ?? "—",
            },
            {
              key: "grade",
              header: "Grade",
              cell: (r) => r.grade ?? r.lot?.grade ?? "—",
            },
            {
              key: "batch",
              header: "Batch",
              cell: (r) =>
                r.lotId ? (
                  <Link
                    href={`/lots/${r.lotId}`}
                    className="text-[var(--frappe-primary)] hover:underline"
                  >
                    {r.batchCode ?? r.lot?.code ?? "—"}
                  </Link>
                ) : (
                  (r.batchCode ?? "—")
                ),
            },
            {
              key: "qty",
              header: "Qty",
              cell: (r) => formatQty(r.quantity),
            },
            {
              key: "location",
              header: "Location",
              cell: (r) => r.location?.name ?? "—",
            },
            {
              key: "user",
              header: "User",
              cell: (r) => r.createdBy?.fullName ?? "—",
            },
            {
              key: "ref",
              header: "Reference",
              cell: (r) => r.reference ?? r.sourceType.replaceAll("_", " "),
            },
          ]}
        />
      )}
    </div>
  );
}
