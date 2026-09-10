import { api } from "@/lib/api";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  paginateArray,
} from "@/lib/pagination";
import type { PaginatedResponse } from "@/lib/types";

export function unwrapList<T>(
  res: T[] | PaginatedResponse<T> | null | undefined
): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  return res.data ?? [];
}

export function unwrapMeta<T, Totals = undefined>(
  res: T[] | PaginatedResponse<T, Totals> | null | undefined
) {
  if (!res || Array.isArray(res)) return null;
  return res.meta ?? null;
}

export function unwrapTotals<T, Totals>(
  res: T[] | PaginatedResponse<T, Totals> | null | undefined
): Totals | null {
  if (!res || Array.isArray(res)) return null;
  return (res.totals as Totals | undefined) ?? null;
}

export async function apiList<T>(path: string): Promise<T[]> {
  const res = await api<T[] | PaginatedResponse<T>>(path);
  return unwrapList(res);
}

export async function apiPaginated<T, Totals = undefined>(
  path: string
): Promise<PaginatedResponse<T, Totals>> {
  const res = await api<T[] | PaginatedResponse<T, Totals>>(path);

  if (!Array.isArray(res)) {
    return {
      data: res.data ?? [],
      meta: res.meta ?? {
        page: DEFAULT_PAGE,
        limit: DEFAULT_LIMIT,
        total: res.data?.length ?? 0,
        totalPages: 1,
      },
      totals: res.totals,
    };
  }

  const params = new URLSearchParams(path.split("?")[1] ?? "");
  const page = Number(params.get("page") ?? DEFAULT_PAGE);
  const limit = Number(params.get("limit") ?? DEFAULT_LIMIT);

  return paginateArray(res, page, limit);
}
