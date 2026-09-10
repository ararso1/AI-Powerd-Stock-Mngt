"use client";

import { AppShell } from "@/components/app-shell";
import { SaleForm } from "@/components/sales/sale-form";
import { PermissionGate } from "@/components/permission-gate";

export default function NewSalePage() {
  return (
    <AppShell
      title="New Sales Invoice"
      subtitle="Not Saved"
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Sales Invoice", href: "/sales" },
        { label: "New" },
      ]}
    >
      <PermissionGate
        permission="sales.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            You do not have permission to create sales.
          </p>
        }
      >
        <SaleForm />
      </PermissionGate>
    </AppShell>
  );
}
