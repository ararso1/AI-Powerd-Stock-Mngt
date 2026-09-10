"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { EntitySelectField } from "@/components/shared/entity-select-field";
import { ItemSearchSelect } from "@/components/shared/item-search-select";
import { QuickLocationDialog } from "@/components/locations/quick-location-dialog";
import { QuickStockItemDialog } from "@/components/inventory/quick-stock-item-dialog";
import {
  FrappeButtonPrimary,
  FrappeField,
  FrappeFilterBar,
  FrappeFormGrid,
} from "@/components/frappe";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { fetchInventoryForLocation } from "@/lib/inventory-fetch";
import { buildStockTransfersListPath } from "@/lib/list-query";
import { errorMessage } from "@/lib/format";
import { requestNotificationsRefresh } from "@/lib/notification-events";
import {
  isCoffeeSku,
  parseTransferLines,
  stockTransferOptions,
} from "@/lib/inventory-items";
import type { Location, StockRecord, TransferStatus } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";

interface TransferRow {
  id: string;
  status: string;
  fromLocation?: { name: string };
  toLocation?: { name: string };
  createdAt?: string;
}

export default function StockTransfersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TransferStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const { rows, meta, setPage, setLimit, loading, reload } =
    usePaginatedList<TransferRow>(
      (page, limit) =>
        buildStockTransfersListPath(
          {
            from: from || undefined,
            to: to || undefined,
            search: debouncedSearch || undefined,
            status: status || undefined,
          },
          page,
          limit
        ),
      [from, to, debouncedSearch, status]
    );

  return (
    <AppShell
      title="Stock Transfers"
      actions={
        <PermissionGate permission="stock_transfer.write">
          <TransferDialog onSuccess={reload} />
        </PermissionGate>
      }
    >
      <PermissionGate permission="stock_transfer.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search transfers..."
          />
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
          <Select
            value={status || "__all__"}
            onValueChange={(v) =>
              setStatus(v === "__all__" ? "" : (v as TransferStatus))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </FrappeFilterBar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="No transfers"
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
                    href={`/stock-transfers/${r.id}`}
                    className="font-medium text-[var(--frappe-primary)] hover:underline"
                  >
                    {r.id.slice(0, 8)}…
                  </Link>
                ),
              },
              {
                key: "from",
                header: "From",
                cell: (r) => r.fromLocation?.name ?? "—",
              },
              {
                key: "to",
                header: "To",
                cell: (r) => r.toLocation?.name ?? "—",
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => <Badge variant="outline">{r.status}</Badge>,
              },
              {
                key: "date",
                header: "Date",
                cell: (r) =>
                  r.createdAt
                    ? new Date(r.createdAt).toLocaleDateString()
                    : "—",
              },
            ]}
          />
        )}
      </PermissionGate>
    </AppShell>
  );
}

function TransferDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([
    { stockId: "", itemId: "", lotId: null as string | null, quantity: "1" },
  ]);
  const [saving, setSaving] = useState(false);

  const {
    data: locations,
    reload: reloadLocations,
    setData: setLocations,
  } = useLocations();
  const {
    data: stock,
    loading: stockLoading,
    reload: reloadStock,
    setData: setStock,
  } = useFetch(
    () =>
      fromLocationId
        ? fetchInventoryForLocation(fromLocationId)
        : Promise.resolve([]),
    [fromLocationId]
  );

  const locationOptions = (locations ?? []).map((l) => ({
    id: l.id,
    label: `${l.name} (${l.type})`,
  }));

  const stockOptions = stockTransferOptions(stock ?? []);

  function onLocationCreated(location: Location) {
    setLocations((prev) => [...(prev ?? []), location]);
    reloadLocations();
  }

  function onStockCreated(record: StockRecord) {
    setStock((prev) => [...(prev ?? []), record]);
    reloadStock();
    const emptyIdx = lines.findIndex((l) => !l.stockId);
    const idx = emptyIdx >= 0 ? emptyIdx : 0;
    setLines((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              stockId: record.id,
              itemId: record.itemId,
              lotId: record.lotId ?? null,
            }
          : row
      )
    );
  }

  function selectStockRow(index: number, stockId: string) {
    const row = (stock ?? []).find((s) => s.id === stockId);
    setLines((prev) =>
      prev.map((line, i) =>
        i === index
          ? {
              ...line,
              stockId,
              itemId: row?.itemId ?? "",
              lotId: row?.lotId ?? null,
            }
          : line
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const line of lines) {
      if (!line.stockId) continue;
      const row = (stock ?? []).find((s) => s.id === line.stockId);
      if (row && isCoffeeSku(row.item?.sku) && !row.lotId) {
        toast.error(
          `${row.item.description} is coffee stock without a lot — cannot transfer`
        );
        return;
      }
    }
    const parsedLines = parseTransferLines(lines);
    if ("error" in parsedLines) {
      toast.error(parsedLines.error);
      return;
    }
    setSaving(true);
    try {
      await api("/stock-transfers", {
        method: "POST",
        body: {
          fromLocationId,
          toLocationId,
          notes: notes || undefined,
          lines: parsedLines.lines,
        },
      });
      toast.success("Transfer created");
      requestNotificationsRefresh();
      setOpen(false);
      resetForm();
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setFromLocationId("");
    setToLocationId("");
    setNotes("");
    setLines([
      { stockId: "", itemId: "", lotId: null, quantity: "1" },
    ]);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  const itemsHint = !fromLocationId
    ? "Select a source location first"
    : stockLoading
      ? "Loading stock…"
      : `${stockOptions.length} stock line(s) at source`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <FrappeButtonPrimary type="button">
          <PlusIcon className="size-3.5" />
          New transfer
        </FrappeButtonPrimary>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,680px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0 border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-5 py-4">
            <DialogTitle className="text-base font-semibold">
              Stock transfer
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--frappe-text-muted)]">
              Move inventory between locations. Coffee lines must pick a lot-linked
              stock row. Stock is deducted from the source when created.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden p-5">
            <FrappeFormGrid className="gap-5">
              <EntitySelectField
                label="From"
                required
                stackedActions
                value={fromLocationId}
                onValueChange={setFromLocationId}
                options={locationOptions}
                listHref="/locations"
                listLabel="All locations"
                emptyMessage="Create a source location."
                quickCreate={
                  <QuickLocationDialog
                    onCreated={(loc) => {
                      onLocationCreated(loc);
                      setFromLocationId(loc.id);
                    }}
                  />
                }
              />
              <EntitySelectField
                label="To"
                required
                stackedActions
                value={toLocationId}
                onValueChange={setToLocationId}
                options={locationOptions}
                listHref="/locations"
                listLabel="All locations"
                emptyMessage="Create a destination location."
                quickCreate={
                  <QuickLocationDialog
                    onCreated={(loc) => {
                      onLocationCreated(loc);
                      setToLocationId(loc.id);
                    }}
                  />
                }
              />
            </FrappeFormGrid>

            <FrappeField label="Notes" fullWidth>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional reference or delivery note"
              />
            </FrappeField>

            <div className="overflow-hidden rounded-lg border border-[var(--frappe-border)]">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--frappe-text)]">
                    Line items
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--frappe-text-muted)]">
                    {itemsHint}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <QuickStockItemDialog
                    locationId={fromLocationId}
                    onCreated={onStockCreated}
                    disabled={!fromLocationId}
                  />
                  <Link
                    href="/inventory"
                    className="text-xs text-[var(--frappe-text-muted)] hover:text-[var(--frappe-primary)] hover:underline"
                  >
                    Stock ledger
                  </Link>
                </div>
              </div>

              <div className="hidden border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)]/60 px-4 py-2 text-xs font-medium text-[var(--frappe-text-muted)] sm:grid sm:grid-cols-[minmax(0,1fr)_88px_40px] sm:gap-3">
                <span>Item</span>
                <span>Qty</span>
                <span className="sr-only">Remove</span>
              </div>

              <div className="divide-y divide-[var(--frappe-border)]">
                {lines.map((line, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_88px_40px] sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="mb-1 text-xs text-[var(--frappe-text-muted)] sm:hidden">
                        Item
                      </p>
                      <ItemSearchSelect
                        value={line.stockId}
                        onValueChange={(v) => selectStockRow(i, v)}
                        options={stockOptions.map((o) => ({
                          id: o.id,
                          label: o.label,
                        }))}
                        disabled={!fromLocationId || stockLoading}
                        placeholder="Select stock line…"
                        className="min-w-0"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-[var(--frappe-text-muted)] sm:hidden">
                        Qty
                      </p>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        className="h-8"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row, idx) =>
                              idx === i
                                ? { ...row, quantity: e.target.value }
                                : row
                            )
                          )
                        }
                        required
                      />
                    </div>
                    <div className="flex justify-end sm:justify-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-[var(--frappe-text-muted)] hover:text-[var(--frappe-red)]"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((_, idx) => idx !== i)
                          )
                        }
                        aria-label="Remove line"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-[var(--frappe-border)] bg-[var(--frappe-section-head)]/40 px-4 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-[var(--frappe-primary)] hover:text-[var(--frappe-primary-hover)]"
                  onClick={() =>
                    setLines((prev) => [
                      ...prev,
                      {
                        stockId: "",
                        itemId: "",
                        lotId: null,
                        quantity: "1",
                      },
                    ])
                  }
                >
                  <PlusIcon className="size-3.5" />
                  Add line
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-0 shrink-0 gap-2 border-t border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-5 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <FrappeButtonPrimary type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create transfer"}
            </FrappeButtonPrimary>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
