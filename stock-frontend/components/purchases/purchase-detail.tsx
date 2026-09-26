"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  FrappeDocument,
  FrappeFormGrid,
  FrappeSection,
  FrappeButtonLink,
  FrappeButtonPrimary,
} from "@/components/frappe";
import { PurchaseDocumentActions } from "@/components/transactions/document-actions";
import { apiBlob } from "@/lib/api";
import { formatMoney, formatDate, formatQty, errorMessage } from "@/lib/format";
import {
  documentTotal,
  paymentMethodLabel,
} from "@/lib/document-utils";
import { purchaseTypeLabel } from "@/lib/purchases";
import type {
  Purchase,
  PurchaseLine,
  PurchaseQualityResult,
} from "@/lib/types";
import { toast } from "sonner";

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

function passedLabel(passed?: boolean | null) {
  if (passed === true) return "Yes";
  if (passed === false) return "No";
  return "—";
}

function ViewQualityDocument({
  quality,
}: {
  quality: PurchaseQualityResult;
}) {
  const [busy, setBusy] = useState(false);
  if (!quality.hasDocument || !quality.downloadPath) return null;

  return (
    <button
      type="button"
      disabled={busy}
      className="text-xs font-medium text-[var(--frappe-primary)] hover:underline disabled:opacity-50"
      onClick={() => {
        setBusy(true);
        void apiBlob(quality.downloadPath!)
          .then(({ blob }) => {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
          })
          .catch((err) => toast.error(errorMessage(err)))
          .finally(() => setBusy(false));
      }}
    >
      {busy ? "Opening…" : "View document"}
    </button>
  );
}

function QualitySummary({
  quality,
}: {
  quality?: PurchaseQualityResult | null;
}) {
  if (!quality) {
    return (
      <span className="text-[var(--frappe-text-muted)]">No ECTA result</span>
    );
  }

  const bits = [
    quality.labName,
    quality.grade ? `Grade ${quality.grade}` : null,
    quality.moisturePercent != null && quality.moisturePercent !== ""
      ? `Moisture ${quality.moisturePercent}%`
      : null,
    quality.cuppingScore != null && quality.cuppingScore !== ""
      ? `Cup ${quality.cuppingScore}`
      : null,
    quality.passed != null ? `Passed ${passedLabel(quality.passed)}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-1">
      <p className="text-sm text-[var(--frappe-text)]">
        {bits.length > 0 ? bits.join(" · ") : "Recorded"}
      </p>
      {quality.certificateNumber ? (
        <p className="text-xs text-[var(--frappe-text-muted)]">
          Cert #{quality.certificateNumber}
          {quality.testedAt
            ? ` · ${formatDate(quality.testedAt)}`
            : ""}
        </p>
      ) : quality.testedAt ? (
        <p className="text-xs text-[var(--frappe-text-muted)]">
          Tested {formatDate(quality.testedAt)}
        </p>
      ) : null}
      <ViewQualityDocument quality={quality} />
    </div>
  );
}

export function PurchaseDetail({ purchase }: { purchase: Purchase }) {
  const lines = purchase.lines ?? [];
  const paymentLabel = paymentMethodLabel(purchase.paymentMethod);
  const isVoided = purchase.status === "VOIDED";
  const credit = purchase.credit ?? purchase.supplierCredit;
  const dueDate =
    purchase.creditDueDate ?? credit?.dueDate ?? null;
  const hasCredit =
    purchase.paymentMethod === "CREDIT" ||
    purchase.paymentMethod === "PARTIAL";
  const showsBank =
    purchase.paymentMethod === "CASH" ||
    purchase.paymentMethod === "BANK" ||
    purchase.paymentMethod === "PARTIAL";
  const hasLotOrQuality = lines.some((l) => l.lotId || l.quality);

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
          {credit && credit.status !== "PAID" && !isVoided ? (
            <FrappeButtonPrimary asChild>
              <Link href="/credits">Pay outstanding</Link>
            </FrappeButtonPrimary>
          ) : null}
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
              href={
                purchase.supplierId
                  ? `/suppliers/${purchase.supplierId}`
                  : undefined
              }
            />
            <DetailField
              label="Warehouse / business location"
              value={purchase.location?.name ?? "—"}
              href={
                purchase.locationId
                  ? `/locations`
                  : undefined
              }
            />
            <DetailField
              label="Purchase type"
              value={purchaseTypeLabel(purchase.purchaseType)}
            />
            <DetailField label="Payment method" value={paymentLabel} />
            {showsBank ? (
              <DetailField
                label={
                  purchase.paymentMethod === "CASH"
                    ? "Cash till"
                    : "Payment bank"
                }
                value={purchase.bankAccount?.name ?? "—"}
              />
            ) : null}
            {hasCredit ? (
              <DetailField
                label="Credit due date"
                value={dueDate ? formatDate(dueDate) : "—"}
              />
            ) : null}
            <DetailField
              label="Total amount"
              value={formatMoney(documentTotal(purchase))}
            />
            <DetailField
              label="Paid"
              value={formatMoney(
                purchase.paidAmount ??
                  (purchase.paymentMethod === "CREDIT"
                    ? "0"
                    : documentTotal(purchase))
              )}
            />
            <DetailField
              label="Outstanding"
              value={formatMoney(
                purchase.outstandingAmount ?? credit?.balance ?? "0"
              )}
            />
            {credit ? (
              <DetailField
                label="Credit status"
                value={credit.status ?? "—"}
              />
            ) : null}
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
                    {hasLotOrQuality ? <th>Lot</th> : null}
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
                      {hasLotOrQuality ? (
                        <td>
                          {line.lotId ? (
                            <Link
                              href={`/lots/${line.lotId}`}
                              className="font-medium text-[var(--frappe-primary)] hover:underline"
                            >
                              {line.lot?.code ?? line.lotId.slice(0, 8)}
                            </Link>
                          ) : (
                            <span className="text-[var(--frappe-text-muted)]">
                              —
                            </span>
                          )}
                        </td>
                      ) : null}
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
                      colSpan={hasLotOrQuality ? 5 : 4}
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

        {lines.some((l) => l.quality || l.lotId) ? (
          <FrappeSection
            title="ECTA quality"
            description="Lab results per coffee line"
          >
            <div className="overflow-x-auto">
              <table className="frappe-list-table">
                <thead>
                  <tr>
                    <th>Item / lot</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {lines
                    .filter((l) => l.lotId || l.quality)
                    .map((line, i) => (
                      <tr key={line.id ?? `q-${line.itemId}-${i}`}>
                        <td>
                          <p className="text-sm font-medium">
                            {line.item?.description ?? line.itemId}
                          </p>
                          {line.lotId ? (
                            <Link
                              href={`/lots/${line.lotId}`}
                              className="text-xs text-[var(--frappe-primary)] hover:underline"
                            >
                              {line.lot?.code ?? "Lot"}
                            </Link>
                          ) : null}
                        </td>
                        <td>
                          <QualitySummary quality={line.quality} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </FrappeSection>
        ) : null}
      </FrappeDocument>
    </div>
  );
}
