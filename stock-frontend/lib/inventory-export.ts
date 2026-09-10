import { fetchAllPages } from "@/lib/fetch-all-pages";
import { downloadTextFile, rowsToCsv } from "@/lib/export-file";
import {
  buildInventoryListPath,
  type InventoryListQueryParams,
} from "@/lib/list-query";
import type { StockRecord } from "@/lib/types";

const EXPORT_HEADERS = [
  "description",
  "sku",
  "unit",
  "itemType",
  "quantity",
  "purchasePrice",
  "reorderPoint",
  "location",
  "stockValue",
] as const;

function stockValue(row: StockRecord): number {
  const qty = parseFloat(row.quantity);
  const price = parseFloat(row.purchasePrice);
  if (Number.isNaN(qty) || Number.isNaN(price)) return 0;
  return qty * price;
}

function stockToRow(row: StockRecord): (string | number)[] {
  return [
    row.item.description,
    row.item.sku ?? "",
    row.item.unit ?? "pcs",
    row.item.itemType ?? "",
    row.quantity,
    row.purchasePrice,
    row.reorderPoint ?? "",
    row.location?.name ?? "",
    stockValue(row).toFixed(2),
  ];
}

export async function fetchInventoryForExport(
  filters: InventoryListQueryParams
): Promise<StockRecord[]> {
  return fetchAllPages<StockRecord>((page, limit) =>
    buildInventoryListPath(filters, page, limit)
  );
}

export function buildInventoryExportCsv(rows: StockRecord[]): string {
  return rowsToCsv(
    [...EXPORT_HEADERS],
    rows.map(stockToRow)
  );
}

export function exportInventoryToExcel(
  rows: StockRecord[],
  locationLabel: string
): void {
  const safeLabel = locationLabel
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `inventory-${safeLabel || "stock"}-${date}.csv`;
  downloadTextFile(filename, buildInventoryExportCsv(rows));
}
