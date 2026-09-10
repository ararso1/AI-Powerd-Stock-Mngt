"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TransferDetail } from "@/components/stock-transfers/transfer-detail";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@/lib/api";
import type { StockTransfer } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { FrappeButtonLink } from "@/components/frappe";

export default function StockTransferDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: transfer, loading, error } = useFetch(
    () =>
      id
        ? api<StockTransfer>(`/stock-transfers/${id}`)
        : Promise.reject(new Error("Invalid transfer id")),
    [id]
  );

  const title =
    transfer?.fromLocation?.name && transfer?.toLocation?.name
      ? `${transfer.fromLocation.name} → ${transfer.toLocation.name}`
      : "Stock Transfer";

  return (
    <AppShell
      title={loading ? "Stock Transfer" : title}
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Stock Transfers", href: "/stock-transfers" },
        { label: id ? id.slice(0, 8) : "…" },
      ]}
    >
      <PermissionGate permission="stock_transfer.read">
        {loading ? (
          <PageLoading />
        ) : error || !transfer ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Transfer not found
            </p>
            <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
              {error ?? "This record may have been removed."}
            </p>
            <FrappeButtonLink href="/stock-transfers" className="mt-4">
              Back to transfers
            </FrappeButtonLink>
          </div>
        ) : (
          <TransferDetail transfer={transfer} />
        )}
      </PermissionGate>
    </AppShell>
  );
}
