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
} from "@/components/frappe";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildExportsListPath } from "@/lib/list-query";
import { formatMoney, formatQty } from "@/lib/format";
import type { ExportContract, ExportContractStatus } from "@/lib/types";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { PlusIcon } from "lucide-react";

const ALL = "__all__";

export default function ExportsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ExportContractStatus | "">("");
  const debouncedSearch = useDebouncedValue(search);

  const { rows, meta, setPage, setLimit, loading } =
    usePaginatedList<ExportContract>(
      (page, limit) =>
        buildExportsListPath(
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
      title="Exports"
      subtitle="Export order → allocate → stage → ship → deliver"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Exports" },
      ]}
      actions={
        <PermissionGate permission="export.write">
          <FrappeButtonPrimary asChild>
            <Link href="/exports/new">
              <PlusIcon className="size-3.5" />
              New contract
            </Link>
          </FrappeButtonPrimary>
        </PermissionGate>
      }
    >
      <PermissionGate permission="export.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search buyer, country, container…"
          />
          <Select
            value={status || ALL}
            onValueChange={(v) =>
              setStatus(v === ALL ? "" : (v as ExportContractStatus))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {(
                [
                  "DRAFT",
                  "ALLOCATED",
                  "STAGED",
                  "SHIPPED",
                  "DELIVERED",
                  "CLOSED",
                  "CANCELLED",
                ] as ExportContractStatus[]
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FrappeFilterBar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="No export contracts"
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={[
              {
                key: "number",
                header: "Contract",
                cell: (r) => (
                  <Link
                    href={`/exports/${r.id}`}
                    className="font-medium text-[var(--frappe-primary)] hover:underline"
                  >
                    {r.contractNumber}
                    {r.orderNumber ? (
                      <span className="ml-1 text-xs text-[var(--frappe-text-muted)]">
                        · {r.orderNumber}
                      </span>
                    ) : null}
                  </Link>
                ),
              },
              {
                key: "buyer",
                header: "Buyer",
                cell: (r) => (
                  <div>
                    <div>{r.buyerName}</div>
                    {r.buyerCountry ? (
                      <div className="text-xs text-[var(--frappe-text-muted)]">
                        {r.buyerCountry}
                      </div>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "destination",
                header: "Destination",
                cell: (r) => r.destination ?? "—",
              },
              {
                key: "volume",
                header: "Volume",
                cell: (r) =>
                  `${formatQty(r.allocatedKg)} / ${formatQty(r.volumeKg)} kg`,
              },
              {
                key: "price",
                header: "Price",
                cell: (r) =>
                  `${r.currencyCode} ${formatMoney(r.pricePerKg)}/kg`,
              },
              {
                key: "terms",
                header: "Incoterm",
                cell: (r) => r.incoterm,
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => <Badge variant="outline">{r.status}</Badge>,
              },
            ]}
          />
        )}
      </PermissionGate>
    </AppShell>
  );
}
