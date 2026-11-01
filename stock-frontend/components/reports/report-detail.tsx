"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  GroupedBarChart,
  MiniBarChart,
} from "@/components/dashboard/dashboard-shared";
import {
  ReportFilters,
  type ReportFilterState,
} from "@/components/reports/report-filters";
import { ReportPaginatedTable } from "@/components/reports/report-paginated-table";
import type { Column } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { Button } from "@/components/ui/button";
import { useFetch } from "@/hooks/use-fetch";
import { api } from "@/lib/api";
import { applyCurrencyFromResponse } from "@/lib/currency";
import { buildListPath } from "@/lib/list-query";
import {
  resolvePeriodRange,
  toIsoDate,
  type PeriodPreset,
} from "@/lib/period-range";
import type { ReportDefinition } from "@/lib/reports/catalog";
import {
  downloadReportExport,
  type ReportFilterParams,
} from "@/lib/reports/download";
import {
  cellValue,
  extractReportKpis,
  extractReportRows,
  rowColumns,
} from "@/lib/reports/payload";

type ReportApiResponse = {
  report?: ReportDefinition;
  data: Record<string, unknown>;
};

function defaultCustomRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toIsoDate(from), to: toIsoDate(now) };
}

function initialFilterState(): ReportFilterState {
  const custom = defaultCustomRange();
  return {
    period: "this_month",
    customFrom: custom.from,
    customTo: custom.to,
    locationId: "",
    customerId: "",
    supplierId: "",
    soldByUserId: "",
    categoryId: "",
    channel: "",
    purchaseType: "",
    workflow: "",
    status: "",
    form: "",
    disposition: "",
    entityType: "",
    employmentStatus: "",
    symbol: "",
    direction: "",
    reason: "",
  };
}

function buildQueryParams(state: ReportFilterState): ReportFilterParams {
  const range = resolvePeriodRange(state.period, {
    customFrom: state.customFrom,
    customTo: state.customTo,
  });
  return {
    from: range.from,
    to: range.to,
    locationId: state.locationId || undefined,
    customerId: state.customerId || undefined,
    supplierId: state.supplierId || undefined,
    soldByUserId: state.soldByUserId || undefined,
    categoryId: state.categoryId || undefined,
    channel: state.channel || undefined,
    purchaseType: state.purchaseType || undefined,
    workflow: state.workflow || undefined,
    status: state.status || undefined,
    form: state.form || undefined,
    disposition: state.disposition || undefined,
    entityType: state.entityType || undefined,
    employmentStatus: state.employmentStatus || undefined,
    symbol: state.symbol || undefined,
    direction: state.direction || undefined,
    reason: state.reason || undefined,
  };
}

export function ReportDetail({
  reportId,
  meta,
}: {
  reportId: string;
  meta: ReportDefinition;
}) {
  const [filters, setFilters] = useState<ReportFilterState>(initialFilterState);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const queryParams = useMemo(() => buildQueryParams(filters), [filters]);
  const queryKey = useMemo(() => JSON.stringify(queryParams), [queryParams]);

  const customReady =
    filters.period !== "custom" ||
    Boolean(filters.customFrom && filters.customTo);

  const { data, loading, error } = useFetch(async () => {
    if (!customReady) return null;
    const path = buildListPath(`/reports/${reportId}`, {
      params: queryParams,
    });
    const res = await api<ReportApiResponse | Record<string, unknown>>(path);
    if (res && typeof res === "object" && "data" in res) {
      const wrapped = res as ReportApiResponse;
      applyCurrencyFromResponse(wrapped.data);
      return wrapped;
    }
    applyCurrencyFromResponse(res);
    return { data: res as Record<string, unknown> };
  }, [reportId, queryKey, customReady]);

  const rows = useMemo(() => extractReportRows(data?.data), [data]);
  const kpis = useMemo(() => extractReportKpis(data?.data), [data]);
  type TableRow = Record<string, unknown> & { id: string };

  const columns = useMemo(() => {
    const keys = rowColumns(rows);
    return keys.map(
      (key): Column<TableRow> => ({
        key,
        header: key
          .replace(/([A-Z])/g, " $1")
          .replace(/[._]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim(),
        cell: (row) => cellValue(row, key),
      })
    );
  }, [rows]);

  const tableRows: TableRow[] = useMemo(
    () =>
      rows.map((row, index) => ({
        ...row,
        id: String(row.id ?? row.itemId ?? row.date ?? index),
      })),
    [rows]
  );

  const searchKeys = useMemo(
    () =>
      rowColumns(rows).map(
        (key) => (row: TableRow) =>
          row[key] === undefined || row[key] === null
            ? ""
            : String(row[key])
      ),
    [rows]
  );

  const chart = useMemo(() => {
    const payload = data?.data;
    if (!payload) return null;
    const daily = payload.dailyBalances;
    if (Array.isArray(daily) && daily.length) {
      return {
        kind: "grouped" as const,
        data: (
          daily as { date: string; inflow: string; outflow: string }[]
        ).map((d) => ({
          label: d.date.slice(5),
          inflow: Number(d.inflow),
          outflow: Number(d.outflow),
        })),
        series: [
          { key: "inflow", name: "Inflow", color: "#2F6F4E" },
          { key: "outflow", name: "Outflow", color: "#8B4513" },
        ],
      };
    }
    for (const key of [
      "byCategory",
      "byStatus",
      "byForm",
      "byDisposition",
      "byDepartment",
    ] as const) {
      const arr = payload[key];
      if (!Array.isArray(arr) || !arr.length) continue;
      const sample = arr[0] as Record<string, unknown>;
      const labelKey =
        Object.keys(sample).find((k) =>
          [
            "category",
            "categoryName",
            "status",
            "form",
            "disposition",
            "department",
            "name",
          ].includes(k)
        ) ?? Object.keys(sample)[0];
      const valueKey =
        Object.keys(sample).find((k) =>
          ["total", "count", "quantity", "weightKg", "volumeKg"].includes(k)
        ) ??
        Object.keys(sample).find((k) => k !== labelKey) ??
        "count";
      return {
        kind: "mini" as const,
        data: (arr as Record<string, unknown>[]).map((row) => ({
          label: String(row[labelKey] ?? ""),
          value: Number(row[valueKey] ?? 0),
        })),
      };
    }
    return null;
  }, [data]);

  function patchFilters(patch: Partial<ReportFilterState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  async function onExport(format: "csv" | "pdf") {
    if (!customReady) {
      toast.error("Choose both custom dates first");
      return;
    }
    setExporting(format);
    try {
      await downloadReportExport(reportId, format, queryParams);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const periodLabel = useMemo(() => {
    if (filters.period === "lifetime") return "Lifetime";
    if (filters.period === "custom") {
      return `${filters.customFrom || "—"} → ${filters.customTo || "—"}`;
    }
    const range = resolvePeriodRange(filters.period as PeriodPreset, {
      customFrom: filters.customFrom,
      customTo: filters.customTo,
    });
    if (!range.from && !range.to) return "Lifetime";
    return `${range.from ?? "—"} → ${range.to ?? "—"}`;
  }, [filters]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/reports"
            className="text-xs text-[var(--frappe-text-muted)] hover:underline"
          >
            ← All reports
          </Link>
          <h2 className="mt-1 text-lg font-semibold text-[var(--frappe-text)]">
            {meta.title}
          </h2>
          <p className="text-sm text-[var(--frappe-text-muted)]">
            {meta.description}
          </p>
          <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
            Period: {periodLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!!exporting || !customReady}
            onClick={() => onExport("csv")}
          >
            {exporting === "csv" ? "Exporting…" : "Export CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!!exporting || !customReady}
            onClick={() => onExport("pdf")}
          >
            {exporting === "pdf" ? "Exporting…" : "Export PDF"}
          </Button>
        </div>
      </div>

      <ReportFilters
        reportId={reportId}
        state={filters}
        onChange={patchFilters}
        disabled={!!exporting}
      />

      {!customReady ? (
        <p className="text-sm text-[var(--frappe-text-muted)]">
          Select both custom From and To dates to load this report.
        </p>
      ) : loading ? (
        <PageLoading />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          {kpis.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-3 py-2"
                >
                  <div className="text-[11px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
                    {kpi.label}
                  </div>
                  <div className="mt-0.5 text-base font-semibold tabular-nums text-[var(--frappe-text)]">
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {chart && (
            <div className="rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-3">
              {chart.kind === "grouped" ? (
                <GroupedBarChart
                  data={chart.data}
                  series={chart.series}
                  emptyMessage="No cash-flow data in this period."
                />
              ) : (
                <MiniBarChart data={chart.data} />
              )}
            </div>
          )}

          {tableRows.length > 0 && columns.length > 0 ? (
            <ReportPaginatedTable
              rows={tableRows}
              columns={columns}
              emptyTitle="No rows for this period"
              search={search}
              onSearchChange={setSearch}
              searchKeys={searchKeys}
            />
          ) : (
            <p className="text-sm text-[var(--frappe-text-muted)]">
              No tabular rows for this report in the selected period. Summary
              KPIs above (if any) still export with CSV/PDF.
            </p>
          )}
        </>
      )}
    </div>
  );
}
