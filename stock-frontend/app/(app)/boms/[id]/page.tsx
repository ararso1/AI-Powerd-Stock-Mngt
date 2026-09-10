"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BomDetail } from "@/components/boms/bom-detail";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { FrappeButtonLink } from "@/components/frappe";
import { api } from "@/lib/api";
import type { Bom } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";

export default function BomDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: bom, loading, error } = useFetch(
    () =>
      id
        ? api<Bom>(`/boms/${id}`)
        : Promise.reject(new Error("Invalid BOM id")),
    [id]
  );

  return (
    <AppShell
      title={loading ? "BOM" : (bom?.name ?? "BOM")}
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "BOMs", href: "/boms" },
        { label: id ? id.slice(0, 8) : "…" },
      ]}
    >
      <PermissionGate permission="bom.read">
        {loading ? (
          <PageLoading />
        ) : error || !bom ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">BOM not found</p>
            <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
              {error ?? "This record may have been removed."}
            </p>
            <FrappeButtonLink href="/boms" className="mt-4">
              Back to BOMs
            </FrappeButtonLink>
          </div>
        ) : (
          <BomDetail bom={bom} />
        )}
      </PermissionGate>
    </AppShell>
  );
}
