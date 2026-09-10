"use client";

import { AppShell } from "@/components/app-shell";
import { CommandCenter } from "@/components/dashboard/command-center";
import { PermissionGate } from "@/components/permission-gate";

export default function DashboardPage() {
  return (
    <AppShell
      title="Command Center"
      subtitle="Executive pulse across coffee ops, contracts, and money"
      layout="default"
      breadcrumbs={[{ label: "Insights" }, { label: "Command Center" }]}
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
