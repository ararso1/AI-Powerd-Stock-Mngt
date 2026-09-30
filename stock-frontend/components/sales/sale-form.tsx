"use client";

import { useEffect, useMemo, useState } from "react";
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
import { buildItemOptionMap, itemOptionsFromMap, isCoffeeSku, isSaleStock, parseDocumentLines, productItemId, resolveItem, stockTransferOptions, type DocumentLineBody } from "@/lib/inventory-items";
import { saleRepUser } from "@/lib/sale-utils";
import { errorMessage, formatMoney, formatQty } from "@/lib/format";
import type { CustomerCreditProfile } from "@/lib/types";
import { agingRiskBadgeVariant } from "@/lib/customers";
import { Badge } from "@/components/ui/badge";
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
  /** Set for packaged coffee. Quantity is then a pack count. */
  packSizeKg?: number | null;
  purchasePrice?: string;
}

function packSizeKgOf(item?: Item | null, lot?: { form?: string | null; processMethod?: string | null } | null) {
  const sku = item?.sku?.trim().toUpperCase() ?? "";
  const method = lot?.processMethod ?? "";
  const packaged =
    lot?.form === "PACKAGED" ||
    item?.unit?.toLowerCase() === "pcs" ||
    sku.endsWith("-1KG") ||
    sku.endsWith("-500");
  if (!packaged) return null;
  if (sku.endsWith("-500") || /^0\.5/.test(method)) return 0.5;
  const match = method.match(/([\d.]+)\s*kg/i);
  if (match) {
    const size = parseFloat(match[1]);
    if (size > 0) return size;
  }
  return 1;
}

function lineMeasures(line: LineRow) {
  const qty = parseFloat(line.quantity);
  const count = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const packSize = line.packSizeKg ?? null;
  if (packSize && packSize > 0) {
    return {
      packs: count,
      kg: Math.round((count * packSize + Number.EPSILON) * 1000) / 1000,
    };
  }
  return { packs: null as number | null, kg: count };
}

function lineCaption(line: LineRow) {
  const name = line.item?.description ?? "Item";
  const measure = lineMeasures(line);
  if (measure.packs != null) {
    const packs = formatQty(measure.packs);
    const unit = measure.packs === 1 ? "pack" : "packs";
    return `${name} · ${packs} ${unit} · ${formatQty(measure.kg)} kg`;
  }
  return `${name} · ${formatQty(measure.kg)} kg`;
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
      packSizeKg: packSizeKgOf(l.item, l.lot),
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
  const notesOnly = isEdit && saleNotesOnly(sale);

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
    sale?.creditDueDate?.slice(0, 10) ??
      sale?.credit?.dueDate?.slice(0, 10) ??
      sale?.customerCredit?.dueDate?.slice(0, 10) ??
      ""
  );
  const [amountPaid, setAmountPaid] = useState(() =>
    sale?.paymentMethod === "PARTIAL" && sale.paidAmount
      ? String(sale.paidAmount)
      : ""
  );
  const [creditStanding, setCreditStanding] =
    useState<CustomerCreditProfile | null>(null);
  const [creditStandingLoading, setCreditStandingLoading] = useState(false);

  useEffect(() => {
    if (
      (paymentMethod !== "CREDIT" && paymentMethod !== "PARTIAL") ||
      !customerId
    ) {
      setCreditStanding(null);
      setCreditStandingLoading(false);
      return;
    }
    let cancelled = false;
    setCreditStandingLoading(true);
    api<CustomerCreditProfile>(`/credits/customers/accounts/${customerId}`)
      .then((data) => {
        if (!cancelled) setCreditStanding(data);
      })
      .catch(() => {
        if (!cancelled) setCreditStanding(null);
      })
      .finally(() => {
        if (!cancelled) setCreditStandingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentMethod, customerId]);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [soldByUserId, setSoldByUserId] = useState(
    () =>
      sale?.soldByUserId ??
      saleRepUser(sale ?? {})?.id ??
      ""
  );
  const [commissionEnabled, setCommissionEnabled] = useState(() => {
    const pct = parseFloat(String(sale?.commissionPercent ?? ""));
    return Number.isFinite(pct) && pct > 0;
  });
  const [commissionPercent, setCommissionPercent] = useState(() => {
    if (
      sale?.commissionPercent != null &&
      sale.commissionPercent !== ""
    ) {
      return String(sale.commissionPercent);
    }
    return "10";
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
        ? fetchInventoryForLocation(
            locationId,
            debouncedItemQuery || undefined,
            { forSale: true }
          )
        : Promise.resolve([]),
    [locationId, debouncedItemQuery]
  );

  const stockItems = (stock ?? []).filter((row) => isSaleStock(row));
  const itemMap = buildItemOptionMap(
    stockItems,
    [...lines, ...(sale?.lines ?? [])]
  );
  const itemOptions = itemOptionsFromMap(itemMap);
  const stockOptions = stockTransferOptions(stockItems);
  const summary = useMemo(() => {
    const rows = lines
      .filter((line) => line.itemId)
      .map((line) => {
        const measure = lineMeasures(line);
        const qty = parseFloat(line.quantity);
        const rate = parseFloat(line.unitPrice);
        const amount =
          Number.isFinite(qty) && Number.isFinite(rate) ? qty * rate : 0;
        const cost = parseFloat(line.purchasePrice ?? "");
        const profit =
          Number.isFinite(qty) && Number.isFinite(rate) && Number.isFinite(cost)
            ? amount - qty * cost
            : null;
        return {
          name: line.item?.description ?? "Item",
          packs: measure.packs,
          kg: measure.kg,
          amount,
          profit,
        };
      });
    const subtotal = rows.reduce((sum, row) => sum + row.amount, 0);
    const packs = rows.reduce((sum, row) => sum + (row.packs ?? 0), 0);
    const kg = rows.reduce((sum, row) => sum + row.kg, 0);
    const pct = parseFloat(commissionPercent);
    let commission: number | null = null;
    if (commissionEnabled && Number.isFinite(pct) && pct > 0) {
      if (commissionBasis === "SALES") {
        commission = (subtotal * pct) / 100;
      } else if (rows.every((row) => row.profit != null)) {
        const profit = rows.reduce((sum, row) => sum + (row.profit ?? 0), 0);
        commission = (profit * pct) / 100;
      }
    }
    return { rows, subtotal, packs, kg, commission };
  }, [lines, commissionEnabled, commissionPercent, commissionBasis]);

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
    if (paymentMethod === "PARTIAL") {
      body.amountPaid = parseFloat(amountPaid);
    }
    if (
      (paymentMethod === "CREDIT" || paymentMethod === "PARTIAL") &&
      creditDueDate
    ) {
      body.creditDueDate = creditDueDate;
    }
    if (allowNegativeStock) body.allowNegativeStock = true;
    if (canOnBehalf && effectiveSoldByUserId) {
      body.soldByUserId = effectiveSoldByUserId;
    }
    if (commissionEnabled) {
      const pct = parseFloat(commissionPercent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        return { error: "Enter a commission percentage from 0.01 to 100." };
      }
      body.commissionPercent = pct;
      body.commissionBasis = commissionBasis;
    } else {
      body.commissionPercent = 0;
    }
    return body;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      (paymentMethod === "CREDIT" || paymentMethod === "PARTIAL") &&
      !customerId
    ) {
      toast.error(
        paymentMethod === "PARTIAL"
          ? "Customer is required when part of the sale stays on credit"
          : "Customer is required for credit sales"
      );
      return;
    }
    if (paymentMethod === "PARTIAL" && !notesOnly) {
      const paid = parseFloat(amountPaid);
      if (Number.isNaN(paid) || paid <= 0) {
        toast.error("Enter the amount paid");
        return;
      }
      if (!(paid < summary.subtotal)) {
        toast.error("Amount paid must be less than the sale total");
        return;
      }
      if (!creditDueDate) {
        toast.error("Enter the due date for the remaining credit");
        return;
      }
    }
    const creditCharge =
      paymentMethod === "PARTIAL"
        ? Math.max(0, summary.subtotal - (parseFloat(amountPaid) || 0))
        : summary.subtotal;
    if (
      (paymentMethod === "CREDIT" || paymentMethod === "PARTIAL") &&
      customerId &&
      !notesOnly
    ) {
      if (creditStandingLoading) {
        toast.error("Customer credit is still loading");
        return;
      }
      const standing = creditStanding;
      const saleCredit = creditCharge;
      let available =
        standing?.availableCredit != null
          ? parseFloat(standing.availableCredit)
          : null;
      const sameCustomer = sale?.customerId === customerId;
      const existingBalance = parseFloat(sale?.customerCredit?.balance ?? "");
      if (
        sameCustomer &&
        Number.isFinite(existingBalance) &&
        available != null
      ) {
        available += existingBalance;
      }
      if (standing && standing.creditLimit == null) {
        toast.error("Set a credit limit on this customer before a credit sale");
        return;
      }
      if (available != null && saleCredit > available + 0.009) {
        toast.error(
          `This credit sale is ${formatMoney(saleCredit)} and available credit is ${formatMoney(available)}`
        );
        return;
      }
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
              required={
                (paymentMethod === "CREDIT" || paymentMethod === "PARTIAL") &&
                !notesOnly
              }
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
                onValueChange={(v) => {
                  const method = v as PaymentMethod;
                  onPaymentMethodChange(
                    method,
                    setPaymentMethod,
                    setBankAccountId
                  );
                  if (method !== "PARTIAL") setAmountPaid("");
                }}
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
            {paymentMethod === "PARTIAL" ? (
              <>
                <FrappeField
                  label="Amount paid"
                  required={!notesOnly}
                  hint="The rest stays on customer credit"
                >
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0.00"
                    disabled={notesOnly}
                    required={!notesOnly}
                  />
                </FrappeField>
                <FrappeField label="Remaining credit due date" required={!notesOnly}>
                  <Input
                    type="date"
                    value={creditDueDate}
                    onChange={(e) => setCreditDueDate(e.target.value)}
                    disabled={notesOnly}
                    required={!notesOnly}
                  />
                </FrappeField>
              </>
            ) : null}
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
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch
                  id="sale-commission"
                  checked={commissionEnabled}
                  onCheckedChange={setCommissionEnabled}
                />
                <Label htmlFor="sale-commission">Commission</Label>
              </div>
            ) : null}
            {!notesOnly && commissionEnabled ? (
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
                    .
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

        {(paymentMethod === "CREDIT" || paymentMethod === "PARTIAL") &&
        customerId ? (
          <CustomerCreditStanding
            standing={creditStanding}
            loading={creditStandingLoading}
            saleTotal={
              paymentMethod === "PARTIAL"
                ? Math.max(0, summary.subtotal - (parseFloat(amountPaid) || 0))
                : summary.subtotal
            }
            chargeLabel={
              paymentMethod === "PARTIAL" ? "Remaining credit" : "This sale"
            }
            heldBalance={
              sale?.customerId === customerId
                ? parseFloat(sale?.customerCredit?.balance ?? "")
                : 0
            }
          />
        ) : null}

        {!notesOnly ? (
          <FrappeSection
            title="Items"
            description={
              locationId
                ? stockLoading
                  ? "Loading stock at location…"
                  : stockOptions.length > 0
                    ? `${stockOptions.length} processed or reject stock line(s) available`
                    : "No processed or reject stock at this location"
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
                            purchasePrice: stockRow.purchasePrice,
                            item: resolveItem(
                              stockRow.itemId,
                              stockRow.item
                            ),
                            packSizeKg: packSizeKgOf(stockRow.item, stockRow.lot),
                          });
                          return;
                        }
                        const item = itemMap.get(v);
                        updateLine(i, {
                          stockId: undefined,
                          itemId: v,
                          lotId: null,
                          item,
                          packSizeKg: packSizeKgOf(item, null),
                        });
                      }}
                      options={
                        stockOptions.length > 0
                          ? stockOptions.map((o) => ({
                              itemId: o.id,
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
                    {line.itemId ? (
                      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
                        {lineCaption(line)}
                      </p>
                    ) : null}
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

        {!notesOnly ? (
          <FrappeSection
            title="Summary"
            description="Selected items, packs, kilograms, and amount"
          >
            {summary.rows.length === 0 ? (
              <p className="text-sm text-[var(--frappe-text-muted)]">
                Select an item to see its name, packs, and kilograms here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="frappe-list-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="text-right">Packs</th>
                      <th className="text-right">Kg</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.map((row, index) => (
                      <tr key={`${row.name}-${index}`}>
                        <td>{row.name}</td>
                        <td className="text-right tabular-nums">
                          {row.packs != null ? formatQty(row.packs) : "—"}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatQty(row.kg)}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatMoney(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="font-medium">Total</td>
                      <td className="text-right font-medium tabular-nums">
                        {summary.packs > 0 ? formatQty(summary.packs) : "—"}
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        {formatQty(summary.kg)}
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        {formatMoney(summary.subtotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {commissionEnabled ? (
                  <p className="mt-3 text-sm text-[var(--frappe-text-muted)]">
                    Commission{" "}
                    {summary.commission != null
                      ? formatMoney(summary.commission)
                      : "—"}{" "}
                    at {commissionPercent || "0"}% of{" "}
                    {commissionBasis === "SALES" ? "the sale amount" : "profit"}.
                  </p>
                ) : null}
              </div>
            )}
          </FrappeSection>
        ) : null}
      </FrappeDocument>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FrappeButtonPrimary type="submit" disabled={saving}>
          {saving ? <Spinner className="size-4" /> : "Save"}
        </FrappeButtonPrimary>
        <FrappeButtonLink href={cancelHref}>Cancel</FrappeButtonLink>
      </div>
    </form>
  );
}

function saleNotesOnly(sale?: Sale): boolean {
  if (!sale) return false;
  const credit = sale.credit ?? sale.customerCredit;
  const creditPaid = parseFloat(credit?.paidAmount ?? "0");
  if (!Number.isFinite(creditPaid) || creditPaid <= 0) return false;
  if (sale.paymentMethod === "PARTIAL") {
    const deposit = parseFloat(sale.paidAmount ?? "0");
    return creditPaid > deposit + 0.009;
  }
  return creditHasPayments(credit);
}

function CustomerCreditStanding({
  standing,
  loading,
  saleTotal,
  heldBalance,
  chargeLabel = "This sale",
}: {
  standing: CustomerCreditProfile | null;
  loading: boolean;
  saleTotal: number;
  heldBalance: number;
  chargeLabel?: string;
}) {
  if (loading && !standing) {
    return (
      <FrappeSection title="Customer credit">
        <p className="text-sm text-[var(--frappe-text-muted)]">
          Loading credit standing…
        </p>
      </FrappeSection>
    );
  }
  if (!standing) {
    return (
      <FrappeSection title="Customer credit">
        <p className="text-sm text-[var(--frappe-text-muted)]">
          Credit standing could not be loaded.
        </p>
      </FrappeSection>
    );
  }

  const availableRaw =
    standing.availableCredit != null ? parseFloat(standing.availableCredit) : null;
  const available =
    availableRaw != null && Number.isFinite(heldBalance)
      ? availableRaw + (Number.isFinite(heldBalance) ? heldBalance : 0)
      : availableRaw;
  const over =
    available != null && saleTotal > available + 0.009 && saleTotal > 0;
  const open = standing.eligibleIncreasePercent != null;
  const increaseLabel =
    standing.eligibleIncreasePercent != null &&
    standing.eligibleIncreasePercent > 0
      ? `${standing.eligibleIncreasePercent}% of the initial limit (${formatMoney(standing.eligibleIncrease ?? 0)}) if this balance is fully repaid now`
      : open
        ? "No limit increase — repayment is past the 30-day Attention window"
        : null;

  return (
    <FrappeSection
      title="Customer credit"
      description="Limit, aging, and the increase earned when the balance is fully repaid"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CreditStat
          label="Credit limit"
          value={
            standing.creditLimit != null
              ? formatMoney(standing.creditLimit)
              : "Not set"
          }
          hint={
            standing.initialCreditLimit
              ? `Initial ${formatMoney(standing.initialCreditLimit)}`
              : undefined
          }
        />
        <CreditStat
          label="Used credit"
          value={formatMoney(standing.usedCredit ?? standing.outstanding)}
        />
        <CreditStat
          label="Available credit"
          value={available != null ? formatMoney(available) : "—"}
        />
        <div className="rounded border border-[var(--frappe-border)] p-3">
          <p className="text-xs text-[var(--frappe-text-muted)]">Aging status</p>
          <div className="mt-1">
            <Badge variant={agingRiskBadgeVariant(standing.agingStatus)}>
              {standing.agingStatus ?? "Clear"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
            {standing.agingDays != null
              ? `${standing.agingLabel ?? ""} · ${standing.agingDays} days`.trim()
              : "No open credit"}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <p>
          Repayment score{" "}
          <span className="font-semibold tabular-nums">
            {standing.creditScore != null ? standing.creditScore : "—"}
          </span>
          {standing.creditScore == null ? " · no fully repaid credit yet" : " / 100"}
        </p>
        {increaseLabel ? <p>Eligible limit increase: {increaseLabel}.</p> : null}
        {!open && standing.normalIncrease ? (
          <p>
            Next full repayment: within 15 days (Normal) adds{" "}
            {formatMoney(standing.normalIncrease)} (10% of the initial limit);
            within 30 days (Attention) adds{" "}
            {formatMoney(standing.attentionIncrease ?? 0)} (5%).
          </p>
        ) : null}
        {standing.lastLimitIncreasePercent != null &&
        parseFloat(standing.lastLimitIncrease ?? "0") > 0 ? (
          <p>
            Last increase: {standing.lastLimitIncreasePercent}% (
            {formatMoney(standing.lastLimitIncrease ?? 0)}) after repayment in{" "}
            {standing.lastRepaymentDays ?? "—"} days
            {standing.lastRepaymentRisk
              ? ` (${standing.lastRepaymentRisk})`
              : ""}
            .
          </p>
        ) : null}
        {over ? (
          <p className="text-[var(--frappe-red)]">
            {chargeLabel} ({formatMoney(saleTotal)}) is above available credit.
          </p>
        ) : null}
        {standing.creditLimit == null ? (
          <p className="text-[var(--frappe-text-muted)]">
            Set a credit limit on the customer before recording a credit sale.
          </p>
        ) : null}
      </div>
    </FrappeSection>
  );
}

function CreditStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded border border-[var(--frappe-border)] p-3">
      <p className="text-xs text-[var(--frappe-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
