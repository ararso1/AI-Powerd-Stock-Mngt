"use client";

import { useMemo } from "react";
import {
  DataCardTable,
  type Column,
} from "@/components/shared/data-card-table";
import { ListSearchField } from "@/components/shared/list-search-field";
import { FrappeFilterBar, FrappeListToolbar } from "@/components/frappe";
import { useClientPaginatedList } from "@/hooks/use-client-paginated-list";
import {
  filterReportRows,
  type ReportRowKey,
} from "@/lib/report-list";

export function ReportPaginatedTable<T extends { id: string }>({
  rows,
  columns,
  emptyTitle,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  searchKeys,
  filters,
  toolbarExtra,
  disabled,
}: {
  rows: T[];
  columns: Column<T>[];
  emptyTitle: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchKeys: ReportRowKey<T>[];
  filters?: React.ReactNode;
  toolbarExtra?: React.ReactNode;
  disabled?: boolean;
}) {
  const filtered = useMemo(
    () => filterReportRows(rows, search, searchKeys),
    [rows, search, searchKeys]
  );
  const { rows: pageRows, meta, setPage, setLimit } = useClientPaginatedList(
    filtered,
    [filtered]
  );

  return (
    <div className="space-y-3">
      <FrappeFilterBar>
        <ListSearchField
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          disabled={disabled}
        />
        {filters}
      </FrappeFilterBar>
      <FrappeListToolbar>
        <span className="text-[var(--frappe-text-muted)]">
          {meta.total} record{meta.total === 1 ? "" : "s"}
        </span>
        {toolbarExtra}
      </FrappeListToolbar>
      <DataCardTable
        rows={pageRows}
        emptyTitle={emptyTitle}
        pagination={{
          meta,
          onPageChange: setPage,
          onLimitChange: setLimit,
          disabled,
        }}
        columns={columns}
      />
    </div>
  );
}
