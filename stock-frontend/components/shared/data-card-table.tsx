"use client";

import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  type TablePaginationProps,
} from "@/components/shared/table-pagination";
import { unwrapList } from "@/lib/list-response";
import type { PaginatedResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

function cellClass(className?: string) {
  return cn("text-left", className);
}

export function DataCardTable<T extends { id: string }>({
  columns,
  rows,
  emptyTitle = "No records",
  emptyDescription,
  pagination,
}: {
  columns: Column<T>[];
  rows: T[] | PaginatedResponse<T> | null | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: Omit<TablePaginationProps, "disabled"> & { disabled?: boolean };
}) {
  const list = unwrapList(rows);
  const showPagination = pagination && pagination.meta.total > 0;

  if (list.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] shadow-sm">
      <div className="overflow-x-auto">
        <table className="frappe-list-table w-full">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={cellClass(col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id}>
                {columns.map((col) => (
                  <td key={col.key} className={cellClass(col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPagination ? (
        <TablePagination
          meta={pagination.meta}
          onPageChange={pagination.onPageChange}
          onLimitChange={pagination.onLimitChange}
          disabled={pagination.disabled}
        />
      ) : null}
    </div>
  );
}
