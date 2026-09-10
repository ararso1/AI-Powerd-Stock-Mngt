"use client";

import { useState } from "react";
import { FrappeButtonPrimary, FrappeButtonSecondary } from "@/components/frappe";
import {
  QuickCreateTrigger,
} from "@/components/shared/quick-create-trigger";
import {
  QuickCreateDialogShell,
  useQuickCreateDialog,
  bindQuickCreateTrigger,
} from "@/components/shared/quick-create-dialog-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { reorderPointBodyValue } from "@/lib/inventory-stock";
import { ITEM_TYPE_OPTIONS } from "@/lib/item-types";
import { errorMessage } from "@/lib/format";
import type { ItemType, StockRecord } from "@/lib/types";
import { toast } from "sonner";

export function QuickStockItemDialog({
  locationId,
  onCreated,
  trigger,
  disabled,
}: {
  locationId: string;
  onCreated: (record: StockRecord) => void;
  trigger?: React.ReactNode;
  disabled?: boolean;
}) {
  const { open, setOpen, onOpenChange } = useQuickCreateDialog();
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [itemType, setItemType] = useState<ItemType | "">("");
  const [quantity, setQuantity] = useState("0");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [saving, setSaving] = useState(false);

  function openDialog() {
    if (disabled) return;
    setOpen(true);
  }

  async function handleSubmit() {
    if (!locationId) {
      toast.error("Select a location first");
      return;
    }
    if (!description.trim()) {
      toast.error("Item description is required");
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
      const body: Record<string, unknown> = {
        description: description.trim(),
        locationId,
        quantity: parseFloat(quantity) || 0,
        purchasePrice: parseFloat(purchasePrice) || 0,
        sku: sku || undefined,
        unit,
      };
      if (itemType) body.itemType = itemType;
      if (reorderValue !== null) {
        body.reorderPoint = reorderValue;
      }
      const record = await api<StockRecord>("/inventory", {
        method: "POST",
        body,
      });
      toast.success("Item added to stock");
      setOpen(false);
      setDescription("");
      setSku("");
      setUnit("pcs");
      setItemType("");
      setQuantity("0");
      setPurchasePrice("");
      setReorderPoint("");
      onCreated(record);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const defaultTrigger = (
    <QuickCreateTrigger
      label="New item"
      onClick={openDialog}
      disabled={disabled}
      className={disabled ? "pointer-events-none opacity-50" : undefined}
    />
  );

  return (
    <>
      {bindQuickCreateTrigger(trigger, openDialog, defaultTrigger)}
      <QuickCreateDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="New stock item"
        footer={
          <>
            <FrappeButtonSecondary type="button" onClick={() => setOpen(false)}>
              Cancel
            </FrappeButtonSecondary>
            <FrappeButtonPrimary type="button" disabled={saving} onClick={handleSubmit}>
              Create
            </FrappeButtonPrimary>
          </>
        }
      >
        <div className="grid gap-4 p-4">
          <div className="grid gap-2">
            <Label htmlFor="item-desc">
              Description <span className="text-[var(--frappe-red)]">*</span>
            </Label>
            <Input
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="item-sku">SKU</Label>
              <Input
                id="item-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-unit">Unit</Label>
              <Input
                id="item-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Item type</Label>
            <Select
              value={itemType || "__none__"}
              onValueChange={(v) =>
                setItemType(v === "__none__" ? "" : (v as ItemType))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
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
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="item-qty">Opening qty</Label>
              <Input
                id="item-qty"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-price">Purchase price</Label>
              <Input
                id="item-price"
                type="number"
                min="0"
                step="any"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="item-reorder">Reorder point</Label>
            <Input
              id="item-reorder"
              type="number"
              min="0"
              step="any"
              placeholder="Optional"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
            />
          </div>
        </div>
      </QuickCreateDialogShell>
    </>
  );
}
