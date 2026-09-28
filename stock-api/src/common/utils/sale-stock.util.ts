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

function isCoffeeSku(sku?: string | null): boolean {
  const value = sku?.trim().toUpperCase() ?? '';
  return value.startsWith('COF-') || value.startsWith('LOT-');
}

/** Processed or finished coffee, plus reject stock. Raw purchased coffee is not sellable. */
export function isSellableStock(source: {
  sku?: string | null;
  itemType?: string | null;
  lotCode?: string | null;
  form?: string | null;
  processMethod?: string | null;
}): boolean {
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
 * Inventory rows that may be sold: roasted, ground, packaged, finished, or reject coffee.
 */
export const SELLABLE_STOCK_SQL = `(
  EXISTS (
    SELECT 1 FROM items sale_item
    LEFT JOIN lots sale_lot ON sale_lot.id = stock.lot_id
    WHERE sale_item.id = stock.item_id
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
