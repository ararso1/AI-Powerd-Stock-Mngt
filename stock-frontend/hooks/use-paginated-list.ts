"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { paginateArray } from "@/lib/pagination";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  EMPTY_PAGINATION_META,
} from "@/lib/pagination";
import type { PaginatedMeta, PaginatedResponse } from "@/lib/types";
import { toast } from "sonner";

export function usePaginatedList<T, Totals = undefined>(
  buildPath: (page: number, limit: number) => string | null,
  deps: unknown[] = [],
  options?: { initialLimit?: number }
) {
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState(options?.initialLimit ?? DEFAULT_LIMIT);
  const [rows, setRows] = useState<T[]>([]);
  const [allRows, setAllRows] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta>(EMPTY_PAGINATION_META);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const path = buildPath(page, limit);

  const reload = useCallback(async () => {
    if (!path) {
      setRows([]);
      setAllRows([]);
      setMeta(EMPTY_PAGINATION_META);
      setTotals(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const raw = await api<T[] | PaginatedResponse<T, Totals>>(path);
      let result: PaginatedResponse<T, Totals>;

      if (Array.isArray(raw)) {
        result = paginateArray(raw, page, limit);
        setAllRows(raw);
        setTotals(null);
      } else {
        result = {
          data: raw.data ?? [],
          meta: raw.meta ?? {
            page,
            limit,
            total: raw.data?.length ?? 0,
            totalPages: 1,
          },
          totals: raw.totals,
        };
        setAllRows(result.data);
        setTotals(raw.totals ?? null);
      }

      setRows(result.data);
      setMeta(result.meta);
      if (result.meta.page !== page) {
        setPage(result.meta.page);
      }
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    setPage(DEFAULT_PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  const setLimitAndReset = useCallback((nextLimit: number) => {
    setLimit(nextLimit);
    setPage(DEFAULT_PAGE);
  }, []);

  return {
    rows,
    allRows,
    meta,
    totals,
    page,
    limit,
    setPage,
    setLimit: setLimitAndReset,
    loading,
    error,
    reload,
    total: meta.total,
  };
}
