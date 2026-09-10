"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProductionOrderDetail } from "@/components/production/production-order-detail";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { FrappeButtonLink } from "@/components/frappe";
import { api } from "@/lib/api";
import type { ProductionOrder } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";

export default function ProductionOrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: order, loading, error, reload } = useFetch(
    () =>
      id
        ? api<ProductionOrder>(`/production-orders/${id}`)
        : Promise.reject(new Error("Invalid order id")),
    [id]
  );

  const title =
    order?.bom?.name ??
    order?.finishedItem?.description ??
    (loading ? "Production order" : "Production order");

  return (
    <AppShell
      title={title}
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Production", href: "/production-orders" },
        { label: id ? id.slice(0, 8) : "…" },
      ]}
    >
      <PermissionGate permission="production.read">
        {loading ? (
          <PageLoading />
        ) : error || !order ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Order not found
            </p>
            <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
              {error ?? "This record may have been removed."}
            </p>
            <FrappeButtonLink href="/production-orders" className="mt-4">
              Back to production
            </FrappeButtonLink>
          </div>
        ) : (
          <ProductionOrderDetail order={order} onUpdated={reload} />
        )}
      </PermissionGate>
    </AppShell>
  );
}
