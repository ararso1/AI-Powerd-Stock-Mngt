"use client";

import { useMemo } from "react";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { ReportEntityFilter } from "@/components/reports/report-entity-filter";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { api } from "@/lib/api";
import { apiList } from "@/lib/list-response";
import {
  fetchCustomers,
  fetchSuppliers,
  formatPartyLabel,
} from "@/lib/party-fetch";
import type { PeriodPreset } from "@/lib/period-range";
import { locationFilterOptions } from "@/lib/report-list";
import {
  ADJUSTMENT_REASON_OPTIONS,
  CHANNEL_OPTIONS,
  COFFEE_FORM_OPTIONS,
  DIRECTION_OPTIONS,
  DISPOSITION_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  ENTITY_TYPE_OPTIONS,
  PURCHASE_TYPE_OPTIONS,
  REPORT_FILTERS,
  SYMBOL_OPTIONS,
  statusOptionsForReport,
  type ReportFilterKey,
} from "@/lib/reports/filter-config";
import type { ExpenseCategory, UserAdmin } from "@/lib/types";

export type ReportFilterState = {
  period: PeriodPreset;
  customFrom: string;
  customTo: string;
  locationId: string;
  customerId: string;
  supplierId: string;
  soldByUserId: string;
  categoryId: string;
  channel: string;
  purchaseType: string;
  workflow: string;
  status: string;
  form: string;
  disposition: string;
  entityType: string;
  employmentStatus: string;
  symbol: string;
  direction: string;
  reason: string;
};

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-[var(--frappe-text-muted)]">{label}</Label>
      <Select
        value={value || "__all__"}
        onValueChange={(v) => onChange(v === "__all__" ? "" : v)}
      >
        <SelectTrigger className="h-9 w-[160px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{allLabel}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ReportFilters({
  reportId,
  state,
  onChange,
  disabled,
}: {
  reportId: string;
  state: ReportFilterState;
  onChange: (patch: Partial<ReportFilterState>) => void;
  disabled?: boolean;
}) {
  const keys = REPORT_FILTERS[reportId] ?? [];
  const has = (key: ReportFilterKey) => keys.includes(key);

  const { data: locations = [] } = useLocations();
  const { data: customers = [] } = useFetch(
    () => (has("customer") ? fetchCustomers() : Promise.resolve([])),
    [reportId]
  );
  const { data: suppliers = [] } = useFetch(
    () => (has("supplier") ? fetchSuppliers() : Promise.resolve([])),
    [reportId]
  );
  const { data: users = [] } = useFetch(
    () => (has("soldBy") ? apiList<UserAdmin>("/users") : Promise.resolve([])),
    [reportId]
  );
  const { data: categories = [] } = useFetch(
    () =>
      has("category")
        ? api<ExpenseCategory[]>("/expenses/categories")
        : Promise.resolve([]),
    [reportId]
  );

  const customerOptions = useMemo(
    () =>
      (customers ?? []).map((c) => ({
        value: c.id,
        label: formatPartyLabel(c),
      })),
    [customers]
  );
  const supplierOptions = useMemo(
    () =>
      (suppliers ?? []).map((s) => ({
        value: s.id,
        label: formatPartyLabel(s),
      })),
    [suppliers]
  );
  const userOptions = useMemo(
    () =>
      (users ?? []).map((u) => ({
        value: u.id,
        label: u.fullName || u.email,
      })),
    [users]
  );
  const categoryOptions = useMemo(
    () =>
      (categories ?? []).map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [categories]
  );

  const statusOptions = statusOptionsForReport(reportId);

  function handlePeriodChange(next: PeriodPreset) {
    if (next === "custom" && (!state.customFrom || !state.customTo)) {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      const toIso = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      onChange({
        period: next,
        customFrom: toIso(from),
        customTo: toIso(now),
      });
      return;
    }
    onChange({ period: next });
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-3">
      <PeriodFilter
        value={state.period}
        onChange={handlePeriodChange}
        customFrom={state.customFrom}
        customTo={state.customTo}
        onCustomFromChange={(v) => onChange({ customFrom: v })}
        onCustomToChange={(v) => onChange({ customTo: v })}
        disabled={disabled}
      />

      {(has("location") ||
        has("customer") ||
        has("supplier") ||
        has("soldBy") ||
        has("category") ||
        has("channel") ||
        has("purchaseType") ||
        has("workflow") ||
        has("status") ||
        has("form") ||
        has("disposition") ||
        has("entityType") ||
        has("employmentStatus") ||
        has("symbol") ||
        has("direction") ||
        has("reason")) && (
        <div className="space-y-2 border-t border-[var(--frappe-border)] pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--frappe-text-muted)]">
            Filters
          </p>
          <div className="flex flex-wrap items-end gap-3">
            {has("location") && (
              <FilterSelect
                label="Location"
                value={state.locationId}
                onChange={(v) => onChange({ locationId: v })}
                options={locationFilterOptions(locations ?? [])}
                allLabel="All locations"
              />
            )}
            {has("channel") && (
              <FilterSelect
                label="Channel"
                value={state.channel}
                onChange={(v) => onChange({ channel: v })}
                options={CHANNEL_OPTIONS}
                allLabel="All channels"
              />
            )}
            {has("purchaseType") && (
              <FilterSelect
                label="Purchase type"
                value={state.purchaseType}
                onChange={(v) => onChange({ purchaseType: v })}
                options={PURCHASE_TYPE_OPTIONS}
                allLabel="All types"
              />
            )}
            {has("workflow") && (
              <FilterSelect
                label="Workflow"
                value={state.workflow}
                onChange={(v) => onChange({ workflow: v })}
                options={PURCHASE_TYPE_OPTIONS}
                allLabel="All workflows"
              />
            )}
            {has("status") && statusOptions.length > 0 && (
              <FilterSelect
                label="Status"
                value={state.status}
                onChange={(v) => onChange({ status: v })}
                options={statusOptions}
                allLabel="All statuses"
              />
            )}
            {has("form") && (
              <FilterSelect
                label="Coffee form"
                value={state.form}
                onChange={(v) => onChange({ form: v })}
                options={COFFEE_FORM_OPTIONS}
                allLabel="All forms"
              />
            )}
            {has("disposition") && (
              <FilterSelect
                label="Disposition"
                value={state.disposition}
                onChange={(v) => onChange({ disposition: v })}
                options={DISPOSITION_OPTIONS}
                allLabel="All dispositions"
              />
            )}
            {has("entityType") && (
              <FilterSelect
                label="Entity type"
                value={state.entityType}
                onChange={(v) => onChange({ entityType: v })}
                options={ENTITY_TYPE_OPTIONS}
                allLabel="All entities"
              />
            )}
            {has("employmentStatus") && (
              <FilterSelect
                label="Employment"
                value={state.employmentStatus}
                onChange={(v) => onChange({ employmentStatus: v })}
                options={EMPLOYMENT_STATUS_OPTIONS}
                allLabel="All statuses"
              />
            )}
            {has("symbol") && (
              <FilterSelect
                label="Symbol"
                value={state.symbol}
                onChange={(v) => onChange({ symbol: v })}
                options={SYMBOL_OPTIONS}
                allLabel="All symbols"
              />
            )}
            {has("direction") && (
              <FilterSelect
                label="Direction"
                value={state.direction}
                onChange={(v) => onChange({ direction: v })}
                options={DIRECTION_OPTIONS}
                allLabel="All directions"
              />
            )}
            {has("reason") && (
              <FilterSelect
                label="Reason"
                value={state.reason}
                onChange={(v) => onChange({ reason: v })}
                options={ADJUSTMENT_REASON_OPTIONS}
                allLabel="All reasons"
              />
            )}
            {has("customer") && (
              <ReportEntityFilter
                label="Customer"
                value={state.customerId}
                onValueChange={(v) => onChange({ customerId: v })}
                options={customerOptions}
                placeholder="All customers"
              />
            )}
            {has("supplier") && (
              <ReportEntityFilter
                label="Supplier"
                value={state.supplierId}
                onValueChange={(v) => onChange({ supplierId: v })}
                options={supplierOptions}
                placeholder="All suppliers"
              />
            )}
            {has("soldBy") && (
              <ReportEntityFilter
                label="Sales rep"
                value={state.soldByUserId}
                onValueChange={(v) => onChange({ soldByUserId: v })}
                options={userOptions}
                placeholder="All reps"
              />
            )}
            {has("category") && (
              <ReportEntityFilter
                label="Expense category"
                value={state.categoryId}
                onValueChange={(v) => onChange({ categoryId: v })}
                options={categoryOptions}
                placeholder="All categories"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
