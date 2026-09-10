"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuickCustomerDialog } from "@/components/customers/quick-customer-dialog";
import { QuickLocationDialog } from "@/components/locations/quick-location-dialog";
import { QuickBankAccountDialog } from "@/components/banks/quick-bank-account-dialog";
import { QuickStockItemDialog } from "@/components/inventory/quick-stock-item-dialog";
import { EntitySelectField } from "@/components/shared/entity-select-field";
import { ItemSearchSelect } from "@/components/shared/item-search-select";
import { SearchSelect } from "@/components/shared/search-select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { fetchInventoryForLocation } from "@/lib/inventory-fetch";
import { buildItemOptionMap, itemOptionsFromMap, isCoffeeSku, parseDocumentLines, productItemId, resolveItem, stockTransferOptions, type DocumentLineBody } from "@/lib/inventory-items";
import { saleRepUser } from "@/lib/sale-utils";
import { errorMessage } from "@/lib/format";
import {
  COMMISSION_BASIS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from "@/lib/form-select-options";
import { fetchCustomers, partySelectOptions } from "@/lib/party-fetch";
import { requestNotificationsRefresh } from "@/lib/notification-events";
import type {
  BankAccount,
  CommissionBasis,
  Customer,
  Item,
  Location,
  PaymentMethod,
  Sale,
  SaleChannel,
  StockRecord,
  UserAdmin,
} from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

interface LineRow {
  stockId?: string;
  itemId: string;
  lotId?: string | null;
  quantity: string;
  unitPrice: string;
  item?: Item;
}

function linesFromSale(sale: Sale): LineRow[] {
  const rows = (sale.lines ?? []).map((l) => {
    const itemId = productItemId({ itemId: l.itemId, item: l.item });
    return {
      itemId,
      lotId: l.lotId ?? null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      item: l.item ? resolveItem(itemId, l.item) : undefined,
    };
  });
  return rows.length > 0
    ? rows
    : [{ itemId: "", quantity: "1", unitPrice: "" }];
}

export function SaleForm({ sale }: { sale?: Sale }) {
  const router = useRouter();
  const { user } = useAuth();
  const isEdit = !!sale?.id;
  const notesOnly = isEdit && creditHasPayments(sale?.customerCredit);

  const [customerId, setCustomerId] = useState(sale?.customerId ?? "");
  const [locationId, setLocationId] = useState(sale?.locationId ?? "");
  const [channel, setChannel] = useState<SaleChannel>(
    sale?.channel ?? "LOCAL"
  );
  const [itemQuery, setItemQuery] = useState("");
  const debouncedItemQuery = useDebouncedValue(itemQuery, 300);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    sale?.paymentMethod ?? "CASH"
  );
  const [bankAccountId, setBankAccountId] = useState(sale?.bankAccountId ?? "");
  const [creditDueDate, setCreditDueDate] = useState(
    sale?.creditDueDate?.slice(0, 10) ?? ""
  );
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [soldByUserId, setSoldByUserId] = useState(
    () =>
      sale?.soldByUserId ??
      saleRepUser(sale ?? {})?.id ??
      ""
  );
  const [commissionPercent, setCommissionPercent] = useState(() => {
    if (
      sale?.commissionPercent != null &&
      sale.commissionPercent !== ""
    ) {
      return String(sale.commissionPercent);
    }
    return sale ? "" : "10";
  });
  const [commissionBasis, setCommissionBasis] = useState<CommissionBasis>(
    () => sale?.commissionBasis ?? "PROFIT"
  );
  const [notes, setNotes] = useState(sale?.notes ?? "");
  const canOnBehalf = hasPermission(user, "sales.on_behalf");

  /** Rep for API/UI: explicit pick, or logged-in user on new sales once auth loads. */
  const effectiveSoldByUserId =
    soldByUserId ||
    (!isEdit && !notesOnly && user?.id ? user.id : "");

  const [lines, setLines] = useState<LineRow[]>(() =>
    sale ? linesFromSale(sale) : [{ itemId: "", quantity: "1", unitPrice: "" }]
  );
  const [saving, setSaving] = useState(false);

  const {
    data: customers,
    loading: customersLoading,
    reload: reloadCustomers,
    setData: setCustomers,
  } = useFetch(() => fetchCustomers(), []);
  const { data: salesReps } = useFetch(
    () =>
      canOnBehalf && !notesOnly
        ? apiList<UserAdmin>("/users")
        : Promise.resolve([]),
    [canOnBehalf, notesOnly]
  );
  const activeSalesReps = (salesReps ?? []).filter(
    (u) => u.isActive !== false
  );
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
        ? fetchInventoryForLocation(locationId, debouncedItemQuery || undefined)
        : Promise.resolve([]),
    [locationId, debouncedItemQuery]
  );

  const stockItems = stock ?? [];
  const itemMap = buildItemOptionMap(
    stockItems,
    [...lines, ...(sale?.lines ?? [])]
  );
  const itemOptions = itemOptionsFromMap(itemMap);
  const stockOptions = stockTransferOptions(stockItems);

  const customerOptions = partySelectOptions(
    customers ?? [],
    customerId,
    sale?.customer
  );
  const salesRepOptions = (() => {
    const options = activeSalesReps.map((u) => ({
      value: u.id,
      label: u.fullName,
    }));
    if (
      effectiveSoldByUserId &&
      !options.some((option) => option.value === effectiveSoldByUserId)
    ) {
      const rep = saleRepUser(sale ?? {});
      options.unshift({
        value: effectiveSoldByUserId,
        label: rep?.fullName ?? user?.fullName ?? "Selected rep",
      });
    }
    return options;
  })();

  const dataLoading =
    (customers === null && customersLoading) ||
    (locations === null && locationsLoading) ||
    (banks === null && banksLoading);
  const canNegativeStock = hasPermission(user, "sales.negative_stock");

  function onCustomerCreated(customer: Customer) {
    setCustomers((prev) => [...(prev ?? []), customer]);
    setCustomerId(customer.id);
    reloadCustomers();
  }

  function onLocationCreated(location: Location) {
    setLocations((prev) => [...(prev ?? []), location]);
    onLocationChange(location.id);
    reloadLocations();
  }

  function onLocationChange(id: string) {
    setLocationId(id);
    setItemQuery("");
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
      stockId: record.id,
      itemId: productItemId(record),
      lotId: record.lotId ?? null,
      unitPrice: record.purchasePrice,
      item: resolveItem(productItemId(record), record.item),
    });
  }

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );
  }

  function buildBody(
    documentLines: DocumentLineBody[]
  ): Record<string, unknown> | { error: string } {
    const body: Record<string, unknown> = {
      locationId,
      channel,
      paymentMethod,
      notes: notes || undefined,
      lines: documentLines,
    };
    if (customerId) body.customerId = customerId;
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
    if (allowNegativeStock) body.allowNegativeStock = true;
    if (canOnBehalf && effectiveSoldByUserId) {
      body.soldByUserId = effectiveSoldByUserId;
    }
    if (commissionPercent.trim()) {
      const pct = parseFloat(commissionPercent);
      if (!Number.isNaN(pct)) {
        if (pct < 0 || pct > 100) {
          return { error: "Commission must be between 0 and 100." };
        }
        body.commissionPercent = pct;
        body.commissionBasis = commissionBasis;
      }
    }
    return body;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (paymentMethod === "CREDIT" && !customerId) {
      toast.error("Customer is required for credit sales");
      return;
    }
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
    if (canOnBehalf && !notesOnly && !effectiveSoldByUserId) {
      toast.error("Select a sales rep");
      return;
    }
    let body: Record<string, unknown>;
    if (notesOnly) {
      body = { notes: notes || undefined };
    } else {
      for (const line of lines) {
        if (
          line.itemId &&
          isCoffeeSku(line.item?.sku) &&
          !line.lotId
        ) {
          toast.error(
            `${line.item?.description ?? "Coffee item"} requires a lot-linked stock line`
          );
          return;
        }
      }
      const parsedLines = parseDocumentLines(lines);
      if ("error" in parsedLines) {
        toast.error(parsedLines.error);
        return;
      }
      const built = buildBody(parsedLines.lines);
      if ("error" in built && typeof built.error === "string") {
        toast.error(built.error);
        return;
      }
      body = built;
    }
    setSaving(true);
    try {
      if (isEdit && sale) {
        const updated = await api<Sale & { stockWarnings?: string[] }>(
          `/sales/${sale.id}`,
          { method: "PATCH", body }
        );
        if (updated.stockWarnings?.length) {
          toast.warning(updated.stockWarnings.join("; "));
        } else {
          toast.success("Sale updated");
        }
        router.push(`/sales/${sale.id}`);
      } else {
        const res = await api<Sale & { stockWarnings?: string[] }>("/sales", {
          method: "POST",
          body,
        });
        if (res.stockWarnings?.length) {
          toast.warning(res.stockWarnings.join("; "));
        } else {
          toast.success("Sale recorded");
        }
        requestNotificationsRefresh();
        router.push(`/sales/${res.id}`);
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

  const cancelHref = isEdit && sale ? `/sales/${sale.id}` : "/sales";

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
          Customer credit has payments — only notes can be changed.
        </div>
      ) : null}

      <FrappeDocument>
        <FrappeSection
          title="Customer & payment"
          description="Selling location and how this sale is paid"
        >
          <FrappeFormGrid columns={2}>
            <EntitySelectField
              label="Customer"
              required={paymentMethod === "CREDIT" && !notesOnly}
              fullWidth
              value={customerId}
              onValueChange={setCustomerId}
              options={customerOptions}
              searchPlaceholder="Search by name, phone, or email…"
              listHref="/customers"
              listLabel="All customers"
              emptyMessage="Create a customer for credit sales."
              quickCreate={
                notesOnly ? undefined : (
                  <QuickCustomerDialog onCreated={onCustomerCreated} />
                )
              }
              disabled={notesOnly}
            />
            <EntitySelectField
              label="Location"
              required={!notesOnly}
              value={locationId}
              onValueChange={onLocationChange}
              options={(locations ?? []).map((l) => ({
                id: l.id,
                label: `${l.name} (${l.type})`,
              }))}
              listHref="/locations"
              listLabel="All locations"
              emptyMessage="Add a location to sell from."
              quickCreate={
                notesOnly ? undefined : (
                  <QuickLocationDialog onCreated={onLocationCreated} />
                )
              }
              disabled={notesOnly}
            />
            <FrappeField label="Channel" required={!notesOnly}>
              <SearchSelect
                value={channel}
                onValueChange={(v) => setChannel(v as SaleChannel)}
                options={[
                  { value: "LOCAL", label: "Local roast / retail" },
                  { value: "EXPORT", label: "Export" },
                ]}
                searchPlaceholder="Channel…"
                disabled={notesOnly}
              />
            </FrappeField>
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
            {canOnBehalf && !notesOnly ? (
              <FrappeField label="Sales rep" required>
                <SearchSelect
                  value={effectiveSoldByUserId}
                  onValueChange={setSoldByUserId}
                  options={salesRepOptions}
                  placeholder="Select rep"
                  searchPlaceholder="Search by name…"
                  emptyMessage="No active users found."
                />
              </FrappeField>
            ) : null}
            {!notesOnly ? (
              <>
                <FrappeField label="Commission basis">
                  <SearchSelect
                    value={commissionBasis}
                    onValueChange={(v) =>
                      setCommissionBasis(v as CommissionBasis)
                    }
                    options={COMMISSION_BASIS_OPTIONS}
                    searchPlaceholder="Search commission basis…"
                  />
                </FrappeField>
                <FrappeField label="Commission %">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={commissionPercent}
                    onChange={(e) => setCommissionPercent(e.target.value)}
                    placeholder="10"
                  />
                  <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
                    Rate (0–100) applied to{" "}
                    {commissionBasis === "SALES"
                      ? "sale subtotal"
                      : "gross profit"}
                    . Default 10%. Clear for no commission.
                  </p>
                </FrappeField>
              </>
            ) : null}
            {canNegativeStock && !notesOnly ? (
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch
                  id="allow-negative"
                  checked={allowNegativeStock}
                  onCheckedChange={setAllowNegativeStock}
                />
                <Label htmlFor="allow-negative">Allow negative stock</Label>
              </div>
            ) : null}
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
                  : `${stockOptions.length || itemOptions.length} stock line(s) available`
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
                { key: "item", label: "Stock / lot" },
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
                      value={line.stockId || line.itemId}
                      onValueChange={(v) => {
                        const stockRow = stockItems.find((s) => s.id === v);
                        if (stockRow) {
                          updateLine(i, {
                            stockId: stockRow.id,
                            itemId: stockRow.itemId,
                            lotId: stockRow.lotId ?? null,
                            unitPrice:
                              line.unitPrice || stockRow.purchasePrice,
                            item: resolveItem(
                              stockRow.itemId,
                              stockRow.item
                            ),
                          });
                          return;
                        }
                        const item = itemMap.get(v);
                        updateLine(i, {
                          stockId: undefined,
                          itemId: v,
                          lotId: null,
                          item,
                        });
                      }}
                      options={
                        stockOptions.length > 0
                          ? stockOptions.map((o) => ({
                              id: o.id,
                              label: o.label,
                            }))
                          : itemOptions
                      }
                      disabled={!locationId}
                      loading={stockLoading}
                      filterLocally={false}
                      onQueryChange={setItemQuery}
                      placeholder="Item / lot"
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
