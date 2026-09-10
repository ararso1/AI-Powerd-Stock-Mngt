import { fetchAllPages } from "@/lib/fetch-all-pages";
import { buildInventoryListPath } from "@/lib/list-query";
import { productItemId } from "@/lib/inventory-items";
import type { Item, StockRecord } from "@/lib/types";

/** Load all stock rows at a location (paginated API). Optional `search` uses backend filter. */
export async function fetchInventoryForLocation(
  locationId: string,
  search?: string
): Promise<StockRecord[]> {
  if (!locationId) return [];
  const term = search?.trim();
  return fetchAllPages<StockRecord>((page, limit) =>
    buildInventoryListPath(
      {
        locationId,
        search: term || undefined,
      },
      page,
      limit
    )
  );
}

/** Load inventory across locations (optionally filtered by search). */
export async function fetchAllInventory(
  search?: string
): Promise<StockRecord[]> {
  const term = search?.trim();
  return fetchAllPages<StockRecord>((page, limit) =>
    buildInventoryListPath(
      { search: term || undefined },
      page,
      limit
    )
  );
}

/** Unique catalog items from stock rows (for BOM / FG pickers). */
export function uniqueItemsFromStock(stock: StockRecord[]): Item[] {
  const map = new Map<string, Item>();
  for (const row of stock) {
    const itemId = productItemId(row);
    if (!itemId || map.has(itemId)) continue;
    map.set(itemId, {
      id: itemId,
      description: row.item?.description ?? itemId,
      sku: row.item?.sku,
      unit: row.item?.unit,
      itemType: row.item?.itemType,
    });
  }
  return [...map.values()].sort((a, b) =>
    a.description.localeCompare(b.description)
  );
}

