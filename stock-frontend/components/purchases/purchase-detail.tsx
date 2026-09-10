"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  FrappeDocument,
  FrappeFormGrid,
  FrappeSection,
  FrappeButtonLink,
} from "@/components/frappe";
import { PurchaseDocumentActions } from "@/components/transactions/document-actions";
import { formatMoney, formatDate, formatQty } from "@/lib/format";
import { documentTotal } from "@/lib/document-utils";
import type { Purchase, PurchaseLine } from "@/lib/types";

function DetailField({
  label,
  value,
  href,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
        {label}
      </p>
      {href ? (
        <Link
          href={href}
          className="text-sm font-medium text-[var(--frappe-primary)] hover:underline"
        >
          {value}
        </Link>
      ) : (
        <p className="text-sm text-[var(--frappe-text)]">{value}</p>
      )}
    </div>
  );
}

function lineAmount(line: PurchaseLine) {
  const qty = parseFloat(line.quantity);
  const price = parseFloat(line.unitPrice);
  if (line.lineTotal) return line.lineTotal;
  if (line.amount) return line.amount;
  if (!Number.isNaN(qty) && !Number.isNaN(price)) {
    return String(qty * price);
  }
  return "0";
}

export function PurchaseDetail({ purchase }: { purchase: Purchase }) {
  const lines = purchase.lines ?? [];
  const paymentLabel = purchase.paymentMethod.replace("_", " ");
  const isVoided = purchase.status === "VOIDED";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FrappeButtonLink href="/purchases">← Back to list</FrappeButtonLink>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isVoided ? (
            <Badge variant="secondary">Voided</Badge>
          ) : (
            <Badge variant="outline">{paymentLabel}</Badge>
          )}
          <PurchaseDocumentActions
            purchaseId={purchase.id}
            status={purchase.status}
          />
        </div>
      </div>

      <FrappeDocument>
        <FrappeSection
          title="Purchase details"
          description={
            purchase.createdAt
              ? `Created ${formatDate(purchase.createdAt)}`
              : undefined
          }
        >
          <FrappeFormGrid columns={2}>
            <DetailField
              label="Supplier"
              value={purchase.supplier?.name ?? "—"}
              href={purchase.supplierId ? `/suppliers` : undefined}
            />
            <DetailField
              label="Location"
              value={purchase.location?.name ?? "—"}
            />
            <DetailField label="Payment method" value={paymentLabel} />
            {purchase.paymentMethod !== "CREDIT" ? (
              <DetailField
                label="Bank account"
                value={purchase.bankAccount?.name ?? "—"}
              />
            ) : (
              <DetailField
                label="Credit due date"
                value={
                  purchase.creditDueDate
                    ? formatDate(purchase.creditDueDate)
                    : "—"
                }
              />
            )}
            <DetailField
              label="Total amount"
              value={formatMoney(documentTotal(purchase))}
            />
            <DetailField
              label="Document ID"
              value={
                <span className="font-mono text-xs">{purchase.id}</span>
              }
            />
            {purchase.notes ? (
              <div className="sm:col-span-2">
                <DetailField label="Notes" value={purchase.notes} />
              </div>
            ) : null}
          </FrappeFormGrid>
        </FrappeSection>

        <FrappeSection
          title="Items"
          description={`${lines.length} line${lines.length === 1 ? "" : "s"}`}
        >
          {lines.length === 0 ? (
            <p className="text-sm text-[var(--frappe-text-muted)]">
              No line items on this purchase.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="frappe-list-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU</th>
                    <th className="text-right tabular-nums">Qty</th>
                    <th className="text-right tabular-nums">Rate</th>
                    <th className="text-right tabular-nums">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={line.id ?? `${line.itemId}-${i}`}>
                      <td>{line.item?.description ?? line.itemId}</td>
                      <td className="text-[var(--frappe-text-muted)]">
                        {line.item?.sku ?? "—"}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatQty(line.quantity)}
                        {line.item?.unit ? ` ${line.item.unit}` : ""}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatMoney(line.unitPrice)}
                      </td>
                      <td className="text-right tabular-nums font-medium">
                        {formatMoney(lineAmount(line))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--frappe-section-head)]">
                    <td
                      colSpan={4}
                      className="px-3 py-2 text-right text-xs font-semibold uppercase text-[var(--frappe-text-muted)]"
                    >
                      Total
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums">
                      {formatMoney(documentTotal(purchase))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </FrappeSection>
      </FrappeDocument>
    </div>
  );
}
