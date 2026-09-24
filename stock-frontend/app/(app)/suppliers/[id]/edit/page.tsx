"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { FrappeButtonLink } from "@/components/frappe";
import { api } from "@/lib/api";
import type { Supplier } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";

export default function EditSupplierPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: supplier, loading, error } = useFetch(
    () =>
      id
        ? api<Supplier>(`/suppliers/${id}`)
        : Promise.reject(new Error("Invalid supplier id")),
    [id]
  );

  return (
    <AppShell
      title={loading ? "Edit supplier" : `Edit · ${supplier?.name ?? "Supplier"}`}
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Suppliers", href: "/suppliers" },
        {
          label: supplier?.name ?? "…",
          href: id ? `/suppliers/${id}` : "/suppliers",
        },
        { label: "Edit" },
      ]}
    >
      <PermissionGate
        permission="suppliers.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            You do not have permission to edit suppliers.
          </p>
        }
      >
        {loading ? (
          <PageLoading />
        ) : error || !supplier ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Supplier not found
            </p>
            <FrappeButtonLink href="/suppliers" className="mt-4">
              Back to suppliers
            </FrappeButtonLink>
          </div>
        ) : (
          <SupplierForm supplier={supplier} />
        )}
      </PermissionGate>
    </AppShell>
  );
}
