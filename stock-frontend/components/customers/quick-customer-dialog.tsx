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
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { toast } from "sonner";

export function QuickCustomerDialog({
  onCreated,
  trigger,
}: {
  onCreated: (customer: Customer) => void;
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
      toast.error("Customer name is required");
      return;
    }
    setSaving(true);
    try {
      const customer = await api<Customer>("/customers", {
        method: "POST",
        body: {
          name: name.trim(),
          phone: phone || undefined,
          email: email || undefined,
          address: address || undefined,
        },
      });
      toast.success("Customer created");
      setOpen(false);
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      onCreated(customer);
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
        <QuickCreateTrigger label="New customer" onClick={openDialog} />
      )}
      <QuickCreateDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="New customer"
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
            <Label htmlFor="customer-name">
              Name <span className="text-[var(--frappe-red)]">*</span>
            </Label>
            <Input
              id="customer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-address">Address</Label>
            <Textarea
              id="customer-address"
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
