"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuickSupplierDialog } from "@/components/suppliers/quick-supplier-dialog";
import { QuickLocationDialog } from "@/components/locations/quick-location-dialog";
import { QuickBankAccountDialog } from "@/components/banks/quick-bank-account-dialog";
import { QuickLotDialog } from "@/components/lots/create-lot-dialog";
import { EntitySelectField } from "@/components/shared/entity-select-field";
import { SearchSelect } from "@/components/shared/search-select";
import { Input } from "@/components/ui/input";
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
import { buildLotsListPath } from "@/lib/list-query";
import { fetchInventoryForLocation } from "@/lib/inventory-fetch";
import {
  createsPurchaseCredit,
  needsBankAccount,
  purchaseNotesOnly,
} from "@/lib/document-utils";
import { formatMoney, formatQty, errorMessage } from "@/lib/format";
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
  isProcessedCoffeeProduct,
  parseDocumentLines,
  productItemId,
  resolveItem,
  type DocumentLineBody,
} from "@/lib/inventory-items";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/form-select-options";
import { PURCHASE_TYPE_OPTIONS } from "@/lib/purchases";
import { COFFEE_GRADE_OPTIONS, coffeeFormLabel } from "@/lib/lots";
import {
  farasulaKgLabel,
  formatFarasulaInput,
  fromStoredPurchaseLine,
  toStoredPurchaseLine,
} from "@/lib/farasula";
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
  Supplier,
} from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { ChevronDownIcon } from "lucide-react";

interface QualityFormState {
  labName: string;
  testedAt: string;
  grade: string;
}

interface WarehouseScoreState {
  moisturePercent: string;
  screenSize: string;
  cuppingScore: string;
  defectCount: string;
  defectLevel: string;
}

interface LineRow {
  itemId: string;
  lotId?: string | null;
  quantity: string;
  unitPrice: string;
  item?: Item;
  lot?: Lot | null;
  warehouse: WarehouseScoreState;
  quality: QualityFormState;
  qualityFile?: File | null;
}

function emptyWarehouse(): WarehouseScoreState {
  return {
    moisturePercent: "",
    screenSize: "",
    cuppingScore: "",
    defectCount: "",
    defectLevel: "",
  };
}

function warehouseFromSources(
  lot?: Lot | null,
  quality?: PurchaseQualityResult | null
): WarehouseScoreState {
  const moisture = lot?.moisturePercent || quality?.moisturePercent || "";
  const cup = lot?.cuppingScore || quality?.cuppingScore || "";
  return {
    moisturePercent: moisture != null ? String(moisture) : "",
    screenSize: lot?.screenSize || quality?.screenSize || "",
    cuppingScore: cup != null && cup !== "" ? String(cup) : "",
    defectCount:
      lot?.defectCount != null
        ? String(lot.defectCount)
        : quality?.defectCount != null
          ? String(quality.defectCount)
          : "",
    defectLevel: lot?.defectLevel || quality?.defectLevel || "",
  };
}

function warehousePayload(
  scores: WarehouseScoreState
): Record<string, unknown> | null {
  const body: Record<string, unknown> = {};
  if (scores.moisturePercent.trim()) {
    const n = parseFloat(scores.moisturePercent);
    if (!Number.isNaN(n)) body.moisturePercent = n;
  }
  if (scores.screenSize.trim()) body.screenSize = scores.screenSize.trim();
  if (scores.cuppingScore.trim()) {
    const n = parseFloat(scores.cuppingScore);
    if (!Number.isNaN(n)) body.cuppingScore = n;
  }
  if (scores.defectCount.trim()) {
    const n = parseInt(scores.defectCount, 10);
    if (!Number.isNaN(n)) body.defectCount = n;
  }
  if (scores.defectLevel.trim()) body.defectLevel = scores.defectLevel.trim();
  return Object.keys(body).length > 0 ? body : null;
}

function emptyQuality(): QualityFormState {
  return {
    labName: "ECTA",
    testedAt: "",
    grade: "",
  };
}

function qualityFromResult(
  q?: PurchaseQualityResult | null
): QualityFormState {
  if (!q) return emptyQuality();
  return {
    labName: q.labName?.trim() || "ECTA",
    testedAt: q.testedAt?.slice(0, 10) ?? "",
    grade: q.grade ?? "",
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
      q.grade.trim() ||
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
  if (q.grade.trim()) payload.grade = q.grade.trim();
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
    const stored = fromStoredPurchaseLine(
      l.quantity,
      l.unitPrice,
      l.lineTotal
    );
    return {
      itemId,
      lotId: l.lotId ?? null,
      quantity: formatFarasulaInput(stored.farasula, 3),
      unitPrice: formatFarasulaInput(stored.pricePerFarasula, 2),
      item: l.item ? resolveItem(itemId, l.item) : undefined,
      lot: l.lot ?? null,
      warehouse: warehouseFromSources(l.lot, l.quality),
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
          warehouse: emptyWarehouse(),
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
    warehouse: emptyWarehouse(),
    quality: emptyQuality(),
    qualityFile: null,
  };
}

function lotOptionLabel(lot: Lot): string {
  return [lot.code, lot.grade, lot.form, lot.region]
    .filter(Boolean)
    .join(" · ");
}

function lotRowFacts(lot: Lot): { primary: string; secondary: string } {
  const origin = [lot.region, lot.zone, lot.woreda].filter(Boolean).join(", ");
  const primary = [
    coffeeFormLabel(lot.form),
    lot.grade,
    lot.cropYear,
  ]
    .filter(Boolean)
    .join(" · ");
  const secondary = [
    origin || null,
    lot.quantity != null && lot.quantity !== ""
      ? `${formatQty(lot.quantity)} kg on lot`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { primary, secondary };
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

async function saveWarehouseScores(formLines: LineRow[]) {
  await Promise.all(
    formLines.flatMap((line) => {
      if (!line.lotId) return [];
      const body = warehousePayload(line.warehouse ?? emptyWarehouse());
      if (!body) return [];
      return [api(`/lots/${line.lotId}`, { method: "PATCH", body })];
    })
  );
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
  const [purchaseType, setPurchaseType] = useState<PurchaseType | "">(
    purchase?.purchaseType ?? ""
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
            buildLotsListPath({ locationId, status: "ACTIVE" }, 1, 100)
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
  const purchasableLots = useMemo(
    () =>
      lotList.filter(
        (lot) =>
          !isProcessedCoffeeProduct({
            form: lot.form,
            processMethod: lot.processMethod,
            sku: lot.item?.sku,
            itemType: lot.item?.itemType,
          })
      ),
    [lotList]
  );
  const coffeeCatalog = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const option of itemOptions) {
      if (!isCoffeeSku(option.item.sku)) continue;
      if (
        isProcessedCoffeeProduct({
          sku: option.item.sku,
          itemType: option.item.itemType,
        })
      ) {
        continue;
      }
      map.set(option.itemId, { id: option.itemId, label: option.label });
    }
    for (const lot of purchasableLots) {
      const id = lot.itemId ?? lot.item?.id;
      if (!id || map.has(id)) continue;
      if (lot.item?.sku && !isCoffeeSku(lot.item.sku)) continue;
      const label = lot.item?.sku
        ? `${lot.item.description} (${lot.item.sku})`
        : (lot.item?.description ?? lot.code);
      map.set(id, { id, label });
    }
    return [...map.values()];
  }, [itemOptions, purchasableLots]);

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

  function onLotCreated(lot: Lot) {
    setLots((prev) => {
      const list = prev ?? [];
      if (list.some((l) => l.id === lot.id)) return list;
      return [...list, lot];
    });
    reloadLots();
    const itemId = lot.itemId ?? lot.item?.id ?? "";
    const item =
      lot.item ??
      (itemId
        ? { id: itemId, description: lot.code, sku: undefined }
        : undefined);
    const patch: Partial<LineRow> = {
      lotId: lot.id,
      lot,
      itemId,
      item,
      warehouse: warehouseFromSources(lot),
      quality: emptyQuality(),
    };
    setLines((prev) => {
      const idx = prev.findIndex((row) => !row.lotId);
      if (idx >= 0 && idx < prev.length) {
        return prev.map((row, i) => (i === idx ? { ...row, ...patch } : row));
      }
      return [...prev, { ...emptyLine(), ...patch }];
    });
  }

  function applyLot(lineIndex: number, lot: Lot | null) {
    if (!lot) {
      updateLine(lineIndex, {
        lotId: null,
        lot: null,
        itemId: "",
        item: undefined,
        quality: emptyQuality(),
        warehouse: emptyWarehouse(),
        qualityFile: null,
      });
      return;
    }
    if (!lot.itemId && !lot.item?.id) {
      toast.error(
        `${lot.code} has no coffee product. Create a new lot linked to a product.`
      );
      return;
    }
    const itemId = lot.itemId ?? lot.item?.id ?? "";
    updateLine(lineIndex, {
      lotId: lot.id,
      lot,
      itemId,
      item: lot.item ?? { id: itemId, description: lot.code },
      warehouse: warehouseFromSources(lot),
      quality: {
        ...emptyQuality(),
        testedAt: lot.ectaTestedAt?.slice(0, 10) ?? "",
        grade: lot.ectaGrade ?? "",
      },
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
          ? { ...row, quality: { ...(row.quality ?? emptyQuality()), ...patch } }
          : row
      )
    );
  }

  function updateLineWarehouse(i: number, patch: Partial<WarehouseScoreState>) {
    setLines((prev) =>
      prev.map((row, idx) =>
        idx === i
          ? {
              ...row,
              warehouse: { ...(row.warehouse ?? emptyWarehouse()), ...patch },
            }
          : row
      )
    );
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
    if (!notesOnly && purchaseType !== "LOCAL" && purchaseType !== "EXPORT") {
      toast.error("Select Local market or Export");
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
      const filled = lines.filter(
        (line) => line.lotId || line.itemId || line.quantity || line.unitPrice
      );
      if (filled.length === 0 || filled.some((line) => !line.lotId || !line.itemId)) {
        toast.error(
          "Select an existing lot at this warehouse, or create a new lot"
        );
        return;
      }
      const nonEmpty = filled;
      submitLines = nonEmpty;
      const parsedLines = parseDocumentLines(nonEmpty);
      if ("error" in parsedLines) {
        toast.error(parsedLines.error);
        return;
      }
      const documentLines = parsedLines.lines.map((line, i) => {
        const src = nonEmpty[i];
        const quality = buildQualityPayload(src.quality);
        const stored = toStoredPurchaseLine(line.quantity, line.unitPrice);
        return {
          ...line,
          quantity: stored.quantityKg,
          unitPrice: stored.pricePerKg,
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
          await saveWarehouseScores(submitLines);
        }
        toast.success("Purchase updated");
        router.push(`/purchases/${purchase.id}`);
      } else {
        const created = await api<Purchase>("/purchases", {
          method: "POST",
          body,
        });
        await uploadPendingQualityFiles(created, submitLines);
        await saveWarehouseScores(submitLines);
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
      {notesOnly ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Supplier credit has additional payments — only notes can be changed.
        </div>
      ) : null}

      <FrappeDocument>
        <FrappeSection
          title="Supplier & warehouse"
          description="Who we buy from and which of our warehouses receives the coffee"
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
                placeholder="Select Local market or Export"
                searchPlaceholder="Local market or Export…"
                disabled={notesOnly}
              />
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>

        <FrappeSection
          title={notesOnly ? "Payment method" : "Coffee lots"}
          description={
            notesOnly
              ? "How this coffee purchase is paid"
              : locationId
                ? lotsLoading
                  ? "Loading lots at this warehouse…"
                  : `${purchasableLots.length} lot(s) at this warehouse · quantity is in Farasula (1 Farasula = 18 kg)`
                : "Select our warehouse first. Quantity is in Farasula (1 Farasula = 18 kg)."
          }
        >
          {!notesOnly ? (
            <>
            <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
              <QuickLotDialog
                forPurchase
                defaultLocationId={locationId || undefined}
                catalogItems={coffeeCatalog}
                disabled={!locationId}
                onCreated={(lot) => onLotCreated(lot)}
              />
              <Link
                href={locationId ? `/lots?locationId=${locationId}` : "/lots"}
                className="text-xs text-[var(--frappe-text-muted)] hover:text-[var(--frappe-primary)] hover:underline"
              >
                All lots
              </Link>
            </div>
            <FrappeGridTable
              columns={[
                { key: "lot", label: "Lot (SKU)" },
                { key: "qty", label: "Qty (Farasula)", className: "w-40" },
                { key: "rate", label: "Price / Farasula", className: "w-36" },
              ]}
              onAddRow={() => setLines((prev) => [...prev, emptyLine()])}
              addLabel="Add Row"
            >
              {lines.map((line, i) => {
                const facts = line.lot ? lotRowFacts(line.lot) : null;
                const farasula = parseFloat(line.quantity);
                const kgLabel = farasulaKgLabel(farasula);
                return (
                <FrappeGridRow
                  key={i}
                  canRemove={lines.length > 1}
                  onRemove={() =>
                    setLines((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  <FrappeGridCell>
                    <SearchSelect
                      value={line.lotId ?? ""}
                      onValueChange={(v) => {
                        const lot = lotList.find((l) => l.id === v) ?? null;
                        applyLot(i, v ? lot : null);
                      }}
                      options={(() => {
                        const map = new Map(
                          purchasableLots.map((lot) => [lot.id, lot])
                        );
                        if (line.lot && !map.has(line.lot.id)) {
                          map.set(line.lot.id, line.lot);
                        }
                        return [...map.values()].map((lot) => ({
                          value: lot.id,
                          label: lotOptionLabel(lot),
                        }));
                      })()}
                      placeholder={
                        locationId
                          ? lotsLoading
                            ? "Loading lots…"
                            : "Select existing lot"
                          : "Select warehouse first"
                      }
                      searchPlaceholder="Search lots…"
                      emptyMessage="No purchase lots at this warehouse — create one."
                      disabled={!locationId || lotsLoading}
                      className="h-8 min-w-[12rem]"
                    />
                    {facts ? (
                      <div className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-[var(--frappe-text-muted)]">
                        {line.item?.description ? (
                          <p className="text-[var(--frappe-text)]">
                            {line.item.description}
                          </p>
                        ) : null}
                        {facts.primary ? <p>{facts.primary}</p> : null}
                        {facts.secondary ? <p>{facts.secondary}</p> : null}
                      </div>
                    ) : null}
                  </FrappeGridCell>
                  <FrappeGridCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      className="h-8"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(i, { quantity: e.target.value })
                      }
                      placeholder="Farasula"
                      required
                    />
                    {kgLabel ? (
                      <p className="mt-1 text-[11px] leading-snug text-[var(--frappe-text-muted)]">
                        {kgLabel}
                      </p>
                    ) : null}
                  </FrappeGridCell>
                  <FrappeGridCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8"
                      value={line.unitPrice}
                      onChange={(e) =>
                        updateLine(i, { unitPrice: e.target.value })
                      }
                      placeholder="Price"
                      required
                    />
                  </FrappeGridCell>
                </FrappeGridRow>
                );
              })}
            </FrappeGridTable>
            <div className="mt-4 border-t border-[var(--frappe-border)] pt-4">
              <p className="text-sm font-semibold text-[var(--frappe-text)]">
                Payment method
              </p>
              <p className="mt-0.5 text-xs text-[var(--frappe-text-muted)]">
                How this coffee purchase is paid
              </p>
            </div>
            </>
          ) : null}
            <FrappeFormGrid columns={notesOnly ? 1 : 2} className="mt-3">
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
                        compact
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
              ) : null}
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
            </FrappeFormGrid>
        </FrappeSection>

        {!notesOnly ? (
          <>
            <details className="group border-b border-[var(--frappe-border)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-[var(--frappe-section-head)] px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--frappe-text)]">
                    Warehouse test scores
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--frappe-text-muted)]">
                    Moisture and cupping taken at our warehouse. Saved on the lot.
                  </p>
                </div>
                <ChevronDownIcon className="size-4 shrink-0 text-[var(--frappe-text-muted)] transition-transform group-open:rotate-180" />
              </summary>
              <div className="p-4">
                {lines.some((line) => line.lotId) ? (
                  lines.map((line, i) => {
                    if (!line.lotId) return null;
                    const scores = line.warehouse ?? emptyWarehouse();
                    return (
                      <div
                        key={`warehouse-${i}`}
                        className="mb-4 rounded border border-[var(--frappe-border)] bg-[var(--frappe-section-head)]/40 p-4 last:mb-0"
                      >
                        <p className="mb-3 text-sm font-semibold text-[var(--frappe-text)]">
                          {line.lot?.code ?? "Lot"}
                          {line.item?.description
                            ? ` · ${line.item.description}`
                            : ""}
                        </p>
                        <FrappeFormGrid columns={3}>
                          <FrappeField label="Moisture %">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={scores.moisturePercent}
                              onChange={(e) =>
                                updateLineWarehouse(i, {
                                  moisturePercent: e.target.value,
                                })
                              }
                            />
                          </FrappeField>
                          <FrappeField label="Cupping score">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={scores.cuppingScore}
                              onChange={(e) =>
                                updateLineWarehouse(i, {
                                  cuppingScore: e.target.value,
                                })
                              }
                            />
                          </FrappeField>
                          <FrappeField label="Screen size">
                            <Input
                              value={scores.screenSize}
                              onChange={(e) =>
                                updateLineWarehouse(i, {
                                  screenSize: e.target.value,
                                })
                              }
                            />
                          </FrappeField>
                          <FrappeField label="Defect count">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={scores.defectCount}
                              onChange={(e) =>
                                updateLineWarehouse(i, {
                                  defectCount: e.target.value,
                                })
                              }
                            />
                          </FrappeField>
                          <FrappeField label="Defect level">
                            <Input
                              value={scores.defectLevel}
                              onChange={(e) =>
                                updateLineWarehouse(i, {
                                  defectLevel: e.target.value,
                                })
                              }
                            />
                          </FrappeField>
                        </FrappeFormGrid>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-[var(--frappe-text-muted)]">
                    Select or create a lot first, then open this section to enter warehouse scores.
                  </p>
                )}
              </div>
            </details>
            <details className="group border-b border-[var(--frappe-border)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-[var(--frappe-section-head)] px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--frappe-text)]">
                    ECTA laboratory result
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--frappe-text-muted)]">
                    Upload the official file, enter the lab result, or both. Linked to this purchase and lot.
                  </p>
                </div>
                <ChevronDownIcon className="size-4 shrink-0 text-[var(--frappe-text-muted)] transition-transform group-open:rotate-180" />
              </summary>
              <div className="p-4">
                {lines.some((line) => line.lotId) ? (
                  lines.map((line, i) => {
                    if (!line.lotId) return null;
                    const q = line.quality ?? emptyQuality();
                    return (
                      <div
                        key={`quality-${i}`}
                        className="mb-4 rounded border border-[var(--frappe-border)] bg-[var(--frappe-section-head)]/40 p-4 last:mb-0"
                      >
                        <p className="mb-3 text-sm font-semibold text-[var(--frappe-text)]">
                          {line.lot?.code ?? "Lot"}
                          {line.item?.description
                            ? ` · ${line.item.description}`
                            : ""}
                        </p>
                        <FrappeFormGrid columns={2}>
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
                          <FrappeField label="Grade">
                            <SearchSelect
                              value={q.grade}
                              onValueChange={(v) =>
                                updateLineQuality(i, { grade: v })
                              }
                              options={COFFEE_GRADE_OPTIONS.map((value) => ({
                                value,
                                label: value,
                              }))}
                              placeholder="Select grade"
                              searchPlaceholder="G1 to G5…"
                            />
                          </FrappeField>
                          <FrappeField
                            label="Result"
                            hint="Upload the laboratory result"
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
                  })
                ) : (
                  <p className="text-sm text-[var(--frappe-text-muted)]">
                    Select or create a lot first, then open this section to enter or upload the ECTA result.
                  </p>
                )}
              </div>
            </details>
          </>
        ) : null}

        <FrappeSection title="Totals" description="Calculated from lines and payment method">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-3 py-3">
              <p className="text-xs text-[var(--frappe-text-muted)]">
                Total purchase
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(purchaseTotal.toFixed(2))}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-3 py-3">
              <p className="text-xs text-[var(--frappe-text-muted)]">
                Amount paid
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(paidPreview.toFixed(2))}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-3 py-3">
              <p className="text-xs text-[var(--frappe-text-muted)]">
                Credit / outstanding
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(creditPreview.toFixed(2))}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-3 py-3">
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

        <FrappeSection title="Reference">
          <FrappeField label="Optional reference" fullWidth>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional reference"
            />
          </FrappeField>
        </FrappeSection>
      </FrappeDocument>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-3 shadow-sm">
        <FrappeButtonLink href={cancelHref}>Cancel</FrappeButtonLink>
        <FrappeButtonPrimary type="submit" disabled={saving}>
          {saving ? <Spinner className="size-4" /> : "Save"}
        </FrappeButtonPrimary>
      </div>
    </form>
  );
}
