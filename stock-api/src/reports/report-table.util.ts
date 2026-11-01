import type { ReportTable } from './report-export.service';

function flattenObject(
  value: unknown,
  prefix = '',
): Record<string, string | number | null> {
  if (value === null || value === undefined) {
    return prefix ? { [prefix]: null } : {};
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    const scalar =
      typeof value === 'string' || typeof value === 'number'
        ? value
        : value === null
          ? null
          : String(value);
    return prefix ? { [prefix]: scalar } : {};
  }
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenObject(v, key));
    } else if (Array.isArray(v)) {
      out[key] = `${v.length} items`;
    } else if (typeof v === 'string' || typeof v === 'number') {
      out[key] = v;
    } else if (v === null || v === undefined) {
      out[key] = null;
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

/** Build a printable table from common report JSON shapes. */
export function tableFromReportPayload(
  reportId: string,
  title: string,
  payload: Record<string, unknown>,
  period?: { from?: string | null; to?: string | null },
): ReportTable {
  const subtitle = period
    ? `Period: ${period.from ?? '—'} → ${period.to ?? '—'}`
    : undefined;

  const summaryLines: string[] = [];
  if (payload.currency && typeof payload.currency === 'object') {
    const c = payload.currency as { code?: string };
    if (c.code) summaryLines.push(`Currency: ${c.code}`);
  }
  if (payload.totals && typeof payload.totals === 'object') {
    for (const [k, v] of Object.entries(payload.totals as Record<string, unknown>)) {
      summaryLines.push(`${k}: ${v}`);
    }
  }
  for (const key of [
    'totalRevenue',
    'totalPurchases',
    'totalExpenses',
    'grossProfit',
    'netProfit',
    'marginPercent',
    'totalInventoryValue',
    'totalCommission',
    'costOfGoodsSold',
  ]) {
    if (payload[key] !== undefined) summaryLines.push(`${key}: ${payload[key]}`);
  }

  const arrayKeys = [
    'items',
    'customers',
    'suppliers',
    'reps',
    'dailyBalances',
    'byPaymentMethod',
    'byLocation',
    'byPurchaseType',
    'byCategory',
    'byForm',
    'byStatus',
    'byDepartment',
    'rows',
    'lots',
    'runs',
    'contracts',
    'transfers',
    'adjustments',
    'tickets',
    'transactions',
    'accounts',
    'approvals',
    'users',
    'prices',
    'customerCredits',
    'supplierCredits',
  ];

  let rowsSource: Record<string, unknown>[] | null = null;
  for (const key of arrayKeys) {
    const candidate = payload[key];
    if (Array.isArray(candidate) && candidate.length > 0 && typeof candidate[0] === 'object') {
      rowsSource = candidate as Record<string, unknown>[];
      break;
    }
  }

  // Nested byCustomer / bySupplier under credits
  if (!rowsSource && payload.customers && typeof payload.customers === 'object') {
    const nested = (payload.customers as { byCustomer?: unknown }).byCustomer;
    if (Array.isArray(nested) && nested.length) {
      rowsSource = nested as Record<string, unknown>[];
    }
  }
  if (!rowsSource && payload.suppliers && typeof payload.suppliers === 'object') {
    const nested = (payload.suppliers as { bySupplier?: unknown }).bySupplier;
    if (Array.isArray(nested) && nested.length) {
      rowsSource = nested as Record<string, unknown>[];
    }
  }

  if (!rowsSource || rowsSource.length === 0) {
    const flat = flattenObject(payload);
    const headers = Object.keys(flat);
    return {
      title,
      subtitle,
      headers: headers.length ? headers : ['value'],
      rows: [headers.length ? headers.map((h) => flat[h]) : [JSON.stringify(payload)]],
      summaryLines: summaryLines.length ? summaryLines : undefined,
    };
  }

  const headerSet = new Set<string>();
  const flats = rowsSource.map((row) => {
    const flat = flattenObject(row);
    Object.keys(flat).forEach((k) => headerSet.add(k));
    return flat;
  });
  const headers = [...headerSet];
  return {
    title: `${title} (${reportId})`,
    subtitle,
    headers,
    rows: flats.map((flat) => headers.map((h) => flat[h] ?? '')),
    summaryLines: summaryLines.length ? summaryLines : undefined,
  };
}
