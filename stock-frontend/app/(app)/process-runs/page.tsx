"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeButtonPrimary,
  FrappeFilterBar,
  FrappeListToolbar,
} from "@/components/frappe";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildProcessRunsListPath } from "@/lib/list-query";
import { formatDate, formatQty } from "@/lib/format";
import {
  PROCESS_STATUS_OPTIONS,
  processStatusLabel,
} from "@/lib/process-runs";
import type { ProcessRun, ProcessRunStatus } from "@/lib/types";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { PlusIcon } from "lucide-react";

const ALL = "__all__";

export default function ProcessRunsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProcessRunStatus | "">("");
  const debouncedSearch = useDebouncedValue(search);

  const { rows, meta, setPage, setLimit, loading } =
    usePaginatedList<ProcessRun>(
      (page, limit) =>
        buildProcessRunsListPath(
          {
            search: debouncedSearch || undefined,
            status: status || undefined,
          },
          page,
          limit
        ),
      [debouncedSearch, status]
    );

  return (
    <AppShell
      title="Processing"
      subtitle="Mill process runs with stages, QC gates, and yield"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Processing" },
      ]}
      actions={
        <PermissionGate permission="process.write">
          <FrappeButtonPrimary asChild>
            <Link href="/process-runs/new">
              <PlusIcon className="size-3.5" />
              New run
            </Link>
          </FrappeButtonPrimary>
        </PermissionGate>
      }
    >
      <PermissionGate permission="process.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search run, template, lot…"
          />
          <div className="grid gap-2">
            <Label className="text-sm text-[var(--frappe-text-muted)]">
              Status
            </Label>
            <Select
              value={status || ALL}
              onValueChange={(v) =>
                setStatus(v === ALL ? "" : (v as ProcessRunStatus))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {PROCESS_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FrappeFilterBar>
        <FrappeListToolbar>
          <span className="text-[var(--frappe-text-muted)]">
            {meta.total} run{meta.total === 1 ? "" : "s"}
          </span>
        </FrappeListToolbar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="No process runs"
            emptyDescription="Start a washed or natural process from a cherry/parchment lot."
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={[
              {
                key: "run",
                header: "Run",
                cell: (r) => (
                  <Link
                    href={`/process-runs/${r.id}`}
                    className="font-medium text-[var(--frappe-primary)] hover:underline"
                  >
                    {r.runNumber}
                  </Link>
                ),
              },
              {
                key: "template",
                header: "Template",
                cell: (r) => r.template?.name ?? "—",
              },
              {
                key: "input",
                header: "Input lot",
                cell: (r) =>
                  r.inputLot ? (
                    <Link
                      href={`/lots/${r.inputLotId}`}
                      className="text-[var(--frappe-primary)] hover:underline"
                    >
                      {r.inputLot.code}
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "qty",
                header: "Input kg",
                cell: (r) => formatQty(r.quantityInput),
              },
              {
                key: "yield",
                header: "Yield %",
                cell: (r) =>
                  r.actualYieldPercent
                    ? `${formatQty(r.actualYieldPercent)}%`
                    : `~${formatQty(r.expectedYieldPercent)}%`,
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => (
                  <Badge variant="outline">
                    {processStatusLabel(r.status)}
                  </Badge>
                ),
              },
              {
                key: "date",
                header: "Created",
                cell: (r) => formatDate(r.createdAt),
              },
            ]}
          />
        )}
      </PermissionGate>
    </AppShell>
  );
}
