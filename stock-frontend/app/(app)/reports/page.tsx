"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PermissionGate } from "@/components/permission-gate";
import { ReportHub } from "@/components/reports/report-hub";
import { legacyTabToReportId } from "@/lib/reports/catalog";

export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  useEffect(() => {
    if (!tab) return;
    const reportId = legacyTabToReportId(tab);
    router.replace(`/reports/${reportId}`);
  }, [tab, router]);

  if (tab) {
    return (
      <AppShell
        title="Reports"
        subtitle="Opening report…"
        breadcrumbs={[
          { label: "Stock", href: "/dashboard" },
          { label: "Reports" },
        ]}
      >
        <p className="text-sm text-[var(--frappe-text-muted)]">Redirecting…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Reports"
      subtitle="Finance, operations, partners, and audit — export any report as CSV or PDF."
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Reports" },
      ]}
    >
      <PermissionGate permission="reports.read">
        <ReportHub />
      </PermissionGate>
    </AppShell>
  );
}
