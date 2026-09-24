"use client";

import { AppShell } from "@/components/app-shell";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { PermissionGate } from "@/components/permission-gate";

export default function NewSupplierPage() {
  return (
    <AppShell
      title="Register supplier"
      subtitle="Coffee procurement partner"
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Suppliers", href: "/suppliers" },
        { label: "New" },
      ]}
    >
      <PermissionGate
        permission="suppliers.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            You do not have permission to register suppliers.
          </p>
        }
      >
        <SupplierForm />
      </PermissionGate>
    </AppShell>
  );
}
