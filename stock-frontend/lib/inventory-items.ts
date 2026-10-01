import type { Item, StockRecord } from "@/lib/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Product UUID from stock or line payload — never the stock row id unless it equals itemId. */
export function productItemId(source: {
  id?: string;
  itemId?: string;
  item?: Partial<Item> | null;
}): string {
  const nested = source.item?.id?.trim();
  const flat = source.itemId?.trim();
  if (nested && flat && nested !== flat && flat === source.id) {
    return nested;
  }
  return flat || nested || "";
}

export function isProductItemId(value: string | undefined | null): boolean {
  if (!value?.trim()) return false;
  return UUID_RE.test(value.trim());
}

/** Normalize item from stock/line payloads when nested `item` is partial or missing. */
export function resolveItem(itemId: string, item?: Partial<Item> | null): Item {
  const id = productItemId({ itemId, item }) || itemId;
  return {
    id,
    description: item?.description ?? id,
    sku: item?.sku,
    unit: item?.unit,
    itemType: item?.itemType,
  };
}

/** Build productId → Item map for line-item selects (stock + existing lines). */
export function buildItemOptionMap(
  stock: { id?: string; itemId: string; item?: Item | null }[],
  lines: { itemId: string; item?: Item | null }[]
): Map<string, Item> {
  const map = new Map<string, Item>();
  for (const source of [...stock, ...lines]) {
    const itemId = productItemId(source);
    if (!isProductItemId(itemId)) continue;
    map.set(itemId, resolveItem(itemId, source.item));
  }
  return map;
}

export function itemOptionsFromMap(map: Map<string, Item>) {
  return Array.from(map.entries()).map(([itemId, item]) => ({
    itemId,
    item,
    label: item.sku ? `${item.description} (${item.sku})` : item.description,
  }));
}

export function itemOptionsFromStock(stock: StockRecord[]) {
  return itemOptionsFromMap(buildItemOptionMap(stock, []));
}

export interface DocumentLineInput {
  itemId: string;
  lotId?: string | null;
  quantity: string | number;
  unitPrice?: string | number;
}

export interface DocumentLineBody {
  itemId: string;
  quantity: number;
  unitPrice: number;
  lotId?: string;
}

export function parseDocumentLines(
  lines: DocumentLineInput[]
): { lines: DocumentLineBody[] } | { error: string } {
  const parsed: DocumentLineBody[] = [];

  for (const line of lines) {
    const itemId = productItemId(line);
    if (!itemId) continue;
    if (!isProductItemId(itemId)) {
      return {
        error:
          "Each line must use a product from stock (select from the list — not SKU or stock row id).",
      };
    }
    const quantity =
      typeof line.quantity === "number"
        ? line.quantity
        : parseFloat(line.quantity);
    if (Number.isNaN(quantity) || quantity <= 0) {
      return { error: "Enter a valid quantity for each line." };
    }
    const unitPriceRaw = line.unitPrice ?? "";
    const unitPrice =
      typeof unitPriceRaw === "number"
        ? unitPriceRaw
        : parseFloat(String(unitPriceRaw));
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      return { error: "Enter a valid unit price for each line." };
    }
    parsed.push({
      itemId,
      quantity,
      unitPrice,
      ...(line.lotId ? { lotId: line.lotId } : {}),
    });
  }

  if (parsed.length === 0) {
    return { error: "Add at least one line item." };
  }

  return { lines: parsed };
}

export interface TransferLineInput {
  itemId: string;
  lotId?: string | null;
  quantity: string | number;
}

export function parseTransferLines(
  lines: TransferLineInput[]
):
  | { lines: { itemId: string; quantity: number; lotId?: string }[] }
  | { error: string } {
  const parsed: { itemId: string; quantity: number; lotId?: string }[] = [];

  for (const line of lines) {
    const itemId = productItemId(line);
    if (!itemId) continue;
    if (!isProductItemId(itemId)) {
      return {
        error:
          "Each line must use a product from stock (select from the list — not SKU or stock row id).",
      };
    }
    const quantity =
      typeof line.quantity === "number"
        ? line.quantity
        : parseFloat(line.quantity);
    if (Number.isNaN(quantity) || quantity <= 0) {
      return { error: "Enter a valid quantity for each line." };
    }
    parsed.push({
      itemId,
      quantity,
      ...(line.lotId ? { lotId: line.lotId } : {}),
    });
  }

  if (parsed.length === 0) {
    return { error: "Add at least one line item." };
  }

  return { lines: parsed };
}

/** Options for transfer lines: one entry per stock row (lot-aware). */
export function stockTransferOptions(stock: StockRecord[]) {
  return stock
    .filter((s) => parseFloat(s.quantity) > 0)
    .map((s) => ({
      id: s.id,
      itemId: s.itemId,
      lotId: s.lotId ?? null,
      label: [
        s.item?.description ?? "Item",
        s.lot?.code,
        s.item?.sku ? `SKU ${s.item.sku}` : null,
        `avail ${s.quantity}`,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
}

const SALE_COFFEE_FORMS = new Set(["ROASTED", "FLOUR", "PACKAGED", "REJECT"]);
const SALE_PROCESS_METHODS = new Set([
  "Roast & Ground",
  "Roast coffee",
  "Ground coffee",
  "Reject",
]);

/** Processed or finished coffee, and reject stock. Raw purchased coffee stays out of sales. */
export function isSaleStock(row: {
  lot?: { form?: string | null; processMethod?: string | null; code?: string | null } | null;
  item?: { sku?: string | null; itemType?: string | null } | null;
}): boolean {
  const sku = row.item?.sku?.trim().toUpperCase() ?? "";
  const form = row.lot?.form ?? null;
  const coffee =
    isCoffeeSku(sku) || isCoffeeSku(row.lot?.code) || !!form;
  if (!coffee) return false;
  if (form && SALE_COFFEE_FORMS.has(form)) return true;
  if (row.item?.itemType === "FINISHED") return true;
  if (
    sku.startsWith("COF-ROAST") ||
    sku.startsWith("COF-GROUND") ||
    sku === "COF-REJECT"
  ) {
    return true;
  }
  const method = row.lot?.processMethod ?? "";
  return SALE_PROCESS_METHODS.has(method);
}

export function isCoffeeSku(sku: string | null | undefined): boolean {
  const value = sku?.trim().toUpperCase();
  return !!value && (value.startsWith("COF-") || value.startsWith("LOT-"));
}

const PROCESSED_COFFEE_FORMS = new Set(["ROASTED", "FLOUR", "PACKAGED"]);

/** Roast, ground, packaged, and reject coffee. Purchases and warehouse intake stay on raw lots. */
export function isProcessedCoffeeProduct(source: {
  form?: string | null;
  processMethod?: string | null;
  sku?: string | null;
  itemType?: string | null;
}): boolean {
  const sku = source.sku?.trim().toUpperCase() ?? "";
  if (
    sku.startsWith("COF-ROAST") ||
    sku.startsWith("COF-GROUND") ||
    sku === "COF-REJECT"
  ) {
    return true;
  }
  if (source.itemType === "FINISHED") return true;
  if (source.form && PROCESSED_COFFEE_FORMS.has(source.form)) return true;
  const method = source.processMethod ?? "";
  return (
    method === "Roast & Ground" ||
    method === "Roast coffee" ||
    method === "Ground coffee"
  );
}

/** Warehouse lots that can start a process run. Roast & ground and other finished coffee stay out. */
export function isWarehouseProcessStock(row: {
  lot?: { form?: string | null; processMethod?: string | null } | null;
  item?: { sku?: string | null; itemType?: string | null } | null;
}): boolean {
  const form = row.lot?.form;
  if (!form || PROCESSED_COFFEE_FORMS.has(form)) return false;
  if (
    row.lot?.processMethod === "Roast & Ground" ||
    row.lot?.processMethod === "Roast coffee" ||
    row.lot?.processMethod === "Ground coffee" ||
    row.lot?.processMethod === "Packaging"
  ) {
    return false;
  }
  const sku = row.item?.sku?.trim().toUpperCase() ?? "";
  if (
    sku.startsWith("COF-ROAST") ||
    sku.startsWith("COF-GROUND") ||
    sku === "COF-REJECT"
  ) {
    return false;
  }
  if (row.item?.itemType === "FINISHED") return false;
  return true;
}

export type CoffeePosition = "available" | "sales" | "reject";

/** Kilograms on a stock line. Packaged coffee is stored as a pack count. */
export function coffeeLineKg(row: {
  quantity: string;
  item?: { sku?: string | null; unit?: string | null } | null;
  lot?: { form?: string | null; processMethod?: string | null } | null;
}): number {
  const qty = parseFloat(row.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const sku = row.item?.sku?.trim().toUpperCase() ?? "";
  const method = row.lot?.processMethod ?? "";
  const packaged =
    row.lot?.form === "PACKAGED" ||
    row.item?.unit?.toLowerCase() === "pcs" ||
    sku.endsWith("-1KG") ||
    sku.endsWith("-500");
  if (!packaged) return qty;
  let size = 1;
  if (sku.endsWith("-500") || /^0\.5/.test(method)) size = 0.5;
  else if (sku.endsWith("-250") || /250\s*g/i.test(method)) size = 0.25;
  else {
    const match = method.match(/([\d.]+)\s*kg/i);
    if (match) {
      const parsed = parseFloat(match[1]);
      if (parsed > 0) size = parsed;
    }
  }
  return Math.round((qty * size + Number.EPSILON) * 1000) / 1000;
}

/** Each coffee kilogram is counted once: raw stock, sales store, or reject. */
export function coffeePosition(row: {
  lot?: {
    form?: string | null;
    processMethod?: string | null;
    code?: string | null;
  } | null;
  item?: { sku?: string | null; itemType?: string | null } | null;
}): CoffeePosition | null {
  const form = row.lot?.form ?? "";
  const sku = row.item?.sku?.trim().toUpperCase() ?? "";
  const method = row.lot?.processMethod ?? "";
  const coffee = isCoffeeSku(sku) || isCoffeeSku(row.lot?.code) || !!form;
  if (!coffee) return null;
  if (form === "REJECT" || sku === "COF-REJECT" || method === "Reject") {
    return "reject";
  }
  if (isWarehouseProcessStock(row)) return "available";
  if (isSaleStock(row)) return "sales";
  return null;
}
