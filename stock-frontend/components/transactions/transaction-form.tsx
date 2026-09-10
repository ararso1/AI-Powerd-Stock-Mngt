"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FrappeButtonPrimary } from "@/components/frappe";
import { EntitySelectField } from "@/components/shared/entity-select-field";
import { ItemSearchSelect } from "@/components/shared/item-search-select";
import { QuickSupplierDialog } from "@/components/suppliers/quick-supplier-dialog";
import { QuickCustomerDialog } from "@/components/customers/quick-customer-dialog";
import { QuickLocationDialog } from "@/components/locations/quick-location-dialog";
import { QuickBankAccountDialog } from "@/components/banks/quick-bank-account-dialog";
import { QuickStockItemDialog } from "@/components/inventory/quick-stock-item-dialog";
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
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { apiList } from "@/lib/list-response";
import { fetchInventoryForLocation } from "@/lib/inventory-fetch";
import {
  bankAccountSelectOptions,
  bankAccountsUrl,
  bankAccountTypeForPayment,
  paymentAccountFieldLabel,
  resolveBankAccountId,
  showsPaymentAccountPicker,
} from "@/lib/bank-accounts";
import {
  bankAccountValidationError,
  onPaymentMethodChange,
  useAutoPaymentAccount,
} from "@/hooks/use-payment-bank-account";
import {
  itemOptionsFromStock,
  parseDocumentLines,
  productItemId,
} from "@/lib/inventory-items";
import { errorMessage } from "@/lib/format";
import { requestNotificationsRefresh } from "@/lib/notification-events";
import type {
  BankAccount,
  Customer,
  Location,
  PaymentMethod,
  StockRecord,
  Supplier,
} from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

interface LineRow {
  itemId: string;
  quantity: string;
  unitPrice: string;
}

export function TransactionFormDialog({
  type,
  onSuccess,
}: {
  type: "purchase" | "sale";
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [lines, setLines] = useState<LineRow[]>([
    { itemId: "", quantity: "1", unitPrice: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const isPurchase = type === "purchase";
  const partyEndpoint = isPurchase ? "/suppliers" : "/customers";
  const partyLabel = isPurchase ? "Supplier" : "Customer";
  const partyListHref = isPurchase ? "/suppliers" : "/customers";

  const {
    data: parties,
    reload: reloadParties,
    setData: setParties,
  } = useFetch<(Supplier | Customer)[]>(
    () => apiList<Supplier | Customer>(partyEndpoint),
    [partyEndpoint]
  );
  const {
    data: locations,
    reload: reloadLocations,
    setData: setLocations,
  } = useLocations();
  const paymentAccountType = bankAccountTypeForPayment(paymentMethod);
  const {
    data: banks,
    reload: reloadBanks,
    setData: setBanks,
  } = useFetch(
    () =>
      paymentAccountType
        ? apiList<BankAccount>(bankAccountsUrl(paymentAccountType))
        : Promise.resolve([]),
    [paymentAccountType]
  );

  useAutoPaymentAccount(
    paymentMethod,
    banks,
    bankAccountId,
    setBankAccountId
  );

  const {
    data: stock,
    reload: reloadStock,
    setData: setStock,
  } = useFetch(
    () =>
      locationId
        ? fetchInventoryForLocation(locationId)
        : Promise.resolve([]),
    [locationId]
  );

  const partyOptions = (parties ?? []).map((p) => ({
    id: p.id,
    label: p.name,
  }));

  const itemOptions = itemOptionsFromStock(stock ?? []);

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );
  }

  function onPartyCreated(party: Supplier | Customer) {
    setParties((prev) => [...(prev ?? []), party]);
    setPartyId(party.id);
    reloadParties();
  }

  function onLocationCreated(location: Location) {
    setLocations((prev) => [...(prev ?? []), location]);
    setLocationId(location.id);
    reloadLocations();
  }

  function onBankCreated(account: BankAccount) {
    setBanks((prev) => [...(prev ?? []), account]);
    setBankAccountId(account.id);
    reloadBanks();
  }

  function onStockCreated(record: StockRecord) {
    setStock((prev) => [...(prev ?? []), record]);
    reloadStock();
    const emptyIdx = lines.findIndex((l) => !l.itemId);
    const idx = emptyIdx >= 0 ? emptyIdx : 0;
    updateLine(idx, {
      itemId: productItemId(record),
      unitPrice: record.purchasePrice,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolvedBankId = resolveBankAccountId(
      paymentMethod,
      banks,
      bankAccountId
    );
    const bankError = bankAccountValidationError(
      paymentMethod,
      banks,
      resolvedBankId
    );
    if (bankError) {
      toast.error(bankError);
      return;
    }
    const parsedLines = parseDocumentLines(lines);
    if ("error" in parsedLines) {
      toast.error(parsedLines.error);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        locationId,
        paymentMethod,
        lines: parsedLines.lines,
      };
      if (isPurchase) body.supplierId = partyId;
      else {
        if (partyId) body.customerId = partyId;
        if (allowNegativeStock) body.allowNegativeStock = true;
      }
      if (resolvedBankId) body.bankAccountId = resolvedBankId;

      const endpoint = isPurchase ? "/purchases" : "/sales";
      const res = await api<{ stockWarnings?: string[] }>(endpoint, {
        method: "POST",
        body,
      });
      if (res?.stockWarnings?.length) {
        toast.warning(res.stockWarnings.join("; "));
      } else {
        toast.success(`${isPurchase ? "Purchase" : "Sale"} recorded`);
      }
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <FrappeButtonPrimary type="button">
          <PlusIcon className="size-3.5" />
          Add {isPurchase ? "Purchase" : "Sale"}
        </FrappeButtonPrimary>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-3">
            <DialogTitle className="text-base">
              New {isPurchase ? "Purchase" : "Sales Invoice"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <EntitySelectField
              label={partyLabel}
              required={isPurchase}
              value={partyId}
              onValueChange={setPartyId}
              options={partyOptions}
              listHref={partyListHref}
              listLabel={`All ${partyLabel.toLowerCase()}s`}
              emptyMessage={`Create a ${partyLabel.toLowerCase()} to continue.`}
              quickCreate={
                isPurchase ? (
                  <QuickSupplierDialog
                    onCreated={onPartyCreated}
                  />
                ) : (
                  <QuickCustomerDialog onCreated={onPartyCreated} />
                )
              }
            />
            <EntitySelectField
              label="Location"
              required
              value={locationId}
              onValueChange={setLocationId}
              options={(locations ?? []).map((l) => ({
                id: l.id,
                label: `${l.name} (${l.type})`,
              }))}
              listHref="/locations"
              listLabel="All locations"
              emptyMessage="Add a location first."
              quickCreate={
                <QuickLocationDialog onCreated={onLocationCreated} />
              }
            />
            <div className="grid gap-2">
              <Label>Payment</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) =>
                  onPaymentMethodChange(
                    v as PaymentMethod,
                    setPaymentMethod,
                    setBankAccountId
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showsPaymentAccountPicker(paymentMethod, banks) ? (
              <EntitySelectField
                label={paymentAccountFieldLabel(paymentMethod)}
                required
                value={bankAccountId}
                onValueChange={setBankAccountId}
                options={bankAccountSelectOptions(banks ?? [], bankAccountId)}
                listHref="/banks"
                listLabel="All accounts"
                emptyMessage={
                  paymentMethod === "CASH"
                    ? "Create a cash till under Bank."
                    : "Create a bank account first."
                }
                quickCreate={
                  <QuickBankAccountDialog
                    defaultAccountType={
                      paymentMethod === "CASH" ? "CASH" : "BANK"
                    }
                    onCreated={onBankCreated}
                  />
                }
              />
            ) : null}
            {!isPurchase &&
            hasPermission(user, "sales.negative_stock") ? (
              <div className="flex items-center gap-2">
                <Switch
                  checked={allowNegativeStock}
                  onCheckedChange={setAllowNegativeStock}
                />
                <Label>Allow negative stock</Label>
              </div>
            ) : null}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Line items</Label>
                <div className="flex items-center gap-3">
                  <QuickStockItemDialog
                    locationId={locationId}
                    onCreated={onStockCreated}
                    disabled={!locationId}
                  />
                  <Link
                    href="/inventory"
                    className="text-xs text-[var(--frappe-text-muted)] hover:underline"
                  >
                    Stock ledger
                  </Link>
                </div>
              </div>
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_80px_80px_32px] gap-2"
                >
                  <ItemSearchSelect
                    value={line.itemId}
                    onValueChange={(v) => updateLine(i, { itemId: v })}
                    options={itemOptions}
                    disabled={!locationId}
                    placeholder="Item"
                    className="min-w-0"
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(i, { quantity: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={line.unitPrice}
                    onChange={(e) =>
                      updateLine(i, { unitPrice: e.target.value })
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setLines((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    disabled={lines.length === 1}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { itemId: "", quantity: "1", unitPrice: "" },
                  ])
                }
              >
                Add line
              </Button>
            </div>
          </div>
          <DialogFooter className="border-t border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-3">
            <FrappeButtonPrimary type="submit" disabled={saving}>
              Save
            </FrappeButtonPrimary>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
