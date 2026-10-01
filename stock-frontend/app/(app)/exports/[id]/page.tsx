"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeButtonLink,
  FrappeButtonPrimary,
  FrappeDocument,
  FrappeField,
  FrappeFormGrid,
  FrappeSection,
} from "@/components/frappe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { errorMessage, formatDate, formatMoney, formatQty } from "@/lib/format";
import type { ExportContract, ExportStoreLot } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { toast } from "sonner";

export default function ExportDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { data: contract, loading, reload } = useFetch(
    () => api<ExportContract>(`/exports/${id}`),
    [id]
  );
  const [lotId, setLotId] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: storeLots } = useFetch(
    () => api<ExportStoreLot[]>("/exports/store"),
    []
  );
  const lots = (storeLots ?? []).filter(
    (lot) => lot.status !== "SHIPPED" && parseFloat(lot.quantityKg) > 0
  );

  const checklist = useMemo(
    () => contract?.docChecklist ?? [],
    [contract?.docChecklist]
  );

  async function runAction(
    path: string,
    body?: Record<string, unknown>,
    ok = "Updated",
    method: "POST" | "PATCH" = "POST"
  ) {
    setBusy(true);
    try {
      await api(path, { method, body: body ?? {} });
      toast.success(ok);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function allocate() {
    if (!lotId || !qty) {
      toast.error("Pick a lot and quantity");
      return;
    }
    await runAction(
      `/exports/${id}/allocate`,
      { lotId, quantityKg: parseFloat(qty) },
      "Lot reserved for export"
    );
    setLotId("");
    setQty("");
  }

  async function deallocate(allocationId: string) {
    await runAction(
      `/exports/${id}/allocations/${allocationId}/deallocate`,
      {},
      "Reservation released"
    );
  }

  async function saveDocs(
    next: ExportContract["docChecklist"],
    ok = "Documents updated"
  ) {
    setBusy(true);
    try {
      await api(`/exports/${id}/checklist`, {
        method: "PATCH",
        body: { docChecklist: next },
      });
      toast.success(ok);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleDoc(key: string, done: boolean) {
    if (!contract) return;
    const next = checklist.map((d) =>
      d.key === key ? { ...d, done } : d
    );
    await saveDocs(next, done ? "Marked complete" : "Marked incomplete");
  }

  async function setDocReference(key: string, reference: string) {
    if (!contract) return;
    const next = checklist.map((d) =>
      d.key === key ? { ...d, reference: reference || null } : d
    );
    await saveDocs(next, "Reference saved");
  }

  if (loading || !contract) {
    return (
      <AppShell title="Export contract">
        <PageLoading />
      </AppShell>
    );
  }

  const fillPct =
    parseFloat(contract.volumeKg) > 0
      ? (
          (parseFloat(contract.allocatedKg) / parseFloat(contract.volumeKg)) *
          100
        ).toFixed(0)
      : "0";

  const stockBadge =
    contract.stockState === "RESERVED"
      ? "Reserved for export"
      : contract.stockState === "SHIPPED"
        ? "Shipped stock"
        : contract.stockState === "DELIVERED"
          ? "Delivered stock"
          : null;

  return (
    <AppShell
      title={contract.contractNumber}
      subtitle={`${contract.buyerName}${
        contract.buyerCountry ? ` · ${contract.buyerCountry}` : ""
      } · ${contract.incoterm} ${contract.currencyCode}`}
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Exports", href: "/exports" },
        { label: contract.contractNumber },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {stockBadge ? <Badge variant="secondary">{stockBadge}</Badge> : null}
          <Badge variant="outline">{contract.status}</Badge>
        </div>
      }
    >
      <PermissionGate permission="export.read">
        <div className="mx-auto max-w-5xl space-y-4">
          <FrappeButtonLink href="/exports">← Back to list</FrappeButtonLink>

          <FrappeDocument>
            <FrappeSection title="Commercial">
              <FrappeFormGrid columns={2}>
                <div>
                  <p className="text-xs text-muted-foreground">Export order</p>
                  <p className="text-sm">{contract.orderNumber ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Buyer / country</p>
                  <p className="text-sm">
                    {contract.buyerName}
                    {contract.buyerCountry ? ` · ${contract.buyerCountry}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Coffee</p>
                  <p className="text-sm">
                    {[contract.coffeeType, contract.grade, contract.origin]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Volume</p>
                  <p className="text-sm">
                    {formatQty(contract.allocatedKg)} /{" "}
                    {formatQty(contract.volumeKg)} kg ({fillPct}% filled)
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="text-sm">
                    {contract.currencyCode} {formatMoney(contract.pricePerKg)}
                    /kg
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Incoterm</p>
                  <p className="text-sm">{contract.incoterm}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="text-sm">{contract.destination ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Container</p>
                  <p className="text-sm">{contract.containerNumber ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Shipping date</p>
                  <p className="text-sm">
                    {formatDate(
                      contract.shippingDate ??
                        contract.shippedAt ??
                        undefined
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Expected arrival
                  </p>
                  <p className="text-sm">
                    {formatDate(contract.expectedArrival ?? undefined)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ship window</p>
                  <p className="text-sm">
                    {formatDate(contract.windowStart ?? undefined)} →{" "}
                    {formatDate(contract.windowEnd ?? undefined)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Staging</p>
                  <p className="text-sm">
                    {contract.stagingLocation?.name ?? "—"}
                  </p>
                </div>
              </FrappeFormGrid>
            </FrappeSection>

            <FrappeSection title="Payment">
              <FrappeFormGrid columns={2}>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm">
                    {contract.paymentStatus && contract.paymentStatus !== "NONE"
                      ? contract.paymentStatus
                      : "No sale yet"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Invoice</p>
                  <p className="text-sm">
                    {contract.invoiceTotal != null
                      ? `${contract.currencyCode} ${formatMoney(contract.invoiceTotal)}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-sm">
                    {contract.paidAmount != null
                      ? formatMoney(contract.paidAmount)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="text-sm font-medium">
                    {contract.outstandingAmount != null
                      ? formatMoney(contract.outstandingAmount)
                      : "—"}
                  </p>
                </div>
              </FrappeFormGrid>
              {contract.saleId ? (
                <p className="mt-2 text-sm">
                  <Link
                    href={`/sales/${contract.saleId}`}
                    className="text-[var(--frappe-primary)] hover:underline"
                  >
                    View linked sale
                  </Link>
                  {" · "}
                  <Link
                    href="/credits"
                    className="text-[var(--frappe-primary)] hover:underline"
                  >
                    Credits desk
                  </Link>
                </p>
              ) : null}
            </FrappeSection>

            <FrappeSection
              title="Lot allocation (reserved stock)"
              description="Allocated kg is locked and cannot be sold locally until released or shipped."
            >
              <div className="mb-4 overflow-x-auto">
                <table className="frappe-list-table">
                  <thead>
                    <tr>
                      <th>Lot / batch</th>
                      <th>Grade</th>
                      <th>Origin</th>
                      <th className="text-right">Qty kg</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(contract.allocations ?? []).map((a) => (
                      <tr key={a.id}>
                        <td>
                          <Link
                            href={`/lots/${a.lotId}`}
                            className="text-[var(--frappe-primary)] hover:underline"
                          >
                            {a.lot?.code ?? a.lotId.slice(0, 8)}
                          </Link>
                        </td>
                        <td>{a.lot?.grade ?? "—"}</td>
                        <td>
                          {[a.lot?.region, a.lot?.zone]
                            .filter(Boolean)
                            .join(" / ") || "—"}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatQty(a.quantityKg)}
                        </td>
                        <td className="text-right">
                          <PermissionGate permission="export.write">
                            {contract.status === "DRAFT" ||
                            contract.status === "ALLOCATED" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => void deallocate(a.id)}
                              >
                                Release
                              </Button>
                            ) : null}
                          </PermissionGate>
                        </td>
                      </tr>
                    ))}
                    {(contract.allocations ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-muted-foreground">
                          No lots reserved yet
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <PermissionGate permission="export.write">
                {contract.status === "DRAFT" ||
                contract.status === "ALLOCATED" ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <FrappeField label="Lot">
                      <select
                        className="flex h-9 w-56 rounded-md border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-2 text-sm"
                        value={lotId}
                        onChange={(e) => setLotId(e.target.value)}
                      >
                        <option value="">Select export store lot…</option>
                        {lots.map((l) => (
                          <option key={l.lotId} value={l.lotId}>
                            {l.lotCode} · {l.grade ?? "—"} · {formatQty(l.quantityKg)} kg
                          </option>
                        ))}
                      </select>
                    </FrappeField>
                    <FrappeField label="Qty kg">
                      <Input
                        className="w-28"
                        type="number"
                        min="0.001"
                        step="any"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                      />
                    </FrappeField>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void allocate()}
                    >
                      Reserve for export
                    </Button>
                  </div>
                ) : null}
              </PermissionGate>
            </FrappeSection>

            <FrappeSection title="Export documents">
              <ul className="space-y-3">
                {checklist.map((d) => (
                  <li
                    key={d.key}
                    className="grid gap-2 rounded border border-[var(--frappe-border)] p-3 sm:grid-cols-[auto_1fr_minmax(8rem,12rem)] sm:items-center"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={d.done}
                        disabled={
                          busy ||
                          contract.status === "CLOSED" ||
                          contract.status === "CANCELLED"
                        }
                        onCheckedChange={(v) =>
                          void toggleDoc(d.key, v === true)
                        }
                      />
                      <span className={d.done ? "line-through opacity-60" : ""}>
                        {d.label}
                      </span>
                    </div>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Document / certificate reference"
                      defaultValue={d.reference ?? ""}
                      disabled={
                        busy ||
                        contract.status === "CLOSED" ||
                        contract.status === "CANCELLED"
                      }
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next !== (d.reference ?? "")) {
                          void setDocReference(d.key, next);
                        }
                      }}
                    />
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--frappe-primary)] hover:underline"
                      >
                        Open link
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Ref only
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </FrappeSection>

            {(contract.packingList ?? []).length > 0 ? (
              <FrappeSection title="Packing list">
                <ul className="space-y-1 text-sm">
                  {contract.packingList!.map((p) => (
                    <li key={p.lotId}>
                      {p.lotCode}: {formatQty(p.quantityKg)} kg
                      {p.grade ? ` · ${p.grade}` : ""}
                    </li>
                  ))}
                </ul>
              </FrappeSection>
            ) : null}

            <PermissionGate permission="export.write">
              <div className="flex flex-wrap gap-2 border-t border-[var(--frappe-border)] px-5 py-4">
                {contract.status === "ALLOCATED" ? (
                  <FrappeButtonPrimary
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(`/exports/${id}/stage`, {}, "Staged")
                    }
                  >
                    Stage for export
                  </FrappeButtonPrimary>
                ) : null}
                {contract.status === "ALLOCATED" ||
                contract.status === "STAGED" ? (
                  <FrappeButtonPrimary
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        `/exports/${id}/ship`,
                        { createSale: true },
                        "Shipped"
                      )
                    }
                  >
                    Ship + sale
                  </FrappeButtonPrimary>
                ) : null}
                {contract.status === "SHIPPED" ? (
                  <FrappeButtonPrimary
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        `/exports/${id}/deliver`,
                        {},
                        "Marked delivered"
                      )
                    }
                  >
                    Mark delivered
                  </FrappeButtonPrimary>
                ) : null}
                {contract.status === "SHIPPED" ||
                contract.status === "DELIVERED" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void runAction(`/exports/${id}/close`, {}, "Closed")
                    }
                  >
                    Close
                  </Button>
                ) : null}
                {contract.status !== "SHIPPED" &&
                contract.status !== "DELIVERED" &&
                contract.status !== "CLOSED" &&
                contract.status !== "CANCELLED" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void runAction(`/exports/${id}/cancel`, {}, "Cancelled")
                    }
                  >
                    Cancel & release stock
                  </Button>
                ) : null}
              </div>
            </PermissionGate>
          </FrappeDocument>
        </div>
      </PermissionGate>
    </AppShell>
  );
}
