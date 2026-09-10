"use client";

import { AppShell } from "@/components/app-shell";
import { BomForm } from "@/components/boms/bom-form";
import { PermissionGate } from "@/components/permission-gate";

export default function NewBomPage() {
  return (
    <AppShell
      title="New BOM"
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "BOMs", href: "/boms" },
        { label: "New" },
      ]}
    >
      <PermissionGate permission="bom.write">
        <BomForm />
      </PermissionGate>
    </AppShell>
  );
}
