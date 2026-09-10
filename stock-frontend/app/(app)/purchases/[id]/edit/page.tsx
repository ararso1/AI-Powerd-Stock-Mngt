"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PurchaseForm } from "@/components/purchases/purchase-form";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { FrappeButtonLink } from "@/components/frappe";
import { api } from "@/lib/api";
import type { Purchase } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";

export default function EditPurchasePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: purchase, loading, error } = useFetch(
    () =>
      id
        ? api<Purchase>(`/purchases/${id}`)
        : Promise.reject(new Error("Invalid purchase id")),
    [id]
  );

  const isVoided = purchase?.status === "VOIDED";

  return (
    <AppShell
      title={loading ? "Edit Purchase" : `Edit — ${purchase?.supplier?.name ?? "Purchase"}`}
      subtitle={isVoided ? "Voided" : "Amend document"}
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Purchase", href: "/purchases" },
        { label: id ? id.slice(0, 8) : "…", href: `/purchases/${id}` },
        { label: "Edit" },
      ]}
    >
      <PermissionGate
        permission="purchase.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            You do not have permission to edit purchases.
          </p>
        }
      >
        {loading ? (
          <PageLoading />
        ) : error || !purchase ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Purchase not found
            </p>
            <FrappeButtonLink href="/purchases" className="mt-4">
              Back to purchases
            </FrappeButtonLink>
          </div>
        ) : isVoided ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              This purchase is voided and cannot be edited.
            </p>
            <FrappeButtonLink href={`/purchases/${id}`} className="mt-4">
              View purchase
            </FrappeButtonLink>
          </div>
        ) : (
          <PurchaseForm purchase={purchase} />
        )}
      </PermissionGate>
    </AppShell>
  );
}
