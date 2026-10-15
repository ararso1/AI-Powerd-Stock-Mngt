"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2Icon,
  CircleIcon,
  FileTextIcon,
  PackageIcon,
  TruckIcon,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { errorMessage, formatDate, formatMoney, formatQty } from "@/lib/format";
import type {
  ExportContract,
  ExportContractStatus,
  ExportStoreLot,
} from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CONTRACT_STEPS: Array<{
  key: ExportContractStatus;
  label: string;
}> = [
  { key: "DRAFT", label: "Draft" },
  { key: "ALLOCATED", label: "Allocated" },
  { key: "STAGED", label: "Staged" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CLOSED", label: "Closed" },
];

function contractStepIndex(status: ExportContractStatus): number {
  if (status === "CANCELLED") return -1;
  return Math.max(
    0,
    CONTRACT_STEPS.findIndex((step) => step.key === status)
  );
}

function ContractLifecycle({ status }: { status: ExportContractStatus }) {
  if (status === "CANCELLED") {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-900">
        This contract was cancelled and reserved stock was released.
      </div>
    );
  }
  const current = contractStepIndex(status);
  return (
    <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {CONTRACT_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step.key}
            className={cn(
              "rounded-xl border px-3 py-3",
              done && "border-emerald-500/35 bg-emerald-500/[0.08]",
              active &&
                "border-[var(--csolve-moss)] bg-[var(--csolve-moss)]/[0.08] ring-1 ring-[var(--csolve-moss)]/20",
              !done &&
                !active &&
                "border-[var(--frappe-border)] bg-[var(--frappe-surface)] opacity-75"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full",
                  done && "bg-emerald-600 text-white",
                  active &&
                    "bg-[var(--csolve-moss)] text-[var(--csolve-parchment)]",
                  !done &&
                    !active &&
                    "bg-[var(--frappe-border)] text-[var(--frappe-text-muted)]"
                )}
              >
                {done ? (
                  <CheckCircle2Icon className="size-3.5" />
                ) : (
                  <CircleIcon className="size-3" />
                )}
              </span>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--frappe-text-muted)]">
                  Step {index + 1}
                </p>
                <p className="text-sm font-semibold">{step.label}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

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
  const docsDone = checklist.filter((d) => d.done).length;
  const docsPct =
    checklist.length > 0
      ? Math.round((docsDone / checklist.length) * 100)
      : 0;

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
      d.key === key ? { ...d, reference: reference || null, done: Boolean(reference) || d.done } : d
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

  const locked =
    contract.status === "CLOSED" || contract.status === "CANCELLED";

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
      <PermissionGate
        permission="export.write"
        fallback={
          <p className="text-sm text-[var(--frappe-text-muted)]">
            Export contract detail is restricted. You can view contracts on the
            Exports list, but opening detail requires export write access.
          </p>
        }
      >
        <div className="mx-auto max-w-5xl space-y-4">
          <FrappeButtonLink href="/exports">← Back to list</FrappeButtonLink>

          <section className="overflow-hidden rounded-2xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
            <div className="border-b border-[var(--frappe-border)] bg-gradient-to-br from-[var(--csolve-moss)]/[0.08] to-transparent px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <TruckIcon className="size-4 text-[var(--csolve-moss)]" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
                  Contract lifecycle
                </h2>
              </div>
              <div className="mt-3">
                <ContractLifecycle status={contract.status} />
              </div>
            </div>
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-bg)]/40 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
                  Volume filled
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatQty(contract.allocatedKg)} /{" "}
                  {formatQty(contract.volumeKg)} kg
                </p>
                <p className="text-xs text-[var(--frappe-text-muted)]">
                  {fillPct}% allocated
                </p>
              </div>
              <div className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-bg)]/40 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
                  Documents
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {docsDone}/{checklist.length}
                </p>
                <p className="text-xs text-[var(--frappe-text-muted)]">
                  {docsPct}% complete
                </p>
              </div>
              <div className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-bg)]/40 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
                  Ship window
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatDate(contract.windowStart ?? undefined)} →{" "}
                  {formatDate(contract.windowEnd ?? undefined)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-bg)]/40 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
                  Destination
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {contract.destination ?? "—"}
                </p>
              </div>
            </div>
          </section>

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
                          <div className="flex flex-col gap-0.5">
                            <Link
                              href={`/lots/${a.lotId}`}
                              className="text-[var(--frappe-primary)] hover:underline"
                            >
                              {a.lot?.code ?? a.lotId.slice(0, 8)}
                            </Link>
                            <Link
                              href={`/exports/lots/${a.lotId}`}
                              className="text-xs text-[var(--frappe-text-muted)] hover:text-[var(--frappe-primary)] hover:underline"
                            >
                              Export lot detail
                            </Link>
                          </div>
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
                            {l.lotCode} · {l.grade ?? "—"} ·{" "}
                            {formatQty(l.quantityKg)} kg
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

            <FrappeSection
              title="Export documents"
              description={`${docsDone} of ${checklist.length} documents marked complete`}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--frappe-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--csolve-moss)] transition-all"
                    style={{ width: `${docsPct}%` }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums text-[var(--csolve-moss)]">
                  {docsPct}%
                </span>
              </div>
              <ul className="space-y-2">
                {checklist.map((d) => (
                  <li
                    key={d.key}
                    className={cn(
                      "rounded-xl border px-4 py-3 transition-colors",
                      d.done
                        ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                        : "border-[var(--frappe-border)] bg-[var(--frappe-surface)]"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={busy || locked}
                        onClick={() => void toggleDoc(d.key, !d.done)}
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          d.done
                            ? "bg-emerald-600 text-white"
                            : "bg-[var(--frappe-border)] text-[var(--frappe-text-muted)]",
                          !locked && "hover:opacity-90"
                        )}
                        aria-label={
                          d.done ? `Unmark ${d.label}` : `Mark ${d.label}`
                        }
                      >
                        {d.done ? (
                          <CheckCircle2Icon className="size-4" />
                        ) : (
                          <FileTextIcon className="size-3.5" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{d.label}</p>
                        <p className="text-xs text-[var(--frappe-text-muted)]">
                          {d.done
                            ? d.reference
                              ? `Ref · ${d.reference}`
                              : "Marked complete"
                            : "Pending"}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {d.done ? "Attached" : "Pending"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                      <Input
                        className="h-8 text-xs"
                        placeholder="Document / certificate reference"
                        defaultValue={d.reference ?? ""}
                        disabled={busy || locked}
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
                    </div>
                  </li>
                ))}
                {checklist.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-[var(--frappe-border)] px-4 py-6 text-center text-sm text-[var(--frappe-text-muted)]">
                    No document checklist on this contract yet.
                  </li>
                ) : null}
              </ul>
            </FrappeSection>

            {(contract.packingList ?? []).length > 0 ? (
              <FrappeSection title="Packing list">
                <ul className="space-y-2">
                  {contract.packingList!.map((p) => (
                    <li
                      key={p.lotId}
                      className="flex items-center gap-2 rounded-lg border border-[var(--frappe-border)] px-3 py-2 text-sm"
                    >
                      <PackageIcon className="size-3.5 text-[var(--frappe-text-muted)]" />
                      <Link
                        href={`/exports/lots/${p.lotId}`}
                        className="font-medium text-[var(--frappe-primary)] hover:underline"
                      >
                        {p.lotCode}
                      </Link>
                      <span className="text-[var(--frappe-text-muted)]">
                        {formatQty(String(p.quantityKg))} kg
                        {p.grade ? ` · ${p.grade}` : ""}
                      </span>
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
