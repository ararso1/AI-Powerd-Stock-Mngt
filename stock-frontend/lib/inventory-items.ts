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

export function isCoffeeSku(sku: string | null | undefined): boolean {
  return !!sku?.trim().toUpperCase().startsWith("COF-");
}
