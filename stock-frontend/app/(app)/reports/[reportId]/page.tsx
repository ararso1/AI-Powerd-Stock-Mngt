"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PermissionGate } from "@/components/permission-gate";
import { ReportDetail } from "@/components/reports/report-detail";
import { findReport } from "@/lib/reports/catalog";

export default function ReportDetailPage() {
  const params = useParams<{ reportId: string }>();
  const reportId = params.reportId;
  const meta = findReport(reportId);

  if (!meta) {
    return (
      <AppShell
        title="Report not found"
        breadcrumbs={[
          { label: "Stock", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
        ]}
      >
        <p className="text-sm text-[var(--frappe-text-muted)]">
          Unknown report.{" "}
          <a href="/reports" className="underline">
            Back to reports
          </a>
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={meta.title}
      subtitle={meta.description}
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Reports", href: "/reports" },
        { label: meta.title },
      ]}
    >
      <PermissionGate permission="reports.read">
        <ReportDetail reportId={reportId} meta={meta} />
      </PermissionGate>
    </AppShell>
  );
}
