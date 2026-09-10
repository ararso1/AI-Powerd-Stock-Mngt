"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeButtonLink,
  FrappeDocument,
  FrappeFormGrid,
  FrappeSection,
} from "@/components/frappe";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import type { CollectionTicket } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
        {label}
      </p>
      <div className="text-sm text-[var(--frappe-text)]">{value}</div>
    </div>
  );
}

export default function CollectionDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: ticket, loading, error } = useFetch(
    () =>
      id
        ? api<CollectionTicket>(`/collections/${id}`)
        : Promise.reject(new Error("Invalid collection id")),
    [id]
  );

  return (
    <AppShell
      title={loading ? "Collection" : ticket?.ticketNumber ?? "Collection"}
      variant="form"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Collection", href: "/collections" },
        { label: ticket?.ticketNumber ?? (id ? id.slice(0, 8) : "…") },
      ]}
    >
      <PermissionGate permission="collection.read">
        {loading ? (
          <PageLoading />
        ) : error || !ticket ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Ticket not found
            </p>
            <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
              {error ?? "This record may have been removed."}
            </p>
            <FrappeButtonLink href="/collections" className="mt-4">
              Back to collections
            </FrappeButtonLink>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <FrappeButtonLink href="/collections">
                ← Back to list
              </FrappeButtonLink>
              <Badge variant="outline" className="ml-auto">
                {ticket.status}
              </Badge>
            </div>

            <FrappeDocument>
              <FrappeSection
                title="Receipt"
                description={`${formatQty(ticket.weightKg)} kg · ${formatMoney(ticket.totalAmount)}`}
              >
                <FrappeFormGrid columns={3}>
                  <DetailField label="Ticket" value={ticket.ticketNumber} />
                  <DetailField
                    label="Farmer"
                    value={ticket.supplier?.name ?? "—"}
                  />
                  <DetailField
                    label="Location"
                    value={ticket.location?.name ?? "—"}
                  />
                  <DetailField
                    label="Weight"
                    value={`${formatQty(ticket.weightKg)} kg`}
                  />
                  <DetailField label="Grade" value={ticket.grade ?? "—"} />
                  <DetailField
                    label="Price / kg"
                    value={formatMoney(ticket.pricePerKg)}
                  />
                  <DetailField
                    label="Total"
                    value={formatMoney(ticket.totalAmount)}
                  />
                  <DetailField
                    label="Payment"
                    value={ticket.paymentMethod}
                  />
                  <DetailField
                    label="Account"
                    value={ticket.bankAccount?.name ?? "—"}
                  />
                  <DetailField
                    label="Lot"
                    value={
                      ticket.lot ? (
                        <Link
                          href={`/lots/${ticket.lotId}`}
                          className="font-medium text-[var(--frappe-primary)] hover:underline"
                        >
                          {ticket.lot.code}
                        </Link>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <DetailField
                    label="Purchase"
                    value={
                      ticket.purchaseId ? (
                        <Link
                          href={`/purchases/${ticket.purchaseId}`}
                          className="text-[var(--frappe-primary)] hover:underline"
                        >
                          {ticket.purchaseId.slice(0, 8)}…
                        </Link>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <DetailField
                    label="Crop year"
                    value={ticket.cropYear ?? "—"}
                  />
                  <DetailField label="Region" value={ticket.region ?? "—"} />
                  <DetailField label="Woreda" value={ticket.woreda ?? "—"} />
                  <DetailField label="Kebele" value={ticket.kebele ?? "—"} />
                  <DetailField
                    label="Moisture %"
                    value={ticket.moisturePercent ?? "—"}
                  />
                  <DetailField
                    label="Date"
                    value={formatDate(ticket.createdAt)}
                  />
                  <DetailField label="Notes" value={ticket.notes ?? "—"} />
                </FrappeFormGrid>
              </FrappeSection>
            </FrappeDocument>
          </div>
        )}
      </PermissionGate>
    </AppShell>
  );
}
