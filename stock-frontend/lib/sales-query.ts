export function buildSalesListQuery(params: {
  includeVoided?: boolean;
  soldByUserId?: string;
}): string {
  const q = new URLSearchParams();
  if (params.includeVoided) q.set("includeVoided", "true");
  if (params.soldByUserId) q.set("soldByUserId", params.soldByUserId);
  const s = q.toString();
  return s ? `/sales?${s}` : "/sales";
}

export function buildCommissionsSummaryQuery(params: {
  from?: string;
  to?: string;
  soldByUserId?: string;
}): string {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.soldByUserId) q.set("soldByUserId", params.soldByUserId);
  const s = q.toString();
  return s ? `/sales/commissions/summary?${s}` : "/sales/commissions/summary";
}

export function firstDayOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
