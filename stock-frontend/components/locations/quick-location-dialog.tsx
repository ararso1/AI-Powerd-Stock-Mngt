"use client";

import { useState } from "react";
import { FrappeButtonPrimary, FrappeButtonSecondary } from "@/components/frappe";
import { QuickCreateTrigger } from "@/components/shared/quick-create-trigger";
import {
  QuickCreateDialogShell,
  useQuickCreateDialog,
  bindQuickCreateTrigger,
} from "@/components/shared/quick-create-dialog-shell";
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
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { Location, LocationType } from "@/lib/types";
import { toast } from "sonner";

export function QuickLocationDialog({
  onCreated,
  trigger,
}: {
  onCreated: (location: Location) => void;
  trigger?: React.ReactNode;
}) {
  const { open, setOpen, onOpenChange } = useQuickCreateDialog();
  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>("WAREHOUSE");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  function openDialog() {
    setOpen(true);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Location name is required");
      return;
    }
    setSaving(true);
    try {
      const location = await api<Location>("/locations", {
        method: "POST",
        body: {
          name: name.trim(),
          type,
          address: address || undefined,
        },
      });
      toast.success("Location created");
      setOpen(false);
      setName("");
      setType("WAREHOUSE");
      setAddress("");
      onCreated(location);
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
        <QuickCreateTrigger label="New location" onClick={openDialog} />
      )}
      <QuickCreateDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="New location"
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
            <Label htmlFor="loc-name">
              Name <span className="text-[var(--frappe-red)]">*</span>
            </Label>
            <Input
              id="loc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as LocationType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                <SelectItem value="SHOWROOM">Showroom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loc-address">Address</Label>
            <Textarea
              id="loc-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </QuickCreateDialogShell>
    </>
  );
}
