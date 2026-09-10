"use client";

import { AppShell } from "@/components/app-shell";
import { ProcessRunForm } from "@/components/process-runs/process-run-form";
import { PermissionGate } from "@/components/permission-gate";

export default function NewProcessRunPage() {
  return (
    <AppShell
      title="New process run"
      subtitle="Not saved"
      variant="form"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Processing", href: "/process-runs" },
        { label: "New run" },
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
        <ProcessRunForm />
      </PermissionGate>
    </AppShell>
  );
}
