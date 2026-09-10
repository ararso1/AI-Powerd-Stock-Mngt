"use client";

import * as React from "react";
import { useState } from "react";
import { FrappeButtonPrimary, FrappeButtonSecondary } from "@/components/frappe";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { Supplier } from "@/lib/types";
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
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  function openDialog() {
    setOpen(true);
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
          phone: phone || undefined,
          email: email || undefined,
          address: address || undefined,
        },
      });
      toast.success("Supplier created");
      setOpen(false);
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
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
            <Label htmlFor="supplier-phone">Phone</Label>
            <Input
              id="supplier-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-email">Email</Label>
            <Input
              id="supplier-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-address">Address</Label>
            <Textarea
              id="supplier-address"
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
