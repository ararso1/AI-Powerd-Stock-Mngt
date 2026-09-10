"use client";

import { AppShell } from "@/components/app-shell";
import { ProductionOrderForm } from "@/components/production/production-order-form";
import { PermissionGate } from "@/components/permission-gate";

export default function NewProductionOrderPage() {
  return (
    <AppShell
      title="New production order"
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Production", href: "/production-orders" },
        { label: "New" },
      ]}
    >
      <PermissionGate permission="production.write">
        <ProductionOrderForm />
      </PermissionGate>
    </AppShell>
  );
}
