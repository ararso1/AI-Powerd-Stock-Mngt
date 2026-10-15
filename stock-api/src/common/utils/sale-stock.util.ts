const SALE_COFFEE_FORMS = new Set([
  'ROASTED',
  'FLOUR',
  'PACKAGED',
  'REJECT',
]);

const SALE_PROCESS_METHODS = new Set([
  'Roast & Ground',
  'Roast coffee',
  'Ground coffee',
  'Reject',
]);

export const EXPORT_STORE_PROCESS_METHOD = 'Export store';

function isCoffeeSku(sku?: string | null): boolean {
  const value = sku?.trim().toUpperCase() ?? '';
  return value.startsWith('COF-') || value.startsWith('LOT-');
}

/** Packaged coffee sitting in the export staging store. */
export function isExportStoreStock(processMethod?: string | null): boolean {
  return (processMethod ?? '').trim() === EXPORT_STORE_PROCESS_METHOD;
}

/** Processed or finished coffee, plus reject stock. Raw purchased coffee is not sellable. */
export function isSellableStock(
  source: {
    sku?: string | null;
    itemType?: string | null;
    lotCode?: string | null;
    form?: string | null;
    processMethod?: string | null;
  },
  channel: 'LOCAL' | 'EXPORT' = 'LOCAL',
): boolean {
  if (channel === 'EXPORT') {
    return isExportStoreStock(source.processMethod);
  }
  if (isExportStoreStock(source.processMethod)) return false;

  const sku = source.sku?.trim().toUpperCase() ?? '';
  const coffee =
    isCoffeeSku(sku) || isCoffeeSku(source.lotCode) || !!source.form;
  if (!coffee) return false;
  if (source.form && SALE_COFFEE_FORMS.has(source.form)) return true;
  if (source.itemType === 'FINISHED') return true;
  if (
    sku.startsWith('COF-ROAST') ||
    sku.startsWith('COF-GROUND') ||
    sku === 'COF-REJECT'
  ) {
    return true;
  }
  return !!source.processMethod && SALE_PROCESS_METHODS.has(source.processMethod);
}

/**
 * Inventory rows that may be sold locally: roasted, ground, packaged, finished, or reject coffee.
 * Export-store lots are excluded — use EXPORT_SELLABLE_STOCK_SQL for export sales.
 */
export const SELLABLE_STOCK_SQL = `(
  EXISTS (
    SELECT 1 FROM items sale_item
    LEFT JOIN lots sale_lot ON sale_lot.id = stock.lot_id
    WHERE sale_item.id = stock.item_id
      AND COALESCE(sale_lot.process_method, '') <> 'Export store'
      AND (
        sale_lot.form IN ('ROASTED', 'FLOUR', 'PACKAGED', 'REJECT')
        OR sale_item.item_type = 'FINISHED'
        OR UPPER(sale_item.sku) LIKE 'COF-ROAST%'
        OR UPPER(sale_item.sku) LIKE 'COF-GROUND%'
        OR UPPER(sale_item.sku) = 'COF-REJECT'
        OR sale_lot.process_method IN (
          'Roast & Ground',
          'Roast coffee',
          'Ground coffee',
          'Reject'
        )
      )
  )
)`;

/** Export-channel sales: coffee in the export store only. */
export const EXPORT_SELLABLE_STOCK_SQL = `(
  EXISTS (
    SELECT 1 FROM lots export_lot
    WHERE export_lot.id = stock.lot_id
      AND export_lot.process_method = 'Export store'
  )
)`;

/** Reject lots and the process reject store. */
export const REJECT_STOCK_SQL = `(
  EXISTS (
    SELECT 1 FROM items coffee_item
    LEFT JOIN lots coffee_lot ON coffee_lot.id = stock.lot_id
    WHERE coffee_item.id = stock.item_id
      AND (
        coffee_lot.form = 'REJECT'
        OR UPPER(coffee_item.sku) = 'COF-REJECT'
        OR coffee_lot.process_method = 'Reject'
      )
  )
)`;

/** Raw coffee that can still start a process run. */
export const PROCESS_AVAILABLE_STOCK_SQL = `(
  EXISTS (
    SELECT 1 FROM items coffee_item
    LEFT JOIN lots coffee_lot ON coffee_lot.id = stock.lot_id
    WHERE coffee_item.id = stock.item_id
      AND coffee_lot.form IS NOT NULL
      AND coffee_lot.form NOT IN ('ROASTED', 'FLOUR', 'PACKAGED', 'REJECT')
      AND COALESCE(coffee_lot.process_method, '') NOT IN (
        'Roast & Ground',
        'Roast coffee',
        'Ground coffee'
      )
      AND UPPER(COALESCE(coffee_item.sku, '')) NOT LIKE 'COF-ROAST%'
      AND UPPER(COALESCE(coffee_item.sku, '')) NOT LIKE 'COF-GROUND%'
      AND UPPER(COALESCE(coffee_item.sku, '')) <> 'COF-REJECT'
      AND coffee_item.item_type <> 'FINISHED'
  )
)`;

/** Packed and bulk finished coffee, without reject. */
export const SALES_STORE_STOCK_SQL = `(${SELLABLE_STOCK_SQL} AND NOT ${REJECT_STOCK_SQL})`;
