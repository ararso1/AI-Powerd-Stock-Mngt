"use client";

import { AppShell } from "@/components/app-shell";
import { PurchaseForm } from "@/components/purchases/purchase-form";
import { PermissionGate } from "@/components/permission-gate";

export default function NewPurchasePage() {
  return (
    <AppShell
      title="New Purchase"
      subtitle="Not Saved"
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Purchase", href: "/purchases" },
        { label: "New Purchase" },
      ]}
    >
      <PermissionGate
        permission="purchase.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            You do not have permission to create purchases.
          </p>
        }
      >
        <PurchaseForm />
      </PermissionGate>
    </AppShell>
  );
}
