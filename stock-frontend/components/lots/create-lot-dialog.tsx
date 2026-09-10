"use client";

import { useState } from "react";
import type { Lot } from "@/lib/types";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { COFFEE_FORM_OPTIONS } from "@/lib/lots";
import { useLocations } from "@/hooks/use-locations";
import { QuickCreateDialogShell } from "@/components/shared/quick-create-dialog-shell";
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

export function CreateLotDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: locations } = useLocations();
  const [code, setCode] = useState("");
  const [form, setForm] = useState("GREEN");
  const [grade, setGrade] = useState("G1");
  const [cropYear, setCropYear] = useState("2025/26");
  const [quantity, setQuantity] = useState("100");
  const [locationId, setLocationId] = useState(NONE);
  const [region, setRegion] = useState("");
  const [processMethod, setProcessMethod] = useState("Washed");
  const [moisture, setMoisture] = useState("11.5");
  const [notes, setNotes] = useState("");

  function reset() {
    setCode("");
    setForm("GREEN");
    setGrade("G1");
    setCropYear("2025/26");
    setQuantity("100");
    setLocationId(NONE);
    setRegion("");
    setProcessMethod("Washed");
    setMoisture("11.5");
    setNotes("");
  }

  async function handleSubmit() {
    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    setSaving(true);
    try {
      await api<Lot>("/lots", {
        method: "POST",
        body: {
          code: code.trim() || undefined,
          form,
          grade: grade.trim() || undefined,
          cropYear: cropYear.trim() || undefined,
          quantity: qty,
          locationId: locationId === NONE ? undefined : locationId,
          region: region.trim() || undefined,
          processMethod: processMethod.trim() || undefined,
          moisturePercent: moisture ? parseFloat(moisture) : undefined,
          notes: notes.trim() || undefined,
        },
      });
      toast.success("Lot created");
      setOpen(false);
      reset();
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <FrappeButtonPrimary type="button" onClick={() => setOpen(true)}>
        <PlusIcon className="size-3.5" />
        New lot
      </FrappeButtonPrimary>
      <QuickCreateDialogShell
        open={open}
        onOpenChange={setOpen}
        title="Create coffee lot"
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
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto p-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <p className="text-xs text-[var(--csolve-text-muted)]">
              Opens a new lot and records a CREATED timeline event.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Code (optional)</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Auto-generated if empty"
            />
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
            <Input value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Crop year</Label>
            <Input
              value={cropYear}
              onChange={(e) => setCropYear(e.target.value)}
            />
          </div>
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
          <div className="grid gap-1.5">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {(locations ?? []).map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Region</Label>
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Yirgacheffe"
            />
          </div>
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
          <div className="grid gap-1.5 sm:col-span-2">
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
