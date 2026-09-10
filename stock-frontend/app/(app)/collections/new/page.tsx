"use client";

import { AppShell } from "@/components/app-shell";
import { CollectionForm } from "@/components/collections/collection-form";
import { PermissionGate } from "@/components/permission-gate";

export default function NewCollectionPage() {
  return (
    <AppShell
      title="New cherry intake"
      subtitle="Not saved"
      variant="form"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Collection", href: "/collections" },
        { label: "New intake" },
      ]}
    >
      <PermissionGate
        permission="collection.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            You do not have permission to record collections.
          </p>
        }
      >
        <CollectionForm />
      </PermissionGate>
    </AppShell>
  );
}
