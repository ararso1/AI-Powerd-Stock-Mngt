"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuickSupplierDialog } from "@/components/suppliers/quick-supplier-dialog";
import { QuickLocationDialog } from "@/components/locations/quick-location-dialog";
import { QuickBankAccountDialog } from "@/components/banks/quick-bank-account-dialog";
import { QuickStockItemDialog } from "@/components/inventory/quick-stock-item-dialog";
import { EntitySelectField } from "@/components/shared/entity-select-field";
import { ItemSearchSelect } from "@/components/shared/item-search-select";
import { SearchSelect } from "@/components/shared/search-select";
import { Input } from "@/components/ui/input";
import {
  FrappeDocument,
  FrappeField,
  FrappeFormGrid,
  FrappeFormToolbar,
  FrappeGridCell,
  FrappeGridRow,
  FrappeGridTable,
  FrappeSection,
  FrappeButtonPrimary,
  FrappeButtonLink,
} from "@/components/frappe";
import { api } from "@/lib/api";
import { apiList } from "@/lib/list-response";
import { fetchInventoryForLocation } from "@/lib/inventory-fetch";
import { creditHasPayments, needsBankAccount } from "@/lib/document-utils";
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
import { buildItemOptionMap, itemOptionsFromMap, parseDocumentLines, productItemId, resolveItem, type DocumentLineBody } from "@/lib/inventory-items";
import { errorMessage } from "@/lib/format";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/form-select-options";
import { fetchSuppliers, partySelectOptions } from "@/lib/party-fetch";
import { requestNotificationsRefresh } from "@/lib/notification-events";
import type {
  BankAccount,
  Item,
  Location,
  PaymentMethod,
  Purchase,
  StockRecord,
  Supplier,
} from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

interface LineRow {
  itemId: string;
  quantity: string;
  unitPrice: string;
  item?: Item;
}

function linesFromPurchase(purchase: Purchase): LineRow[] {
  const rows = (purchase.lines ?? []).map((l) => {
    const itemId = productItemId({ itemId: l.itemId, item: l.item });
    return {
      itemId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      item: l.item ? resolveItem(itemId, l.item) : undefined,
    };
  });
  return rows.length > 0
    ? rows
    : [{ itemId: "", quantity: "1", unitPrice: "" }];
}

export function PurchaseForm({ purchase }: { purchase?: Purchase }) {
  const router = useRouter();
  const isEdit = !!purchase?.id;
  const notesOnly = isEdit && creditHasPayments(purchase?.supplierCredit);

  const [supplierId, setSupplierId] = useState(purchase?.supplierId ?? "");
  const [locationId, setLocationId] = useState(purchase?.locationId ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    purchase?.paymentMethod ?? "CASH"
  );
  const [bankAccountId, setBankAccountId] = useState(
    purchase?.bankAccountId ?? ""
  );
  const [creditDueDate, setCreditDueDate] = useState(
    purchase?.creditDueDate?.slice(0, 10) ?? ""
  );
  const [notes, setNotes] = useState(purchase?.notes ?? "");
  const [lines, setLines] = useState<LineRow[]>(() =>
    purchase ? linesFromPurchase(purchase) : [{ itemId: "", quantity: "1", unitPrice: "" }]
  );
  const [saving, setSaving] = useState(false);

  const {
    data: suppliers,
    loading: suppliersLoading,
    reload: reloadSuppliers,
    setData: setSuppliers,
  } = useFetch(() => fetchSuppliers(), []);
  const {
    data: locations,
    loading: locationsLoading,
    reload: reloadLocations,
    setData: setLocations,
  } = useLocations();
  const paymentAccountType = bankAccountTypeForPayment(paymentMethod);
  const {
    data: banks,
    loading: banksLoading,
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
    loading: stockLoading,
    reload: reloadStock,
    setData: setStock,
  } = useFetch(
    () =>
      locationId
        ? fetchInventoryForLocation(locationId)
        : Promise.resolve([]),
    [locationId]
  );

  const stockItems = stock ?? [];
  const itemMap = buildItemOptionMap(
    stockItems,
    [...lines, ...(purchase?.lines ?? [])]
  );
  const itemOptions = itemOptionsFromMap(itemMap);

  const supplierOptions = partySelectOptions(
    suppliers ?? [],
    supplierId,
    purchase?.supplier
  );

  const dataLoading =
    (suppliers === null && suppliersLoading) ||
    (locations === null && locationsLoading) ||
    (banks === null && banksLoading);

  function onSupplierCreated(supplier: Supplier) {
    setSuppliers((prev) => [...(prev ?? []), supplier]);
    setSupplierId(supplier.id);
    reloadSuppliers();
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
      item: resolveItem(productItemId(record), record.item),
    });
  }

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );
  }

  function buildBody(documentLines: DocumentLineBody[]): Record<string, unknown> {
    const body: Record<string, unknown> = {
      supplierId,
      locationId,
      paymentMethod,
      notes: notes || undefined,
      lines: documentLines,
    };
    if (needsBankAccount(paymentMethod)) {
      body.bankAccountId = resolveBankAccountId(
        paymentMethod,
        banks,
        bankAccountId
      );
    }
    if (paymentMethod === "CREDIT" && creditDueDate) {
      body.creditDueDate = creditDueDate;
    }
    return body;
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
    let body: Record<string, unknown>;
    if (notesOnly) {
      body = { notes: notes || undefined };
    } else {
      const parsedLines = parseDocumentLines(lines);
      if ("error" in parsedLines) {
        toast.error(parsedLines.error);
        return;
      }
      body = buildBody(parsedLines.lines);
    }
    setSaving(true);
    try {
      if (isEdit && purchase) {
        await api<Purchase>(`/purchases/${purchase.id}`, {
          method: "PATCH",
          body,
        });
        toast.success("Purchase updated");
        router.push(`/purchases/${purchase.id}`);
      } else {
        const created = await api<Purchase>("/purchases", {
          method: "POST",
          body,
        });
        toast.success("Purchase recorded");
        requestNotificationsRefresh();
        router.push(`/purchases/${created.id}`);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (dataLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8" />
      </div>
    );
  }

  const cancelHref = isEdit && purchase ? `/purchases/${purchase.id}` : "/purchases";

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-5xl">
      <FrappeFormToolbar>
        <FrappeButtonPrimary type="submit" disabled={saving}>
          {saving ? <Spinner className="size-4" /> : "Save"}
        </FrappeButtonPrimary>
        <FrappeButtonLink href={cancelHref}>Cancel</FrappeButtonLink>
      </FrappeFormToolbar>

      {notesOnly ? (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Supplier credit has payments — only notes can be changed.
        </div>
      ) : null}

      <FrappeDocument>
        <FrappeSection
          title="Supplier & payment"
          description="Receiving location and how this purchase is paid"
        >
          <FrappeFormGrid columns={2}>
            <EntitySelectField
              label="Supplier"
              required={!notesOnly}
              fullWidth
              value={supplierId}
              onValueChange={setSupplierId}
              options={supplierOptions}
              searchPlaceholder="Search by name, phone, or email…"
              listHref="/suppliers"
              listLabel="All suppliers"
              emptyMessage="Create a supplier to record this purchase."
              quickCreate={
                notesOnly ? undefined : (
                  <QuickSupplierDialog onCreated={onSupplierCreated} />
                )
              }
              disabled={notesOnly}
            />
            <EntitySelectField
              label="Location"
              required={!notesOnly}
              value={locationId}
              onValueChange={setLocationId}
              options={(locations ?? []).map((l) => ({
                id: l.id,
                label: `${l.name} (${l.type})`,
              }))}
              listHref="/locations"
              listLabel="All locations"
              emptyMessage="Add a warehouse or showroom to receive stock."
              quickCreate={
                notesOnly ? undefined : (
                  <QuickLocationDialog onCreated={onLocationCreated} />
                )
              }
              disabled={notesOnly}
            />
            <FrappeField label="Payment method" required={!notesOnly}>
              <SearchSelect
                value={paymentMethod}
                onValueChange={(v) =>
                  onPaymentMethodChange(
                    v as PaymentMethod,
                    setPaymentMethod,
                    setBankAccountId
                  )
                }
                options={PAYMENT_METHOD_OPTIONS}
                searchPlaceholder="Search payment method…"
                disabled={notesOnly}
              />
            </FrappeField>
            {showsPaymentAccountPicker(paymentMethod, banks) ? (
              <EntitySelectField
                label={paymentAccountFieldLabel(paymentMethod)}
                required={!notesOnly}
                value={bankAccountId}
                onValueChange={setBankAccountId}
                options={bankAccountSelectOptions(banks ?? [], bankAccountId)}
                listHref="/banks"
                listLabel="All accounts"
                emptyMessage={
                  paymentMethod === "CASH"
                    ? "Create a cash till (CASH account type) under Bank."
                    : "Create a bank account (BANK account type) under Bank."
                }
                quickCreate={
                  notesOnly ? undefined : (
                    <QuickBankAccountDialog
                      defaultAccountType={
                        paymentMethod === "CASH" ? "CASH" : "BANK"
                      }
                      onCreated={onBankCreated}
                    />
                  )
                }
                disabled={notesOnly}
              />
            ) : paymentMethod === "CREDIT" ? (
              <FrappeField label="Credit due date">
                <Input
                  type="date"
                  value={creditDueDate}
                  onChange={(e) => setCreditDueDate(e.target.value)}
                  disabled={notesOnly}
                />
              </FrappeField>
            ) : (
              <div className="hidden md:block" />
            )}
            <FrappeField label="Notes" fullWidth>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional reference"
              />
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>

        {!notesOnly ? (
          <FrappeSection
            title="Items"
            description={
              locationId
                ? stockLoading
                  ? "Loading stock at location…"
                  : `${itemOptions.length} item(s) available`
                : "Select a location first"
            }
          >
            <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
              <QuickStockItemDialog
                locationId={locationId}
                onCreated={onStockCreated}
                disabled={!locationId}
              />
              <Link
                href={locationId ? `/inventory` : "#"}
                onClick={(e) => {
                  if (!locationId) e.preventDefault();
                }}
                className="text-xs text-[var(--frappe-text-muted)] hover:text-[var(--frappe-primary)] hover:underline"
              >
                Stock ledger
              </Link>
            </div>
            <FrappeGridTable
              columns={[
                { key: "item", label: "Item" },
                { key: "qty", label: "Qty", className: "w-28" },
                { key: "rate", label: "Rate", className: "w-32" },
              ]}
              onAddRow={() =>
                setLines((prev) => [
                  ...prev,
                  { itemId: "", quantity: "1", unitPrice: "" },
                ])
              }
              addLabel="Add Row"
            >
              {lines.map((line, i) => (
                <FrappeGridRow
                  key={i}
                  canRemove={lines.length > 1}
                  onRemove={() =>
                    setLines((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  <FrappeGridCell>
                    <ItemSearchSelect
                      value={line.itemId}
                      onValueChange={(v) => {
                        const item = itemMap.get(v);
                        updateLine(i, { itemId: v, item });
                      }}
                      options={itemOptions}
                      disabled={!locationId || stockLoading}
                      placeholder="Item"
                    />
                  </FrappeGridCell>
                  <FrappeGridCell>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      className="h-8"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(i, { quantity: e.target.value })
                      }
                      required
                    />
                  </FrappeGridCell>
                  <FrappeGridCell>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      className="h-8"
                      value={line.unitPrice}
                      onChange={(e) =>
                        updateLine(i, { unitPrice: e.target.value })
                      }
                      required
                    />
                  </FrappeGridCell>
                </FrappeGridRow>
              ))}
            </FrappeGridTable>
          </FrappeSection>
        ) : null}
      </FrappeDocument>
    </form>
  );
}
