"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuickSupplierDialog } from "@/components/suppliers/quick-supplier-dialog";
import { QuickLocationDialog } from "@/components/locations/quick-location-dialog";
import { QuickBankAccountDialog } from "@/components/banks/quick-bank-account-dialog";
import { QuickStockItemDialog } from "@/components/inventory/quick-stock-item-dialog";
import { QuickLotDialog } from "@/components/lots/create-lot-dialog";
import { EntitySelectField } from "@/components/shared/entity-select-field";
import { ItemSearchSelect } from "@/components/shared/item-search-select";
import { SearchSelect } from "@/components/shared/search-select";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { buildLotsListPath } from "@/lib/list-query";
import { fetchInventoryForLocation } from "@/lib/inventory-fetch";
import {
  createsPurchaseCredit,
  needsBankAccount,
  purchaseNotesOnly,
} from "@/lib/document-utils";
import { formatMoney } from "@/lib/format";
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
  buildItemOptionMap,
  itemOptionsFromMap,
  isCoffeeSku,
  parseDocumentLines,
  productItemId,
  resolveItem,
  type DocumentLineBody,
} from "@/lib/inventory-items";
import { errorMessage } from "@/lib/format";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/form-select-options";
import { PURCHASE_TYPE_OPTIONS } from "@/lib/purchases";
import { fetchSuppliers, partySelectOptions } from "@/lib/party-fetch";
import { requestNotificationsRefresh } from "@/lib/notification-events";
import type {
  BankAccount,
  Item,
  Location,
  Lot,
  PaymentMethod,
  Purchase,
  PurchaseQualityResult,
  PurchaseType,
  StockRecord,
  Supplier,
} from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

interface QualityFormState {
  labName: string;
  testedAt: string;
  certificateNumber: string;
  grade: string;
  moisturePercent: string;
  screenSize: string;
  cuppingScore: string;
  defectCount: string;
  defectLevel: string;
  /** "" = unset, "true" / "false" */
  passed: "" | "true" | "false";
  notes: string;
}

interface LineRow {
  itemId: string;
  lotId?: string | null;
  quantity: string;
  unitPrice: string;
  item?: Item;
  lot?: Lot | null;
  quality: QualityFormState;
  qualityFile?: File | null;
}

function emptyQuality(): QualityFormState {
  return {
    labName: "ECTA",
    testedAt: "",
    certificateNumber: "",
    grade: "",
    moisturePercent: "",
    screenSize: "",
    cuppingScore: "",
    defectCount: "",
    defectLevel: "",
    passed: "",
    notes: "",
  };
}

function qualityFromResult(
  q?: PurchaseQualityResult | null
): QualityFormState {
  if (!q) return emptyQuality();
  return {
    labName: q.labName?.trim() || "ECTA",
    testedAt: q.testedAt?.slice(0, 10) ?? "",
    certificateNumber: q.certificateNumber ?? "",
    grade: q.grade ?? "",
    moisturePercent:
      q.moisturePercent != null && q.moisturePercent !== ""
        ? String(q.moisturePercent)
        : "",
    screenSize: q.screenSize ?? "",
    cuppingScore:
      q.cuppingScore != null && q.cuppingScore !== ""
        ? String(q.cuppingScore)
        : "",
    defectCount:
      q.defectCount != null ? String(q.defectCount) : "",
    defectLevel: q.defectLevel ?? "",
    passed:
      q.passed === true ? "true" : q.passed === false ? "false" : "",
    notes: q.notes ?? "",
  };
}

function qualityHasContent(
  q: QualityFormState,
  file?: File | null
): boolean {
  if (file) return true;
  const lab = q.labName.trim();
  return Boolean(
    q.testedAt ||
      q.certificateNumber.trim() ||
      q.grade.trim() ||
      q.moisturePercent.trim() ||
      q.screenSize.trim() ||
      q.cuppingScore.trim() ||
      q.defectCount.trim() ||
      q.defectLevel.trim() ||
      q.passed ||
      q.notes.trim() ||
      (lab && lab.toUpperCase() !== "ECTA")
  );
}

function buildQualityPayload(
  q: QualityFormState
): Record<string, unknown> | undefined {
  if (!qualityHasContent(q)) return undefined;
  const payload: Record<string, unknown> = {};
  if (q.labName.trim()) payload.labName = q.labName.trim();
  if (q.testedAt) payload.testedAt = q.testedAt;
  if (q.certificateNumber.trim()) {
    payload.certificateNumber = q.certificateNumber.trim();
  }
  if (q.grade.trim()) payload.grade = q.grade.trim();
  if (q.moisturePercent.trim()) {
    const n = parseFloat(q.moisturePercent);
    if (!Number.isNaN(n)) payload.moisturePercent = n;
  }
  if (q.screenSize.trim()) payload.screenSize = q.screenSize.trim();
  if (q.cuppingScore.trim()) {
    const n = parseFloat(q.cuppingScore);
    if (!Number.isNaN(n)) payload.cuppingScore = n;
  }
  if (q.defectCount.trim()) {
    const n = parseInt(q.defectCount, 10);
    if (!Number.isNaN(n)) payload.defectCount = n;
  }
  if (q.defectLevel.trim()) payload.defectLevel = q.defectLevel.trim();
  if (q.passed === "true") payload.passed = true;
  if (q.passed === "false") payload.passed = false;
  if (q.notes.trim()) payload.notes = q.notes.trim();
  return Object.keys(payload).length > 0 ? payload : undefined;
}

function appendQualityFormData(form: FormData, q: QualityFormState) {
  const payload = buildQualityPayload(q);
  if (!payload) {
    if (q.labName.trim()) form.append("labName", q.labName.trim());
    return;
  }
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    form.append(key, String(value));
  }
}

function linesFromPurchase(purchase: Purchase): LineRow[] {
  const rows = (purchase.lines ?? []).map((l) => {
    const itemId = productItemId({ itemId: l.itemId, item: l.item });
    return {
      itemId,
      lotId: l.lotId ?? null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      item: l.item ? resolveItem(itemId, l.item) : undefined,
      lot: l.lot ?? null,
      quality: qualityFromResult(l.quality),
      qualityFile: null,
    };
  });
  return rows.length > 0
    ? rows
    : [
        {
          itemId: "",
          quantity: "1",
          unitPrice: "",
          quality: emptyQuality(),
        },
      ];
}

function lineTotal(row: LineRow): number {
  const qty = parseFloat(row.quantity);
  const rate = parseFloat(row.unitPrice);
  if (Number.isNaN(qty) || Number.isNaN(rate)) return 0;
  return qty * rate;
}

function emptyLine(): LineRow {
  return {
    itemId: "",
    lotId: null,
    quantity: "1",
    unitPrice: "",
    quality: emptyQuality(),
    qualityFile: null,
  };
}

function lotOptionLabel(lot: Lot): string {
  return [lot.code, lot.grade, lot.form, lot.region]
    .filter(Boolean)
    .join(" · ");
}

async function uploadPendingQualityFiles(
  purchase: Purchase,
  formLines: LineRow[]
) {
  const serverLines = purchase.lines ?? [];
  const usedIds = new Set<string>();

  for (const formLine of formLines) {
    if (!formLine.qualityFile || !formLine.itemId) continue;
    const match =
      serverLines.find(
        (l) =>
          l.id &&
          !usedIds.has(l.id) &&
          productItemId(l) === formLine.itemId &&
          (formLine.lotId
            ? l.lotId === formLine.lotId
            : !l.lotId)
      ) ??
      serverLines.find(
        (l) =>
          l.id &&
          !usedIds.has(l.id) &&
          productItemId(l) === formLine.itemId
      );
    if (!match?.id) continue;
    usedIds.add(match.id);

    const form = new FormData();
    form.append("file", formLine.qualityFile);
    appendQualityFormData(form, formLine.quality);
    await api(`/purchases/${purchase.id}/lines/${match.id}/quality`, {
      method: "PUT",
      body: form,
    });
  }
}

export function PurchaseForm({ purchase }: { purchase?: Purchase }) {
  const router = useRouter();
  const isEdit = !!purchase?.id;
  const notesOnly = isEdit && purchaseNotesOnly(purchase);

  const [supplierId, setSupplierId] = useState(purchase?.supplierId ?? "");
  const [locationId, setLocationId] = useState(purchase?.locationId ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    purchase?.paymentMethod ?? "CASH"
  );
  const [purchaseType, setPurchaseType] = useState<PurchaseType>(
    purchase?.purchaseType ?? "LOCAL"
  );
  const [bankAccountId, setBankAccountId] = useState(
    purchase?.bankAccountId ?? ""
  );
  const [amountPaid, setAmountPaid] = useState(() => {
    if (purchase?.paymentMethod === "PARTIAL" && purchase.paidAmount) {
      return String(Number(purchase.paidAmount));
    }
    return "";
  });
  const [creditDueDate, setCreditDueDate] = useState(
    purchase?.creditDueDate?.slice(0, 10) ??
      purchase?.credit?.dueDate?.slice(0, 10) ??
      purchase?.supplierCredit?.dueDate?.slice(0, 10) ??
      ""
  );
  const [notes, setNotes] = useState(purchase?.notes ?? "");
  const [lines, setLines] = useState<LineRow[]>(() =>
    purchase ? linesFromPurchase(purchase) : [emptyLine()]
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

  const {
    data: lots,
    loading: lotsLoading,
    reload: reloadLots,
    setData: setLots,
  } = useFetch(
    () =>
      locationId
        ? apiList<Lot>(
            buildLotsListPath({ locationId }, 1, 100)
          )
        : Promise.resolve([]),
    [locationId]
  );

  const stockItems = stock ?? [];
  const itemMap = buildItemOptionMap(
    stockItems,
    [...lines, ...(purchase?.lines ?? [])]
  );
  const itemOptions = itemOptionsFromMap(itemMap);
  const lotList = lots ?? [];

  const supplierOptions = partySelectOptions(
    suppliers ?? [],
    supplierId,
    purchase?.supplier
  );

  const purchaseTotal = useMemo(
    () => lines.reduce((sum, row) => sum + lineTotal(row), 0),
    [lines]
  );

  const paidPreview = useMemo(() => {
    if (paymentMethod === "CREDIT") return 0;
    if (paymentMethod === "CASH" || paymentMethod === "BANK") {
      return purchaseTotal;
    }
    const paid = parseFloat(amountPaid);
    return Number.isNaN(paid) ? 0 : paid;
  }, [paymentMethod, purchaseTotal, amountPaid]);

  const creditPreview = Math.max(0, purchaseTotal - paidPreview);

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
      lotId: null,
      lot: null,
    });
  }

  function onLotCreated(lineIndex: number, lot: Lot) {
    setLots((prev) => {
      const list = prev ?? [];
      if (list.some((l) => l.id === lot.id)) return list;
      return [...list, lot];
    });
    reloadLots();
    updateLine(lineIndex, {
      lotId: lot.id,
      lot,
    });
  }

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );
  }

  function updateLineQuality(i: number, patch: Partial<QualityFormState>) {
    setLines((prev) =>
      prev.map((row, idx) =>
        idx === i
          ? { ...row, quality: { ...row.quality, ...patch } }
          : row
      )
    );
  }

  function lotOptionsForLine(line: LineRow) {
    const filtered = lotList.filter(
      (lot) =>
        !line.itemId ||
        !lot.itemId ||
        lot.itemId === line.itemId
    );
    const selected = line.lotId
      ? lotList.find((l) => l.id === line.lotId) ?? line.lot
      : null;
    const map = new Map(filtered.map((l) => [l.id, l]));
    if (selected && !map.has(selected.id)) {
      map.set(selected.id, selected);
    }
    return Array.from(map.values()).map((lot) => ({
      id: lot.id,
      label: lotOptionLabel(lot),
    }));
  }

  function handlePaymentMethodChange(method: PaymentMethod) {
    onPaymentMethodChange(method, setPaymentMethod, setBankAccountId);
    if (method !== "PARTIAL") setAmountPaid("");
  }

  function buildBody(
    documentLines: Array<
      DocumentLineBody & { quality?: Record<string, unknown> }
    >
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      supplierId,
      locationId,
      purchaseType,
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
    if (paymentMethod === "PARTIAL") {
      const paid = parseFloat(amountPaid);
      body.amountPaid = paid;
    }
    if (createsPurchaseCredit(paymentMethod) && creditDueDate) {
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
    if (paymentMethod === "PARTIAL") {
      const paid = parseFloat(amountPaid);
      if (Number.isNaN(paid) || paid <= 0) {
        toast.error("Enter the amount paid now");
        return;
      }
      if (!(paid < purchaseTotal)) {
        toast.error(
          "Partial payment must be less than the total (use Bank transfer for full payment)"
        );
        return;
      }
    }
    let body: Record<string, unknown>;
    let submitLines: LineRow[] = [];
    if (notesOnly) {
      body = { notes: notes || undefined };
    } else {
      for (const line of lines) {
        if (!line.itemId) continue;
        if (isCoffeeSku(line.item?.sku) && !line.lotId) {
          toast.error(
            `${line.item?.description ?? "Coffee item"} requires a lot (SKU starts with COF-)`
          );
          return;
        }
      }
      const nonEmpty = lines.filter((l) => l.itemId);
      submitLines = nonEmpty;
      const parsedLines = parseDocumentLines(nonEmpty);
      if ("error" in parsedLines) {
        toast.error(parsedLines.error);
        return;
      }
      const documentLines = parsedLines.lines.map((line, i) => {
        const src = nonEmpty[i];
        const quality = buildQualityPayload(src.quality);
        return {
          ...line,
          ...(src.lotId ? { lotId: src.lotId } : {}),
          ...(quality ? { quality } : {}),
        };
      });
      body = buildBody(documentLines);
    }
    setSaving(true);
    try {
      if (isEdit && purchase) {
        const updated = await api<Purchase>(`/purchases/${purchase.id}`, {
          method: "PATCH",
          body,
        });
        if (!notesOnly) {
          await uploadPendingQualityFiles(updated, submitLines);
        }
        toast.success("Purchase updated");
        router.push(`/purchases/${purchase.id}`);
      } else {
        const created = await api<Purchase>("/purchases", {
          method: "POST",
          body,
        });
        await uploadPendingQualityFiles(created, submitLines);
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
          Supplier credit has additional payments — only notes can be changed.
        </div>
      ) : null}

      <FrappeDocument>
        <FrappeSection
          title="Supplier & payment"
          description="Receiving warehouse and how this purchase is paid"
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
              label="Warehouse / business location"
              required={!notesOnly}
              hint="Our receiving site (warehouse), not the coffee origin."
              value={locationId}
              onValueChange={(id) => {
                setLocationId(id);
                setLines((prev) =>
                  prev.map((row) => ({
                    ...row,
                    lotId: null,
                    lot: null,
                  }))
                );
              }}
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
            <FrappeField label="Purchase type" required={!notesOnly}>
              <SearchSelect
                value={purchaseType}
                onValueChange={(v) => setPurchaseType(v as PurchaseType)}
                options={[...PURCHASE_TYPE_OPTIONS]}
                searchPlaceholder="Local market or Export…"
                disabled={notesOnly}
              />
            </FrappeField>
            <FrappeField label="Payment method" required={!notesOnly}>
              <SearchSelect
                value={paymentMethod}
                onValueChange={(v) =>
                  handlePaymentMethodChange(v as PaymentMethod)
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
            ) : createsPurchaseCredit(paymentMethod) ? (
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
                  label="Amount paid now"
                  required={!notesOnly}
                  hint="Remaining balance is recorded as supplier credit"
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
                <FrappeField label="Credit due date">
                  <Input
                    type="date"
                    value={creditDueDate}
                    onChange={(e) => setCreditDueDate(e.target.value)}
                    disabled={notesOnly}
                  />
                </FrappeField>
              </>
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
                  : `${itemOptions.length} item(s) available · coffee lines need a lot`
                : "Select a warehouse first"
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
                { key: "lot", label: "Lot", className: "w-48" },
                { key: "qty", label: "Qty", className: "w-28" },
                { key: "rate", label: "Rate", className: "w-32" },
              ]}
              onAddRow={() => setLines((prev) => [...prev, emptyLine()])}
              addLabel="Add Row"
            >
              {lines.map((line, i) => {
                const coffee = isCoffeeSku(line.item?.sku);
                return (
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
                          updateLine(i, {
                            itemId: v,
                            item,
                            lotId: null,
                            lot: null,
                            quality: emptyQuality(),
                            qualityFile: null,
                          });
                        }}
                        options={itemOptions}
                        disabled={!locationId || stockLoading}
                        placeholder="Item"
                      />
                    </FrappeGridCell>
                    <FrappeGridCell>
                      {coffee ? (
                        <div className="flex min-w-[11rem] flex-col gap-1">
                          <SearchSelect
                            value={line.lotId ?? ""}
                            onValueChange={(v) => {
                              const lot =
                                lotList.find((l) => l.id === v) ?? null;
                              updateLine(i, {
                                lotId: v || null,
                                lot,
                              });
                            }}
                            options={lotOptionsForLine(line).map((o) => ({
                              value: o.id,
                              label: o.label,
                            }))}
                            placeholder={
                              locationId
                                ? lotsLoading
                                  ? "Loading lots…"
                                  : "Select lot"
                                : "Select warehouse first"
                            }
                            searchPlaceholder="Search lots…"
                            emptyMessage="No lots for this item — create one."
                            disabled={
                              !locationId || !line.itemId || lotsLoading
                            }
                            className="h-8"
                          />
                          <QuickLotDialog
                            defaultLocationId={locationId || undefined}
                            defaultItemId={line.itemId || undefined}
                            disabled={!locationId || !line.itemId}
                            onCreated={(lot) => onLotCreated(i, lot)}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--frappe-text-muted)]">
                          —
                        </span>
                      )}
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
                );
              })}
            </FrappeGridTable>

            {lines.map((line, i) => {
              if (!isCoffeeSku(line.item?.sku) || !line.lotId) return null;
              const q = line.quality;
              return (
                <div
                  key={`quality-${i}`}
                  className="mt-4 rounded border border-[var(--frappe-border)] bg-[var(--frappe-section-head)]/40 p-4"
                >
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[var(--frappe-text)]">
                      ECTA quality
                      {line.lot?.code ? ` · ${line.lot.code}` : ""}
                      {line.item?.description
                        ? ` · ${line.item.description}`
                        : ""}
                    </p>
                    <p className="text-xs text-[var(--frappe-text-muted)]">
                      Official lab certificate upload or manual entry
                    </p>
                  </div>
                  <FrappeFormGrid columns={3}>
                    <FrappeField label="Lab name">
                      <Input
                        value={q.labName}
                        onChange={(e) =>
                          updateLineQuality(i, { labName: e.target.value })
                        }
                        placeholder="ECTA"
                      />
                    </FrappeField>
                    <FrappeField label="Tested date">
                      <Input
                        type="date"
                        value={q.testedAt}
                        onChange={(e) =>
                          updateLineQuality(i, { testedAt: e.target.value })
                        }
                      />
                    </FrappeField>
                    <FrappeField label="Certificate #">
                      <Input
                        value={q.certificateNumber}
                        onChange={(e) =>
                          updateLineQuality(i, {
                            certificateNumber: e.target.value,
                          })
                        }
                      />
                    </FrappeField>
                    <FrappeField label="Grade">
                      <Input
                        value={q.grade}
                        onChange={(e) =>
                          updateLineQuality(i, { grade: e.target.value })
                        }
                      />
                    </FrappeField>
                    <FrappeField label="Moisture %">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={q.moisturePercent}
                        onChange={(e) =>
                          updateLineQuality(i, {
                            moisturePercent: e.target.value,
                          })
                        }
                      />
                    </FrappeField>
                    <FrappeField label="Screen size">
                      <Input
                        value={q.screenSize}
                        onChange={(e) =>
                          updateLineQuality(i, {
                            screenSize: e.target.value,
                          })
                        }
                      />
                    </FrappeField>
                    <FrappeField label="Cupping score">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={q.cuppingScore}
                        onChange={(e) =>
                          updateLineQuality(i, {
                            cuppingScore: e.target.value,
                          })
                        }
                      />
                    </FrappeField>
                    <FrappeField label="Defect count">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={q.defectCount}
                        onChange={(e) =>
                          updateLineQuality(i, {
                            defectCount: e.target.value,
                          })
                        }
                      />
                    </FrappeField>
                    <FrappeField label="Defect level">
                      <Input
                        value={q.defectLevel}
                        onChange={(e) =>
                          updateLineQuality(i, {
                            defectLevel: e.target.value,
                          })
                        }
                      />
                    </FrappeField>
                    <FrappeField label="Passed">
                      <Select
                        value={q.passed || "__unset__"}
                        onValueChange={(v) =>
                          updateLineQuality(i, {
                            passed:
                              v === "__unset__"
                                ? ""
                                : (v as "true" | "false"),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Unset" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unset__">Unset</SelectItem>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </FrappeField>
                    <FrappeField label="Notes" fullWidth>
                      <Input
                        value={q.notes}
                        onChange={(e) =>
                          updateLineQuality(i, { notes: e.target.value })
                        }
                        placeholder="Optional"
                      />
                    </FrappeField>
                    <FrappeField
                      label="Official document"
                      hint="Upload certificate PDF/image, or fill fields above manually"
                      fullWidth
                    >
                      <Input
                        type="file"
                        accept=".pdf,image/*"
                        className="h-9 cursor-pointer text-sm file:mr-3 file:rounded file:border-0 file:bg-[var(--frappe-primary)] file:px-2 file:py-1 file:text-xs file:text-white"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          updateLine(i, { qualityFile: file });
                        }}
                      />
                      {line.qualityFile ? (
                        <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
                          Selected: {line.qualityFile.name}
                        </p>
                      ) : null}
                    </FrappeField>
                  </FrappeFormGrid>
                </div>
              );
            })}
          </FrappeSection>
        ) : null}

        <FrappeSection title="Totals" description="Calculated from lines and payment method">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-[var(--frappe-border)] p-3">
              <p className="text-xs text-[var(--frappe-text-muted)]">
                Total purchase
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(purchaseTotal.toFixed(2))}
              </p>
            </div>
            <div className="rounded border border-[var(--frappe-border)] p-3">
              <p className="text-xs text-[var(--frappe-text-muted)]">
                Amount paid
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(paidPreview.toFixed(2))}
              </p>
            </div>
            <div className="rounded border border-[var(--frappe-border)] p-3">
              <p className="text-xs text-[var(--frappe-text-muted)]">
                Credit / outstanding
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(creditPreview.toFixed(2))}
              </p>
            </div>
            <div className="rounded border border-[var(--frappe-border)] p-3">
              <p className="text-xs text-[var(--frappe-text-muted)]">
                Payment account
              </p>
              <p className="mt-1 text-sm font-medium">
                {paymentMethod === "CREDIT"
                  ? "Supplier credit"
                  : banks?.find((b) => b.id === bankAccountId)?.name ??
                    (needsBankAccount(paymentMethod) ? "Select account" : "—")}
              </p>
            </div>
          </div>
        </FrappeSection>
      </FrappeDocument>
    </form>
  );
}
