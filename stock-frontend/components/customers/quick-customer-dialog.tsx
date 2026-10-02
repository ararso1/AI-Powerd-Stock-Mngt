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
import { CUSTOMER_MARKET_OPTIONS } from "@/lib/customers";
import { errorMessage } from "@/lib/format";
import type { Customer, CustomerMarket } from "@/lib/types";
import { toast } from "sonner";

export function QuickCustomerDialog({
  onCreated,
  trigger,
  defaultMarket = "LOCAL",
}: {
  onCreated: (customer: Customer) => void;
  trigger?: React.ReactNode;
  defaultMarket?: CustomerMarket;
}) {
  const { open, setOpen, onOpenChange } = useQuickCreateDialog();
  const [name, setName] = useState("");
  const [market, setMarket] = useState<CustomerMarket>(defaultMarket);
  const [country, setCountry] = useState(
    defaultMarket === "LOCAL" ? "Ethiopia" : ""
  );
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);

  function openDialog() {
    setMarket(defaultMarket);
    setCountry(defaultMarket === "LOCAL" ? "Ethiopia" : "");
    setOpen(true);
  }

  function reset() {
    setName("");
    setMarket(defaultMarket);
    setCountry(defaultMarket === "LOCAL" ? "Ethiopia" : "");
    setPhone("");
    setEmail("");
    setAddress("");
    setCreditLimit("");
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (market === "INTERNATIONAL" && !country.trim()) {
      toast.error("Country is required for international customers");
      return;
    }
    setSaving(true);
    try {
      const limit = creditLimit.trim();
      const customer = await api<Customer>("/customers", {
        method: "POST",
        body: {
          name: name.trim(),
          market,
          country: country.trim() || undefined,
          phone: phone || undefined,
          email: email || undefined,
          address: address || undefined,
          preferredCurrency: market === "INTERNATIONAL" ? "USD" : "ETB",
          creditLimit: limit !== "" ? Number(limit) : undefined,
        },
      });
      toast.success("Customer created");
      setOpen(false);
      reset();
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
            <FrappeButtonPrimary
              type="button"
              disabled={saving}
              onClick={() => void handleSubmit()}
            >
              Create
            </FrappeButtonPrimary>
          </>
        }
      >
        <div className="grid gap-4 p-4">
          <div className="grid gap-2">
            <Label>
              Market <span className="text-[var(--frappe-red)]">*</span>
            </Label>
            <Select
              value={market}
              onValueChange={(v) => {
                const next = v as CustomerMarket;
                setMarket(next);
                if (next === "LOCAL" && !country.trim()) setCountry("Ethiopia");
                if (next === "INTERNATIONAL" && country === "Ethiopia") {
                  setCountry("");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_MARKET_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <Label htmlFor="customer-country">
              Country
              {market === "INTERNATIONAL" ? (
                <span className="text-[var(--frappe-red)]"> *</span>
              ) : null}
            </Label>
            <Input
              id="customer-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={
                market === "INTERNATIONAL" ? "e.g. Japan" : "Ethiopia"
              }
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
          <div className="grid gap-2">
            <Label htmlFor="customer-credit">Credit limit</Label>
            <Input
              id="customer-credit"
              type="number"
              min={0}
              step="0.01"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
            />
          </div>
        </div>
      </QuickCreateDialogShell>
    </>
  );
}
