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
import { buildLotsListPath } from "@/lib/list-query";
import { errorMessage, formatDate, formatMoney, formatQty } from "@/lib/format";
import type { ExportContract, Lot } from "@/lib/types";
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

  const { data: lotsPage } = useFetch(
    () =>
      api<{ data: Lot[] }>(
        buildLotsListPath({ status: "ACTIVE", form: "GREEN" }, 1, 100)
      ),
    []
  );
  const lots = lotsPage?.data ?? [];

  const checklist = useMemo(
    () => contract?.docChecklist ?? [],
    [contract?.docChecklist]
  );

  async function runAction(
    path: string,
    body?: Record<string, unknown>,
    ok = "Updated"
  ) {
    setBusy(true);
    try {
      await api(path, { method: "POST", body: body ?? {} });
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
      "Lot allocated"
    );
    setLotId("");
    setQty("");
  }

  async function toggleDoc(key: string, done: boolean) {
    if (!contract) return;
    const next = checklist.map((d) =>
      d.key === key ? { ...d, done } : d
    );
    setBusy(true);
    try {
      await api(`/exports/${id}/checklist`, {
        method: "PATCH",
        body: { docChecklist: next },
      });
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
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

  return (
    <AppShell
      title={contract.contractNumber}
      subtitle={`${contract.buyerName} · ${contract.incoterm} ${contract.currencyCode}`}
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Exports", href: "/exports" },
        { label: contract.contractNumber },
      ]}
      actions={<Badge variant="outline">{contract.status}</Badge>}
    >
      <PermissionGate permission="export.read">
        <div className="mx-auto max-w-5xl space-y-4">
          <FrappeButtonLink href="/exports">← Back to list</FrappeButtonLink>

          <FrappeDocument>
            <FrappeSection title="Summary">
              <FrappeFormGrid columns={2}>
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

            <FrappeSection title="Allocations">
              <div className="mb-4 overflow-x-auto">
                <table className="frappe-list-table">
                  <thead>
                    <tr>
                      <th>Lot</th>
                      <th>Grade</th>
                      <th className="text-right">Qty kg</th>
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
                        <td className="text-right tabular-nums">
                          {formatQty(a.quantityKg)}
                        </td>
                      </tr>
                    ))}
                    {(contract.allocations ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-muted-foreground">
                          No lots allocated yet
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
                        <option value="">Select green lot…</option>
                        {lots.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.code} · {l.grade ?? "—"} · {l.quantity} kg
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
                      onClick={allocate}
                    >
                      Allocate
                    </Button>
                  </div>
                ) : null}
              </PermissionGate>
            </FrappeSection>

            <FrappeSection title="Dossier checklist">
              <ul className="space-y-2">
                {checklist.map((d) => (
                  <li key={d.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={d.done}
                      disabled={
                        busy ||
                        contract.status === "CLOSED" ||
                        contract.status === "CANCELLED"
                      }
                      onCheckedChange={(v) =>
                        toggleDoc(d.key, v === true)
                      }
                    />
                    <span className={d.done ? "line-through opacity-60" : ""}>
                      {d.label}
                    </span>
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
                      runAction(`/exports/${id}/stage`, {}, "Staged")
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
                      runAction(
                        `/exports/${id}/ship`,
                        { createSale: true },
                        "Shipped"
                      )
                    }
                  >
                    Ship + USD sale
                  </FrappeButtonPrimary>
                ) : null}
                {contract.status === "SHIPPED" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      runAction(`/exports/${id}/close`, {}, "Closed")
                    }
                  >
                    Close
                  </Button>
                ) : null}
                {contract.status !== "SHIPPED" &&
                contract.status !== "CLOSED" &&
                contract.status !== "CANCELLED" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      runAction(`/exports/${id}/cancel`, {}, "Cancelled")
                    }
                  >
                    Cancel
                  </Button>
                ) : null}
                {contract.saleId ? (
                  <Link
                    href={`/sales/${contract.saleId}`}
                    className="text-sm text-[var(--frappe-primary)] hover:underline"
                  >
                    View linked sale
                  </Link>
                ) : null}
              </div>
            </PermissionGate>
          </FrappeDocument>
        </div>
      </PermissionGate>
    </AppShell>
  );
}
