"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PurchaseDetail } from "@/components/purchases/purchase-detail";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@/lib/api";
import type { Purchase } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { FrappeButtonLink } from "@/components/frappe";
export default function PurchaseDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: purchase, loading, error } = useFetch(
    () =>
      id
        ? api<Purchase>(`/purchases/${id}`)
        : Promise.reject(new Error("Invalid purchase id")),
    [id]
  );

  const title = purchase?.supplier?.name
    ? `Purchase — ${purchase.supplier.name}`
    : "Purchase";

  return (
    <AppShell
      title={loading ? "Purchase" : title}
      subtitle={purchase?.createdAt ? undefined : "Loading…"}
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Purchase", href: "/purchases" },
        { label: id ? id.slice(0, 8) : "…" },
      ]}
    >
      <PermissionGate permission="purchase.read">
        {loading ? (
          <PageLoading />
        ) : error || !purchase ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Purchase not found
            </p>
            <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
              {error ?? "This record may have been removed."}
            </p>
            <FrappeButtonLink href="/purchases" className="mt-4">
              Back to purchases
            </FrappeButtonLink>
          </div>
        ) : (
          <PurchaseDetail purchase={purchase} />
        )}
      </PermissionGate>
    </AppShell>
  );
}
