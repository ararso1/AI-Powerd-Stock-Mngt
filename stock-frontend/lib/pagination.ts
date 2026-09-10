import type { PaginatedMeta, PaginatedResponse } from "@/lib/types";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const MAX_LIMIT = 100;

export const EMPTY_PAGINATION_META: PaginatedMeta = {
  page: 1,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
};

export function appendPagination(
  path: string,
  page: number,
  limit: number
): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("page", String(page));
  params.set("limit", String(Math.min(limit, MAX_LIMIT)));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function paginateArray<T, Totals = undefined>(
  items: T[],
  page: number,
  limit: number
): PaginatedResponse<T, Totals> {
  const safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safeLimit;

  return {
    data: items.slice(start, start + safeLimit),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
    },
  };
}

export function paginationLabel(meta: PaginatedMeta): string {
  if (meta.total === 0) return "0 records";
  const start = (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.page * meta.limit, meta.total);
  return `${start}–${end} of ${meta.total}`;
}
