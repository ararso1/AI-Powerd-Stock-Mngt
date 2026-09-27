"use client";

import { useEffect, useState } from "react";
import type { CoffeeForm, Lot } from "@/lib/types";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { COFFEE_FORM_OPTIONS, COFFEE_GRADE_OPTIONS } from "@/lib/lots";
import { useLocations } from "@/hooks/use-locations";
import { QuickCreateTrigger } from "@/components/shared/quick-create-trigger";
import {
  QuickCreateDialogShell,
  useQuickCreateDialog,
  bindQuickCreateTrigger,
} from "@/components/shared/quick-create-dialog-shell";
import { FrappeButtonPrimary, FrappeButtonSecondary } from "@/components/frappe";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

const NONE = "__none__";

export function QuickLotDialog({
  onCreated,
  defaultLocationId,
  defaultItemId,
  catalogItems = [],
  /** Purchase receive adds the kg. Opening quantity stays 0. */
  forPurchase = false,
  trigger,
  disabled,
}: {
  onCreated: (lot: Lot) => void;
  defaultLocationId?: string;
  defaultItemId?: string;
  /** Existing coffee products at the warehouse. Empty means the modal creates one. */
  catalogItems?: { id: string; label: string }[];
  forPurchase?: boolean;
  trigger?: React.ReactNode;
  disabled?: boolean;
}) {
  const { open, setOpen, onOpenChange } = useQuickCreateDialog();
  const { data: locations } = useLocations();
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [form, setForm] = useState<CoffeeForm | string>("GREEN");
  const [grade, setGrade] = useState("G1");
  const [cropYear, setCropYear] = useState("2025/26");
  const [quantity, setQuantity] = useState(forPurchase ? "0" : "100");
  const [locationId, setLocationId] = useState(NONE);
  const [region, setRegion] = useState("");
  const [zone, setZone] = useState("");
  const [woreda, setWoreda] = useState("");
  const [processMethod, setProcessMethod] = useState("Washed");
  const [moisture, setMoisture] = useState("11.5");
  const [notes, setNotes] = useState("");
  const [catalogItemId, setCatalogItemId] = useState(defaultItemId ?? "");
  const [productName, setProductName] = useState("");

  function reset() {
    setCode("");
    setForm("GREEN");
    setGrade("G1");
    setCropYear("2025/26");
    setQuantity(forPurchase ? "0" : "100");
    setLocationId(defaultLocationId || NONE);
    setRegion("");
    setZone("");
    setWoreda("");
    setProcessMethod("Washed");
    setMoisture("11.5");
    setNotes("");
    setCatalogItemId(defaultItemId ?? "");
    setProductName("");
  }

  useEffect(() => {
    if (open) {
      setLocationId(defaultLocationId || NONE);
      if (forPurchase) setQuantity("0");
    }
  }, [open, defaultLocationId, forPurchase]);

  function openDialog() {
    if (disabled) return;
    reset();
    setOpen(true);
    void api<{ code: string }>("/lots/next-code")
      .then((res) => {
        if (res.code) setCode(res.code);
      })
      .catch(() => {
        /* Server still assigns a code if this stays empty. */
      });
  }

  async function handleSubmit() {
    const qty = forPurchase ? 0 : parseFloat(quantity);
    if (!forPurchase && (!Number.isFinite(qty) || qty < 0)) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (forPurchase && (!defaultLocationId || locationId === NONE)) {
      toast.error("Select the purchase warehouse first");
      return;
    }
    const lotCode = code.trim().toUpperCase();
    let itemId = catalogItemId || defaultItemId || "";
    if (forPurchase && !itemId) {
      if (!productName.trim()) {
        toast.error("Enter the coffee product name for this lot");
        return;
      }
      if (!lotCode) {
        toast.error("Code (SKU) is required");
        return;
      }
    }
    setSaving(true);
    try {
      const lot = await api<Lot>("/lots", {
        method: "POST",
        body: {
          code: lotCode || undefined,
          form,
          grade: grade || undefined,
          cropYear: cropYear.trim() || undefined,
          quantity: qty,
          locationId: locationId === NONE ? undefined : locationId,
          itemId: itemId || undefined,
          itemDescription:
            !itemId && productName.trim() ? productName.trim() : undefined,
          itemSku: !itemId && lotCode ? lotCode : undefined,
          region: region.trim() || undefined,
          zone: zone.trim() || undefined,
          woreda: woreda.trim() || undefined,
          processMethod:
            forPurchase || !processMethod.trim()
              ? undefined
              : processMethod.trim(),
          moisturePercent:
            forPurchase || !moisture ? undefined : parseFloat(moisture),
          notes: notes.trim() || undefined,
        },
      });
      toast.success("Lot created");
      setOpen(false);
      reset();
      onCreated(lot);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {bindQuickCreateTrigger(
        trigger,
        openDialog,
        <QuickCreateTrigger
          label="Create New Lot"
          onClick={openDialog}
          disabled={disabled}
        />
      )}
      <QuickCreateDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="Create coffee lot"
        contentClassName="w-[min(72rem,calc(100%-2rem))] sm:max-w-none"
        footer={
          <>
            <FrappeButtonSecondary type="button" onClick={() => setOpen(false)}>
              Cancel
            </FrappeButtonSecondary>
            <FrappeButtonPrimary
              type="button"
              disabled={saving}
              onClick={() => void handleSubmit()}
            >
              Create lot
            </FrappeButtonPrimary>
          </>
        }
      >
        <div className="grid max-h-[80vh] gap-x-4 gap-y-3 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
            <p className="text-xs text-[var(--csolve-text-muted)]">
              {forPurchase
                ? "Creates the lot at this warehouse. The code is the product SKU. Enter the received kg, warehouse test scores, and ECTA result on the purchase."
                : "Opens a new lot at your receiving warehouse. Origin fields are the coffee source, not the warehouse."}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>{forPurchase ? "Code (SKU)" : "Code"}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="LOT-YYYY-0001"
            />
            <p className="text-[11px] text-[var(--csolve-text-muted)]">
              {forPurchase
                ? "Filled automatically and used as the product SKU. You can change it before saving."
                : "Filled automatically. You can change it before saving."}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Form</Label>
            <Select value={form} onValueChange={setForm}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COFFEE_FORM_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Grade</Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COFFEE_GRADE_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Crop year</Label>
            <Input
              value={cropYear}
              onChange={(e) => setCropYear(e.target.value)}
            />
          </div>
          {forPurchase ? null : (
            <div className="grid gap-1.5">
              <Label>Quantity (kg)</Label>
              <Input
                type="number"
                min={0}
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          )}
          {forPurchase ? (
            <div className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
              <Label>Coffee product</Label>
              {catalogItems.length > 0 ? (
                <Select
                  value={catalogItemId || NONE}
                  onValueChange={(v) =>
                    setCatalogItemId(v === NONE ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select existing coffee product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>New coffee product</SelectItem>
                    {catalogItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-[11px] text-[var(--csolve-text-muted)]">
                  No coffee product at this warehouse yet. Enter a name below.
                  The lot code is saved as the SKU.
                </p>
              )}
            </div>
          ) : null}
          {forPurchase && !catalogItemId ? (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Product name</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Yirgacheffe G1"
              />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label>Warehouse / business location</Label>
            <Select
              value={locationId}
              onValueChange={setLocationId}
              disabled={forPurchase && Boolean(defaultLocationId)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {!forPurchase ? (
                  <SelectItem value={NONE}>None</SelectItem>
                ) : null}
                {(locations ?? []).map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Region (origin)</Label>
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Yirgacheffe"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Zone (origin)</Label>
            <Input value={zone} onChange={(e) => setZone(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Woreda (origin)</Label>
            <Input value={woreda} onChange={(e) => setWoreda(e.target.value)} />
          </div>
          {forPurchase ? null : (
            <>
              <div className="grid gap-1.5">
                <Label>Process</Label>
                <Input
                  value={processMethod}
                  onChange={(e) => setProcessMethod(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Moisture %</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={moisture}
                  onChange={(e) => setMoisture(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </QuickCreateDialogShell>
    </>
  );
}

/** Full-page lots list trigger (primary button). */
export function CreateLotDialog({ onSuccess }: { onSuccess: () => void }) {
  return (
    <QuickLotDialog
      onCreated={() => onSuccess()}
      trigger={
        <FrappeButtonPrimary type="button">
          <PlusIcon className="size-3.5" />
          New lot
        </FrappeButtonPrimary>
      }
    />
  );
}
