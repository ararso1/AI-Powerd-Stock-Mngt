"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { CustomerForm } from "@/components/customers/customer-form";
import { FrappeButtonLink } from "@/components/frappe";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";

export default function EditCustomerPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: customer, loading, error } = useFetch(
    () =>
      id
        ? api<Customer>(`/customers/${id}`)
        : Promise.reject(new Error("Invalid customer id")),
    [id]
  );

  return (
    <AppShell
      title={
        loading ? "Edit customer" : `Edit · ${customer?.name ?? "Customer"}`
      }
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Customers", href: "/customers" },
        {
          label: customer?.name ?? "…",
          href: id ? `/customers/${id}` : "/customers",
        },
        { label: "Edit" },
      ]}
    >
      <PermissionGate
        permission="customers.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            You do not have permission to edit customers.
          </p>
        }
      >
        {loading ? (
          <PageLoading />
        ) : error || !customer ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Customer not found
            </p>
            <FrappeButtonLink href="/customers" className="mt-4">
              Back to customers
            </FrappeButtonLink>
          </div>
        ) : (
          <CustomerForm customer={customer} />
        )}
      </PermissionGate>
    </AppShell>
  );
}
