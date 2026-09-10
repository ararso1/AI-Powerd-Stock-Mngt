"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FrappeButtonLink,
  FrappeDocument,
  FrappeFormGrid,
  FrappeSection,
} from "@/components/frappe";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@/lib/api";
import { errorMessage, formatDate, formatQty } from "@/lib/format";
import { requestNotificationsRefresh } from "@/lib/notification-events";
import { productionStatusLabel } from "@/lib/production";
import type { ProductionOrder } from "@/lib/types";
import { toast } from "sonner";

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
        {label}
      </p>
      <p className="text-sm text-[var(--frappe-text)]">{value}</p>
    </div>
  );
}

export function ProductionOrderDetail({
  order,
  onUpdated,
}: {
  order: ProductionOrder;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeQty, setCompleteQty] = useState(
    order.quantityPlanned ?? "1"
  );
  const [autoIssue, setAutoIssue] = useState(true);

  const lines = order.lines ?? [];
  const status = order.status;

  async function runAction(
    path: string,
    body?: Record<string, unknown>,
    successMessage?: string
  ) {
    setBusy(true);
    try {
      await api(path, {
        method: "POST",
        body: body ?? {},
      });
      toast.success(successMessage ?? "Updated");
      requestNotificationsRefresh();
      onUpdated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    const quantity = parseFloat(completeQty);
    if (Number.isNaN(quantity) || quantity <= 0) {
      toast.error("Enter a positive quantity");
      return;
    }
    setBusy(true);
    try {
      await api(`/production-orders/${order.id}/complete`, {
        method: "POST",
        body: { quantity, autoIssue },
      });
      toast.success("Production completed");
      requestNotificationsRefresh();
      setCompleteOpen(false);
      onUpdated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FrappeButtonLink href="/production-orders">
          ← Back to list
        </FrappeButtonLink>
        <Badge variant="outline" className="ml-auto">
          {productionStatusLabel(status)}
        </Badge>
        <PermissionGate permission="production.write">
          {status === "DRAFT" ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                runAction(
                  `/production-orders/${order.id}/release`,
                  undefined,
                  "Order released"
                )
              }
            >
              Release
            </Button>
          ) : null}
          {status === "RELEASED" || status === "IN_PROGRESS" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  runAction(
                    `/production-orders/${order.id}/issue`,
                    {},
                    "Materials issued"
                  )
                }
              >
                Issue materials
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  setCompleteQty(order.quantityPlanned ?? "1");
                  setCompleteOpen(true);
                }}
              >
                Complete
              </Button>
            </>
          ) : null}
          {status !== "COMPLETED" && status !== "CANCELLED" ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                runAction(
                  `/production-orders/${order.id}/cancel`,
                  undefined,
                  "Order cancelled"
                )
              }
            >
              Cancel
            </Button>
          ) : null}
        </PermissionGate>
      </div>

      <FrappeDocument>
        <FrappeSection
          title="Order"
          description={
            order.createdAt
              ? `Created ${formatDate(order.createdAt)}`
              : undefined
          }
        >
          <FrappeFormGrid columns={2}>
            <DetailField
              label="BOM"
              value={
                order.bom ? (
                  <Link
                    href={`/boms/${order.bomId}`}
                    className="text-[var(--frappe-primary)] hover:underline"
                  >
                    {order.bom.name}
                  </Link>
                ) : (
                  order.bomId
                )
              }
            />
            <DetailField
              label="Finished item"
              value={
                order.finishedItem?.description ??
                order.bom?.finishedItem?.description ??
                "—"
              }
            />
            <DetailField
              label="Location"
              value={order.location?.name ?? "—"}
            />
            <DetailField
              label="Planned qty"
              value={formatQty(order.quantityPlanned)}
            />
            <DetailField
              label="Completed qty"
              value={formatQty(order.quantityCompleted ?? "0")}
            />
            <DetailField
              label="Document ID"
              value={
                <span className="font-mono text-xs">{order.id}</span>
              }
            />
            {order.notes ? (
              <div className="sm:col-span-2">
                <DetailField label="Notes" value={order.notes} />
              </div>
            ) : null}
          </FrappeFormGrid>
        </FrappeSection>

        <FrappeSection
          title="Materials"
          description={`${lines.length} component line${lines.length === 1 ? "" : "s"}`}
        >
          {lines.length === 0 ? (
            <p className="text-sm text-[var(--frappe-text-muted)]">
              No material lines on this order.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="frappe-list-table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>SKU</th>
                    <th className="text-right tabular-nums">Required</th>
                    <th className="text-right tabular-nums">Issued</th>
                    <th className="text-right tabular-nums">Scrap %</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={line.id ?? `${line.componentItemId}-${i}`}>
                      <td>
                        {line.componentItem?.description ??
                          line.componentItemId}
                      </td>
                      <td className="text-[var(--frappe-text-muted)]">
                        {line.componentItem?.sku ?? "—"}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatQty(line.quantityRequired ?? "0")}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatQty(line.quantityIssued ?? "0")}
                      </td>
                      <td className="text-right tabular-nums">
                        {line.scrapPercent != null && line.scrapPercent !== ""
                          ? `${line.scrapPercent}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FrappeSection>
      </FrappeDocument>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <form onSubmit={handleComplete}>
            <DialogHeader>
              <DialogTitle>Complete production</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Finished quantity</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={completeQty}
                  onChange={(e) => setCompleteQty(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={autoIssue}
                  onCheckedChange={setAutoIssue}
                  id="auto-issue"
                />
                <Label htmlFor="auto-issue" className="font-normal">
                  Auto-issue remaining materials
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                Complete
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
