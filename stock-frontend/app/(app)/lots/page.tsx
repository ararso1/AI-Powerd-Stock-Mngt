"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateLotDialog } from "@/components/lots/create-lot-dialog";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeFilterBar,
  FrappeListToolbar,
} from "@/components/frappe";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
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
import { buildLotsListPath } from "@/lib/list-query";
import { formatDate, formatQty } from "@/lib/format";
import {
  COFFEE_FORM_OPTIONS,
  LOT_STATUS_OPTIONS,
  coffeeFormLabel,
  lotStatusLabel,
} from "@/lib/lots";
import type { CoffeeForm, Lot, LotStatus } from "@/lib/types";
import { useLocations } from "@/hooks/use-locations";
import { usePaginatedList } from "@/hooks/use-paginated-list";

const ALL = "__all__";

export default function LotsPage() {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<CoffeeForm | "">("");
  const [status, setStatus] = useState<LotStatus | "">("");
  const [locationId, setLocationId] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data: locations } = useLocations();

  const { rows, meta, setPage, setLimit, loading, reload } =
    usePaginatedList<Lot>(
      (page, limit) =>
        buildLotsListPath(
          {
            search: debouncedSearch || undefined,
            form: form || undefined,
            status: status || undefined,
            locationId: locationId === ALL ? undefined : locationId,
            from: from || undefined,
            to: to || undefined,
          },
          page,
          limit
        ),
      [debouncedSearch, form, status, locationId, from, to]
    );

  return (
    <AppShell
      title="Lots"
      subtitle="Coffee lot identity and step-by-step traceability"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Lots" },
      ]}
      actions={
        <PermissionGate permission="lot.write">
          <CreateLotDialog onSuccess={reload} />
        </PermissionGate>
      }
    >
      <PermissionGate permission="lot.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search code, grade, region…"
          />
          <div className="grid gap-2">
            <Label className="text-sm text-[var(--frappe-text-muted)]">
              Location
            </Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All locations</SelectItem>
                {(locations ?? []).map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-sm text-[var(--frappe-text-muted)]">
              Form
            </Label>
            <Select
              value={form || ALL}
              onValueChange={(v) =>
                setForm(v === ALL ? "" : (v as CoffeeForm))
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All forms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All forms</SelectItem>
                {COFFEE_FORM_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-sm text-[var(--frappe-text-muted)]">
              Status
            </Label>
            <Select
              value={status || ALL}
              onValueChange={(v) =>
                setStatus(v === ALL ? "" : (v as LotStatus))
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {LOT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
        </FrappeFilterBar>
        <FrappeListToolbar>
          <span className="text-[var(--frappe-text-muted)]">
            {meta.total} lot{meta.total === 1 ? "" : "s"}
          </span>
        </FrappeListToolbar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="No lots yet"
            emptyDescription="Create a lot to start end-to-end coffee traceability."
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={[
              {
                key: "code",
                header: "Lot code",
                cell: (r) => (
                  <Link
                    href={`/lots/${r.id}`}
                    className="font-medium text-[var(--frappe-primary)] hover:underline"
                  >
                    {r.code}
                  </Link>
                ),
              },
              {
                key: "form",
                header: "Form",
                cell: (r) => coffeeFormLabel(r.form),
              },
              {
                key: "grade",
                header: "Grade",
                cell: (r) => r.grade ?? "—",
              },
              {
                key: "qty",
                header: "Qty (kg)",
                cell: (r) => formatQty(r.quantity),
              },
              {
                key: "location",
                header: "Location",
                cell: (r) => r.location?.name ?? "—",
              },
              {
                key: "origin",
                header: "Origin",
                cell: (r) => r.region ?? "—",
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => (
                  <Badge variant="outline">{lotStatusLabel(r.status)}</Badge>
                ),
              },
              {
                key: "created",
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
