"use client";

import { AppShell } from "@/components/app-shell";
import { CustomerForm } from "@/components/customers/customer-form";
import { PermissionGate } from "@/components/permission-gate";

export default function NewCustomerPage() {
  return (
    <AppShell
      title="New customer"
      subtitle="Local or international (export) buyer profile"
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Customers", href: "/customers" },
        { label: "New" },
      ]}
    >
      <PermissionGate
        permission="customers.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            You do not have permission to create customers.
          </p>
        }
      >
        <CustomerForm />
      </PermissionGate>
    </AppShell>
  );
}
