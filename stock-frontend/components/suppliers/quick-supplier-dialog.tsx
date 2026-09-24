"use client";

import * as React from "react";
import { useState } from "react";
import { FrappeButtonPrimary, FrappeButtonSecondary } from "@/components/frappe";
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
import { errorMessage } from "@/lib/format";
import { SUPPLIER_TYPE_OPTIONS } from "@/lib/suppliers";
import type { Supplier, SupplierType } from "@/lib/types";
import { QuickCreateTrigger } from "@/components/shared/quick-create-trigger";
import {
  QuickCreateDialogShell,
  useQuickCreateDialog,
  bindQuickCreateTrigger,
} from "@/components/shared/quick-create-dialog-shell";
import { toast } from "sonner";

export function QuickSupplierDialog({
  onCreated,
  trigger,
}: {
  onCreated: (supplier: Supplier) => void;
  trigger?: React.ReactNode;
}) {
  const { open, setOpen, onOpenChange } = useQuickCreateDialog();
  const [name, setName] = useState("");
  const [supplierType, setSupplierType] = useState<SupplierType>("SUPPLIER");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function openDialog() {
    setOpen(true);
  }

  function reset() {
    setName("");
    setSupplierType("SUPPLIER");
    setContactPerson("");
    setPhone("");
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    setSaving(true);
    try {
      const supplier = await api<Supplier>("/suppliers", {
        method: "POST",
        body: {
          name: name.trim(),
          supplierType,
          contactPerson: contactPerson.trim() || undefined,
          phone: phone.trim() || undefined,
        },
      });
      toast.success("Supplier created");
      setOpen(false);
      reset();
      onCreated(supplier);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const triggerNode = bindQuickCreateTrigger(
    trigger,
    openDialog,
    <QuickCreateTrigger label="New supplier" onClick={openDialog} />
  );

  return (
    <>
      {triggerNode}
      <QuickCreateDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="New supplier"
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
            <Label htmlFor="supplier-name">
              Name <span className="text-[var(--frappe-red)]">*</span>
            </Label>
            <Input
              id="supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Supplier name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select
              value={supplierType}
              onValueChange={(v) => setSupplierType(v as SupplierType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPLIER_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-contact">Contact person</Label>
            <Input
              id="supplier-contact"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-phone">Phone</Label>
            <Input
              id="supplier-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <p className="text-xs text-[var(--frappe-text-muted)]">
            Add full profile details and documents from Suppliers after creating.
          </p>
        </div>
      </QuickCreateDialogShell>
    </>
  );
}
