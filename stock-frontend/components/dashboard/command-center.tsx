"use client";

import { useEffect, useMemo, useState } from "react";
import { FlameIcon, PackageOpenIcon, ShipIcon } from "lucide-react";
import { PageLoading } from "@/components/shared/page-loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportDashboard } from "@/components/dashboard/export-dashboard";
import { ImportDashboard } from "@/components/dashboard/import-dashboard";
import { LocalDashboard } from "@/components/dashboard/local-dashboard";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { POLL_MS } from "@/components/dashboard/dashboard-shared";
import { api } from "@/lib/api";
import { applyCurrencyFromResponse } from "@/lib/currency";
import { errorMessage } from "@/lib/format";
import { buildListPath } from "@/lib/list-query";
import {
  resolvePeriodRange,
  toIsoDate,
  type PeriodPreset,
} from "@/lib/period-range";
import type { ExportDashboardData, LocalDashboardData } from "@/lib/types";
import { toast } from "sonner";

type DashboardTab = "local" | "export" | "import";

function defaultCustomRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toIsoDate(from), to: toIsoDate(now) };
}

export function CommandCenter() {
  const [tab, setTab] = useState<DashboardTab>("local");
  const [period, setPeriod] = useState<PeriodPreset>("lifetime");
  const initialCustom = defaultCustomRange();
  const [customFrom, setCustomFrom] = useState(initialCustom.from);
  const [customTo, setCustomTo] = useState(initialCustom.to);
  const [localData, setLocalData] = useState<LocalDashboardData | null>(null);
  const [exportData, setExportData] = useState<ExportDashboardData | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const range = useMemo(
    () =>
      resolvePeriodRange(period, {
        customFrom,
        customTo,
      }),
    [period, customFrom, customTo]
  );

  function handlePeriodChange(next: PeriodPreset) {
    if (next === "custom" && (!customFrom || !customTo)) {
      const defaults = defaultCustomRange();
      setCustomFrom(defaults.from);
      setCustomTo(defaults.to);
    }
    setPeriod(next);
  }

  useEffect(() => {
    if (tab === "import") {
      setLoading(false);
      return;
    }

    // Custom requires both ends before querying.
    if (period === "custom" && (!range.from || !range.to)) {
      return;
    }

    let cancelled = false;

    async function load(silent = false) {
      if (!silent) setLoading(true);
      try {
        const params = {
          from: range.from,
          to: range.to,
        };
        const path =
          tab === "local"
            ? buildListPath("/dashboard/local", { params })
            : buildListPath("/dashboard/export", { params });

        if (tab === "local") {
          const res = await api<LocalDashboardData>(path);
          if (cancelled) return;
          applyCurrencyFromResponse(res);
          setLocalData(res);
        } else {
          const res = await api<ExportDashboardData>(path);
          if (cancelled) return;
          applyCurrencyFromResponse(res);
          setExportData(res);
        }
      } catch (e) {
        if (!cancelled && !silent) toast.error(errorMessage(e));
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(true), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [range.from, range.to, tab, period]);

  const showLoading =
    tab !== "import" &&
    loading &&
    ((tab === "local" && !localData) || (tab === "export" && !exportData));

  return (
    <div className="flex flex-col gap-6">
      {tab !== "import" ? (
        <PeriodFilter
          value={period}
          onChange={handlePeriodChange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as DashboardTab)}
        className="gap-4"
      >
        <TabsList variant="line" className="h-auto w-full justify-start gap-0">
          <TabsTrigger value="local" className="gap-1.5 px-4 py-2">
            <FlameIcon className="size-4" />
            Local
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5 px-4 py-2">
            <ShipIcon className="size-4" />
            Export
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5 px-4 py-2">
            <PackageOpenIcon className="size-4" />
            Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="local" className="mt-2">
          {showLoading && tab === "local" ? (
            <PageLoading />
          ) : localData ? (
            <LocalDashboard data={localData} />
          ) : null}
        </TabsContent>

        <TabsContent value="export" className="mt-2">
          {showLoading && tab === "export" ? (
            <PageLoading />
          ) : exportData ? (
            <ExportDashboard data={exportData} />
          ) : null}
        </TabsContent>

        <TabsContent value="import" className="mt-2">
          <ImportDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
