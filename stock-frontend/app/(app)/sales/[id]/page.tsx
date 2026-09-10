"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SaleDetail } from "@/components/sales/sale-detail";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@/lib/api";
import type { Sale } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { FrappeButtonLink } from "@/components/frappe";

export default function SaleDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: sale, loading, error } = useFetch(
    () =>
      id
        ? api<Sale>(`/sales/${id}`)
        : Promise.reject(new Error("Invalid sale id")),
    [id]
  );

  const title = sale?.customer?.name
    ? `Sale — ${sale.customer.name}`
    : "Sales Invoice";

  return (
    <AppShell
      title={loading ? "Sales Invoice" : title}
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Sales Invoice", href: "/sales" },
        { label: id ? id.slice(0, 8) : "…" },
      ]}
    >
      <PermissionGate permission="sales.read">
        {loading ? (
          <PageLoading />
        ) : error || !sale ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Sale not found
            </p>
            <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
              {error ?? "This record may have been removed."}
            </p>
            <FrappeButtonLink href="/sales" className="mt-4">
              Back to sales
            </FrappeButtonLink>
          </div>
        ) : (
          <SaleDetail sale={sale} />
        )}
      </PermissionGate>
    </AppShell>
  );
}
