"use client";

import { useState } from "react";
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
import { api } from "@/lib/api";
import { errorMessage, formatQty } from "@/lib/format";
import {
  directionForReason,
  reasonsForDirection,
} from "@/lib/inventory-adjustments";
import { requestNotificationsRefresh } from "@/lib/notification-events";
import type {
  StockAdjustmentDirection,
  StockAdjustmentReason,
  StockRecord,
} from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeftRightIcon } from "lucide-react";

export function StockAdjustDialog({
  record,
  onSuccess,
  trigger,
}: {
  record: StockRecord;
  onSuccess: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<StockAdjustmentDirection>("out");
  const [reason, setReason] = useState<StockAdjustmentReason>("DAMAGE");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [saving, setSaving] = useState(false);

  const reasonOptions = reasonsForDirection(direction);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setDirection("out");
      setReason(record.lotId ? "MOISTURE_LOSS" : "DAMAGE");
      setQuantity("");
      setNotes("");
      setReference("");
      setPurchasePrice("");
    }
  }

  function handleDirectionChange(next: StockAdjustmentDirection) {
    setDirection(next);
    const allowed = reasonsForDirection(next);
    if (!allowed.some((option) => option.value === reason)) {
      setReason(allowed[0]?.value ?? "OTHER");
    }
  }

  function handleReasonChange(next: StockAdjustmentReason) {
    setReason(next);
    const required = directionForReason(next);
    if (required) setDirection(required);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!quantity.trim() || Number.isNaN(qty) || qty <= 0) {
      toast.error("Enter a positive quantity");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        locationId: record.locationId,
        itemId: record.itemId,
        direction,
        quantity: qty,
        reason,
        notes: notes.trim() || undefined,
        reference: reference.trim() || undefined,
      };
      if (record.lotId) {
        body.lotId = record.lotId;
      }
      if (direction === "in" && purchasePrice.trim()) {
        const price = parseFloat(purchasePrice);
        if (Number.isNaN(price) || price < 0) {
          toast.error("Enter a valid purchase price or leave blank");
          setSaving(false);
          return;
        }
        body.purchasePrice = price;
      }
      await api("/inventory/adjustments", { method: "POST", body });
      toast.success("Stock adjusted");
      requestNotificationsRefresh();
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
          <Button size="icon" variant="ghost" title="Adjust quantity">
            <ArrowLeftRightIcon className="size-4" />
            <span className="sr-only">Adjust quantity</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="rounded border border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-3 py-2 text-sm">
              <p className="font-medium text-[var(--frappe-text)]">
                {record.item.description}
              </p>
              <p className="text-xs text-[var(--frappe-text-muted)]">
                {record.location?.name ?? "Location"} · On hand{" "}
                {formatQty(record.quantity)}
                {record.item.sku ? ` · SKU ${record.item.sku}` : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Direction</Label>
                <Select
                  value={direction}
                  onValueChange={(v) =>
                    handleDirectionChange(v as StockAdjustmentDirection)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">In (increase)</SelectItem>
                    <SelectItem value="out">Out (decrease)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Select
                value={reason}
                onValueChange={(v) =>
                  handleReasonChange(v as StockAdjustmentReason)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reasonOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {direction === "in" ? (
              <div className="grid gap-2">
                <Label>Purchase price (optional)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="Updates weighted average cost"
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Reference (optional)</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. COUNT-2026-06"
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Audit notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Post adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
