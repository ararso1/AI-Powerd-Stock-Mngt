"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SaleForm } from "@/components/sales/sale-form";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { FrappeButtonLink } from "@/components/frappe";
import { api } from "@/lib/api";
import type { Sale } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";

export default function EditSalePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: sale, loading, error } = useFetch(
    () =>
      id
        ? api<Sale>(`/sales/${id}`)
        : Promise.reject(new Error("Invalid sale id")),
    [id]
  );

  const isVoided = sale?.status === "VOIDED";

  return (
    <AppShell
      title={loading ? "Edit Sale" : `Edit — ${sale?.customer?.name ?? "Sale"}`}
      subtitle={isVoided ? "Voided" : "Amend document"}
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Sales Invoice", href: "/sales" },
        { label: id ? id.slice(0, 8) : "…", href: `/sales/${id}` },
        { label: "Edit" },
      ]}
    >
      <PermissionGate
        permission="sales.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            You do not have permission to edit sales.
          </p>
        }
      >
        {loading ? (
          <PageLoading />
        ) : error || !sale ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Sale not found
            </p>
            <FrappeButtonLink href="/sales" className="mt-4">
              Back to sales
            </FrappeButtonLink>
          </div>
        ) : isVoided ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              This sale is voided and cannot be edited.
            </p>
            <FrappeButtonLink href={`/sales/${id}`} className="mt-4">
              View sale
            </FrappeButtonLink>
          </div>
        ) : (
          <SaleForm sale={sale} />
        )}
      </PermissionGate>
    </AppShell>
  );
}
