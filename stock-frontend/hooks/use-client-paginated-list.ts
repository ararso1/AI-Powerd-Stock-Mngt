"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  EMPTY_PAGINATION_META,
  paginateArray,
} from "@/lib/pagination";

export function useClientPaginatedList<T>(
  items: T[] | null | undefined,
  deps: unknown[] = [],
  options?: { initialLimit?: number }
) {
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState(options?.initialLimit ?? DEFAULT_LIMIT);

  useEffect(() => {
    setPage(DEFAULT_PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const list = items ?? [];
  const result = useMemo(
    () =>
      list.length > 0
        ? paginateArray(list, page, limit)
        : { data: [] as T[], meta: EMPTY_PAGINATION_META },
    [list, page, limit]
  );

  const setLimitAndReset = useCallback((nextLimit: number) => {
    setLimit(nextLimit);
    setPage(DEFAULT_PAGE);
  }, []);

  return {
    rows: result.data,
    allRows: list,
    meta: result.meta,
    page,
    limit,
    setPage,
    setLimit: setLimitAndReset,
    loading: false,
    total: result.meta.total,
  };
}
