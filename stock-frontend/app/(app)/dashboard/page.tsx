"use client";

import { AppShell } from "@/components/app-shell";
import { CommandCenter } from "@/components/dashboard/command-center";
import { PermissionGate } from "@/components/permission-gate";

export default function DashboardPage() {
  return (
    <AppShell
      title="Dashboard"
      subtitle="AI insights + analytical KPIs across inventory, trading, quality, finance, production, and export"
      layout="default"
      breadcrumbs={[{ label: "Overview" }, { label: "Dashboard" }]}
    >
      <PermissionGate
        permissions={["insights.read", "dashboard.read"]}
        fallback={
          <p className="text-muted-foreground">
            You do not have permission to view the command center.
          </p>
        }
      >
        <CommandCenter />
      </PermissionGate>
    </AppShell>
  );
}
