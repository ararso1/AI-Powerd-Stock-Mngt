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
import { buildBomsListPath } from "@/lib/list-query";
import { formatDate } from "@/lib/format";
import type { Bom } from "@/lib/types";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { PlusIcon } from "lucide-react";

export default function BomsPage() {
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<"all" | "true" | "false">("true");
  const debouncedSearch = useDebouncedValue(search);

  const { rows, meta, setPage, setLimit, loading } = usePaginatedList<Bom>(
    (page, limit) =>
      buildBomsListPath(
        {
          search: debouncedSearch || undefined,
          isActive:
            isActive === "all" ? undefined : isActive === "true",
        },
        page,
        limit
      ),
    [debouncedSearch, isActive]
  );

  return (
    <AppShell
      title="Bills of Materials"
      subtitle="Recipes for finished goods"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "BOMs" },
      ]}
      actions={
        <PermissionGate permission="bom.write">
          <FrappeButtonPrimary asChild>
            <Link href="/boms/new">
              <PlusIcon className="size-3.5" />
              New BOM
            </Link>
          </FrappeButtonPrimary>
        </PermissionGate>
      }
    >
      <PermissionGate permission="bom.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search BOMs…"
          />
          <div className="grid gap-2">
            <Label className="text-sm text-[var(--frappe-text-muted)]">
              Status
            </Label>
            <Select
              value={isActive}
              onValueChange={(v) =>
                setIsActive(v as "all" | "true" | "false")
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FrappeFilterBar>
        <FrappeListToolbar>
          <span className="text-[var(--frappe-text-muted)]">
            {meta.total} BOM{meta.total === 1 ? "" : "s"}
          </span>
        </FrappeListToolbar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="No BOMs"
            emptyDescription="Create a bill of materials for a finished item."
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={[
              {
                key: "name",
                header: "Name",
                cell: (r) => (
                  <Link
                    href={`/boms/${r.id}`}
                    className="font-medium text-[var(--frappe-primary)] hover:underline"
                  >
                    {r.name}
                  </Link>
                ),
              },
              {
                key: "finished",
                header: "Finished item",
                cell: (r) => r.finishedItem?.description ?? "—",
              },
              {
                key: "version",
                header: "Version",
                cell: (r) => r.version ?? "—",
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => (
                  <Badge
                    variant={r.isActive === false ? "secondary" : "outline"}
                  >
                    {r.isActive === false ? "Inactive" : "Active"}
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
