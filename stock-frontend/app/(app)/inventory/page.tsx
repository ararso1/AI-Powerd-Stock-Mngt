"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { FrappeFilterBar, FrappeListToolbar } from "@/components/frappe";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { buildInventoryListPath, buildLowStockListPath } from "@/lib/list-query";
import {
  isLowStockRow,
  optionalStringBodyValue,
  reorderPointBodyValue,
} from "@/lib/inventory-stock";
import { formatMoney, formatQty, errorMessage } from "@/lib/format";
import type {
  CoffeeForm,
  InventoryListTotals,
  ItemType,
  LowStockRecord,
  StockRecord,
} from "@/lib/types";
import { ITEM_TYPE_OPTIONS, itemTypeLabel } from "@/lib/item-types";
import { COFFEE_FORM_OPTIONS, coffeeFormLabel } from "@/lib/lots";
import { ListPageTotals } from "@/components/shared/list-page-totals";
import { requestNotificationsRefresh } from "@/lib/notification-events";
import { useLocations } from "@/hooks/use-locations";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportInventoryButton } from "@/components/inventory/export-inventory-button";
import { InventoryAdjustmentsPanel } from "@/components/inventory/inventory-adjustments-panel";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { toast } from "sonner";
import { PlusIcon, UploadIcon, PencilIcon, Trash2Icon } from "lucide-react";

const ALL_LOCATIONS = "__all__";
const ALL = "__all__";
const VIEW_ALL = "all";
const VIEW_LOW_STOCK = "low-stock";

export default function InventoryPage() {
  const { user } = useAuth();
  const [locationFilter, setLocationFilter] = useState(ALL_LOCATIONS);
  const [formFilter, setFormFilter] = useState<CoffeeForm | "">("");
  const [cropYear, setCropYear] = useState("");
  const [grade, setGrade] = useState("");
  const [viewMode, setViewMode] = useState<typeof VIEW_ALL | typeof VIEW_LOW_STOCK>(
    VIEW_ALL
  );
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const debouncedCropYear = useDebouncedValue(cropYear);
  const debouncedGrade = useDebouncedValue(grade);

  const { data: locations } = useLocations();

  const listLocationId =
    locationFilter === ALL_LOCATIONS ? undefined : locationFilter;
  const isAllLocations = locationFilter === ALL_LOCATIONS;

  const selectedLocation = (locations ?? []).find(
    (loc) => loc.id === listLocationId
  );
  const locationLabel = isAllLocations
    ? "all-locations"
    : selectedLocation
      ? `${selectedLocation.name}-${selectedLocation.type}`
      : "stock";

  const exportFilters = {
    locationId: listLocationId,
    from: from || undefined,
    to: to || undefined,
    search: debouncedSearch || undefined,
  };

  const isLowStockView = viewMode === VIEW_LOW_STOCK;

  const { rows, meta, totals, setPage, setLimit, loading, reload } =
    usePaginatedList<StockRecord | LowStockRecord, InventoryListTotals>(
    (page, limit) => {
      if (isLowStockView) {
        return buildLowStockListPath(
          { locationId: listLocationId },
          page,
          limit
        );
      }
      return buildInventoryListPath(
        {
          locationId: listLocationId,
          from: from || undefined,
          to: to || undefined,
          search: debouncedSearch || undefined,
          form: formFilter || undefined,
          cropYear: debouncedCropYear || undefined,
          grade: debouncedGrade || undefined,
        },
        page,
        limit
      );
    },
    [
      listLocationId,
      from,
      to,
      debouncedSearch,
      isLowStockView,
      formFilter,
      debouncedCropYear,
      debouncedGrade,
    ]
  );

  return (
    <AppShell
      title="Stock Ledger"
      subtitle="Lot-aware warehouse quantities"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Stock Ledger" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PermissionGate permission="inventory.write">
            <StockFormDialog
              locationId={listLocationId ?? ""}
              disabled={isAllLocations}
              onSuccess={reload}
            />
          </PermissionGate>
          <PermissionGate permission="inventory.read">
            <ExportInventoryButton
              filters={exportFilters}
              locationLabel={locationLabel}
              disabled={loading}
            />
          </PermissionGate>
          <PermissionGate permission="inventory.import">
            <ImportDialog
              locationId={listLocationId ?? ""}
              disabled={isAllLocations}
              onSuccess={reload}
            />
          </PermissionGate>
        </div>
      }
    >
      <PermissionGate permission="inventory.read">
        <Tabs defaultValue="stock" className="gap-4">
          <TabsList>
            <TabsTrigger value="stock">Stock</TabsTrigger>
            <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
          </TabsList>
          <TabsContent value="stock" className="mt-0 space-y-0">
        <FrappeFilterBar>
          <div className="grid gap-2">
            <Label className="text-sm text-[var(--frappe-text-muted)]">
              Location
            </Label>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="h-9 w-full min-w-[200px] border-[var(--frappe-border)] bg-[var(--frappe-surface)] sm:w-[240px]">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LOCATIONS}>All locations</SelectItem>
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
              View
            </Label>
            <Select
              value={viewMode}
              onValueChange={(v) =>
                setViewMode(v as typeof VIEW_ALL | typeof VIEW_LOW_STOCK)
              }
            >
              <SelectTrigger className="h-9 w-full min-w-[180px] border-[var(--frappe-border)] bg-[var(--frappe-surface)] sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={VIEW_ALL}>All stock</SelectItem>
                <SelectItem value={VIEW_LOW_STOCK}>Low stock only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search item, SKU, or lot…"
            disabled={isLowStockView}
            className={isLowStockView ? "opacity-60" : undefined}
          />
          <Select
            value={formFilter || ALL}
            onValueChange={(v) =>
              setFormFilter(v === ALL ? "" : (v as CoffeeForm))
            }
            disabled={isLowStockView}
          >
            <SelectTrigger className="h-9 w-full min-w-[140px] border-[var(--frappe-border)] bg-[var(--frappe-surface)] sm:w-[160px]">
              <SelectValue placeholder="Form" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All forms</SelectItem>
              {COFFEE_FORM_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-9 w-full min-w-[110px] border-[var(--frappe-border)] bg-[var(--frappe-surface)] sm:w-[120px]"
            placeholder="Crop year"
            value={cropYear}
            onChange={(e) => setCropYear(e.target.value)}
            disabled={isLowStockView}
          />
          <Input
            className="h-9 w-full min-w-[100px] border-[var(--frappe-border)] bg-[var(--frappe-surface)] sm:w-[120px]"
            placeholder="Grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            disabled={isLowStockView}
          />
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            disabled={isLowStockView}
            className={isLowStockView ? "opacity-60" : undefined}
          />
        </FrappeFilterBar>
        <FrappeListToolbar>
          <span className="text-[var(--frappe-text-muted)]">
            {meta.total} {isLowStockView ? "low-stock item" : "item"}
            {meta.total === 1 ? "" : "s"}
          </span>
          {!isLowStockView && totals ? (
            <ListPageTotals
              items={[
                { label: "Total qty", value: formatQty(totals.quantity) },
                {
                  label: "Stock value",
                  value: formatMoney(totals.inventoryValue),
                },
              ]}
            />
          ) : null}
        </FrappeListToolbar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle={
              isLowStockView
                ? "No low-stock items"
                : isAllLocations
                  ? "No stock found"
                  : "No stock at this location"
            }
            emptyDescription={
              isLowStockView
                ? "Items at or below their reorder point will appear here."
                : undefined
            }
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={[
              ...(isAllLocations
                ? [
                    {
                      key: "location",
                      header: "Location",
                      cell: (r: StockRecord) => r.location?.name ?? "—",
                    },
                  ]
                : []),
              {
                key: "item",
                header: "Item",
                cell: (r) => (
                  <div>
                    <p className="font-medium">{r.item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        r.item.sku ? `SKU: ${r.item.sku}` : null,
                        r.item.itemType
                          ? itemTypeLabel(r.item.itemType)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || null}
                    </p>
                  </div>
                ),
              },
              {
                key: "lot",
                header: "Lot",
                cell: (r) =>
                  r.lot ? (
                    <div>
                      <p className="font-medium tabular-nums">{r.lot.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          r.lot.form ? coffeeFormLabel(r.lot.form) : null,
                          r.lot.cropYear,
                          r.lot.grade,
                        ]
                          .filter(Boolean)
                          .join(" · ") || null}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  ),
              },
              {
                key: "qty",
                header: "Quantity",
                className: "w-28 text-right tabular-nums",
                cell: (r) => {
                  const lowRow = r as LowStockRecord;
                  const showLowBadge =
                    isLowStockView || isLowStockRow(r as StockRecord);
                  return (
                    <div className="flex flex-col items-end gap-1">
                      <span>{formatQty(r.quantity)}</span>
                      {showLowBadge ? (
                        <Badge
                          variant={
                            lowRow.status === "OUT_OF_STOCK" ||
                            parseFloat(r.quantity) <= 0
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px] font-normal"
                        >
                          {lowRow.status === "OUT_OF_STOCK" ||
                          parseFloat(r.quantity) <= 0
                            ? "Out of stock"
                            : "Low stock"}
                        </Badge>
                      ) : null}
                    </div>
                  );
                },
              },
              {
                key: "reorder",
                header: "Reorder at",
                className: "w-28 text-right tabular-nums",
                cell: (r) =>
                  r.reorderPoint != null && r.reorderPoint !== ""
                    ? formatQty(r.reorderPoint)
                    : "—",
              },
              ...(isLowStockView
                ? [
                    {
                      key: "shortage",
                      header: "Shortage",
                      className: "w-28 text-right tabular-nums",
                      cell: (r: StockRecord | LowStockRecord) =>
                        formatQty((r as LowStockRecord).shortage),
                    },
                  ]
                : []),
              {
                key: "price",
                header: "Purchase price",
                className: "w-36 text-right tabular-nums",
                cell: (r) => formatMoney(r.purchasePrice),
              },
              {
                key: "value",
                header: "Value",
                className: "w-36 text-right tabular-nums",
                cell: (r) =>
                  formatMoney(
                    parseFloat(r.quantity) * parseFloat(r.purchasePrice)
                  ),
              },
              {
                key: "actions",
                header: "",
                className: "w-32 text-right",
                cell: (r) =>
                  hasPermission(user, "inventory.write") ||
                  hasPermission(user, "inventory.adjust") ||
                  hasPermission(user, "inventory.delete") ? (
                    <div className="flex justify-end gap-1">
                      {hasPermission(user, "inventory.adjust") ? (
                        <StockAdjustDialog
                          record={r}
                          onSuccess={reload}
                        />
                      ) : null}
                      {hasPermission(user, "inventory.write") ? (
                        <StockFormDialog
                          locationId={r.locationId ?? listLocationId ?? ""}
                          record={r}
                          onSuccess={reload}
                          trigger={
                            <Button size="icon" variant="ghost">
                              <PencilIcon className="size-4" />
                            </Button>
                          }
                        />
                      ) : null}
                      {hasPermission(user, "inventory.delete") ? (
                        <DeleteStockButton id={r.id} onSuccess={reload} />
                      ) : null}
                    </div>
                  ) : null,
              },
            ]}
          />
        )}
          </TabsContent>
          <TabsContent value="adjustments" className="mt-0">
            <InventoryAdjustmentsPanel />
          </TabsContent>
        </Tabs>
      </PermissionGate>
    </AppShell>
  );
}

function StockFormDialog({
  locationId,
  record,
  onSuccess,
  trigger,
  disabled,
}: {
  locationId: string;
  record?: StockRecord;
  onSuccess: () => void;
  trigger?: React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(record?.item.description ?? "");
  const [sku, setSku] = useState(record?.item.sku ?? "");
  const [unit, setUnit] = useState(record?.item.unit ?? "pcs");
  const [itemType, setItemType] = useState<ItemType | "">(
    record?.item.itemType ?? ""
  );
  const [quantity, setQuantity] = useState(record?.quantity ?? "");
  const [purchasePrice, setPurchasePrice] = useState(
    record?.purchasePrice ?? ""
  );
  const [reorderPoint, setReorderPoint] = useState(record?.reorderPoint ?? "");
  const [saving, setSaving] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setDescription(record?.item.description ?? "");
      setSku(record?.item.sku ?? "");
      setUnit(record?.item.unit ?? "pcs");
      setItemType(record?.item.itemType ?? "");
      setQuantity(record?.quantity ?? "");
      setPurchasePrice(record?.purchasePrice ?? "");
      setReorderPoint(record?.reorderPoint ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetLocationId = record?.locationId ?? locationId;
    if (!record && !targetLocationId) {
      toast.error("Select a location first");
      return;
    }
    setSaving(true);
    try {
      const reorderValue = reorderPointBodyValue(reorderPoint);
      if (reorderValue === undefined) {
        toast.error("Enter a valid reorder point or leave blank");
        setSaving(false);
        return;
      }
      if (!description.trim()) {
        toast.error("Description is required");
        setSaving(false);
        return;
      }
      if (record) {
        await api(`/inventory/${record.id}`, {
          method: "PATCH",
          body: {
            description: description.trim(),
            sku: optionalStringBodyValue(sku),
            unit: optionalStringBodyValue(unit),
            itemType: itemType || null,
            purchasePrice: parseFloat(purchasePrice),
            reorderPoint: reorderValue,
          },
        });
        toast.success("Stock updated");
        requestNotificationsRefresh();
      } else {
        if (!quantity.trim() || Number.isNaN(parseFloat(quantity))) {
          toast.error("Quantity is required");
          setSaving(false);
          return;
        }
        const body: Record<string, unknown> = {
          description: description.trim(),
          locationId: targetLocationId,
          quantity: parseFloat(quantity),
          purchasePrice: parseFloat(purchasePrice),
          sku: optionalStringBodyValue(sku) ?? undefined,
          unit: optionalStringBodyValue(unit) ?? undefined,
        };
        if (itemType) body.itemType = itemType;
        if (reorderValue !== null) {
          body.reorderPoint = reorderValue;
        }
        await api("/inventory", {
          method: "POST",
          body,
        });
        toast.success("Stock added");
      }
      setOpen(false);
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" disabled={disabled}>
            <PlusIcon />
            Add item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{record ? "Edit stock" : "Add stock"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>SKU (optional)</Label>
                <Input value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Unit</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Item type (optional)</Label>
              <Select
                value={itemType || "__none__"}
                onValueChange={(v) =>
                  setItemType(v === "__none__" ? "" : (v as ItemType))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not set</SelectItem>
                  {ITEM_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {record ? (
              <p className="text-xs text-muted-foreground">
                Description, SKU, unit, and item type update this item everywhere
                it is stocked. Clear SKU or unit to remove them. Quantity cannot
                be edited here — use Adjust on the stock row.
              </p>
            ) : null}
            {!record ? (
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="rounded border border-dashed border-[var(--frappe-border)] px-3 py-2 text-sm text-[var(--frappe-text-muted)]">
                On hand:{" "}
                <span className="font-medium tabular-nums text-[var(--frappe-text)]">
                  {formatQty(record.quantity)}
                </span>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Purchase price</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Reorder point (optional)</Label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="Alert when quantity at or below"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to disable low-stock alerts for this item.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {record ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  locationId,
  onSuccess,
  disabled,
}: {
  locationId: string;
  onSuccess: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !locationId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api(`/inventory/import?locationId=${locationId}`, {
        method: "POST",
        body: form,
      });
      toast.success("Import completed");
      setOpen(false);
      setFile(null);
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <UploadIcon />
          Import Excel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleImport}>
          <DialogHeader>
            <DialogTitle>Bulk import</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-muted-foreground">
            Columns: description, quantity, purchasePrice (or price). Optional:
            sku, reorderPoint (or reorder_point), optional itemType
            (RAW, SEMI, FINISHED, OTHER).
          </p>
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={uploading || !file}>
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStockButton({
  id,
  onSuccess,
}: {
  id: string;
  onSuccess: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api(`/inventory/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost">
          <Trash2Icon className="size-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete stock record?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the stock entry for this location.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
