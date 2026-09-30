"use client";

import { AppShell } from "@/components/app-shell";
import { ProcessRunForm } from "@/components/process-runs/process-run-form";
import { PermissionGate } from "@/components/permission-gate";

export default function NewLocalProcessRunPage() {
  return (
    <AppShell
      title="Local market processing"
      subtitle="Cleaning, roast and ground, then the sales store"
      variant="form"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Processing", href: "/process-runs" },
        { label: "New run", href: "/process-runs/new" },
        { label: "Local market" },
      ]}
    >
      <PermissionGate
        permission="process.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            You do not have permission to create process runs.
          </p>
        }
      >
        <ProcessRunForm workflow="LOCAL" />
      </PermissionGate>
    </AppShell>
  );
}
