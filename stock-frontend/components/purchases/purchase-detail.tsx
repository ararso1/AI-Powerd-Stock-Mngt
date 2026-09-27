"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
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
import { coffeeFormLabel } from "@/lib/lots";
import {
  farasulaKgLabel,
  fromStoredPurchaseLine,
} from "@/lib/farasula";
import {
  documentTotal,
  paymentMethodLabel,
} from "@/lib/document-utils";
import { purchaseTypeLabel } from "@/lib/purchases";
import {
  processStatusLabel,
  processWorkflowLabel,
} from "@/lib/process-runs";
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
      onClick={(event) => {
        event.stopPropagation();
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
      {busy ? "Opening…" : "View result"}
    </button>
  );
}

function scoreValue(value: string | number | null | undefined, suffix = "") {
  if (value == null || value === "") return "—";
  return `${value}${suffix}`;
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

  return (
    <div className="space-y-1">
      <p className="text-sm text-[var(--frappe-text)]">
        {[
          quality.labName || "ECTA",
          quality.grade ? `Grade ${quality.grade}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {quality.testedAt ? (
        <p className="text-xs text-[var(--frappe-text-muted)]">
          Tested {formatDate(quality.testedAt)}
        </p>
      ) : null}
      <ViewQualityDocument quality={quality} />
    </div>
  );
}

function LotDetailsPanel({ line }: { line: PurchaseLine }) {
  const lot = line.lot;
  if (!lot) {
    return (
      <p className="text-sm text-[var(--frappe-text-muted)]">
        This line has no lot.
      </p>
    );
  }
  const origin = [lot.region, lot.zone, lot.woreda, lot.kebele]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Lot (SKU)" value={lot.code} href={`/lots/${lot.id}`} />
        <DetailField label="Form" value={coffeeFormLabel(lot.form)} />
        <DetailField label="Grade" value={lot.grade ?? "—"} />
        <DetailField label="Crop year" value={lot.cropYear ?? "—"} />
        <DetailField label="Process" value={lot.processMethod ?? "—"} />
        <DetailField label="Variety" value={lot.variety ?? "—"} />
        <DetailField label="Origin" value={origin || "—"} />
        <DetailField
          label="On lot"
          value={
            lot.quantity != null && lot.quantity !== ""
              ? `${formatQty(lot.quantity)} kg`
              : "—"
          }
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField
          label="Moisture %"
          value={scoreValue(lot.moisturePercent, "%")}
        />
        <DetailField label="Cupping" value={scoreValue(lot.cuppingScore)} />
        <DetailField label="Screen" value={scoreValue(lot.screenSize)} />
        <DetailField
          label="Defects"
          value={
            lot.defectCount != null || lot.defectLevel
              ? `${lot.defectCount ?? "—"} / ${lot.defectLevel ?? "—"}`
              : "—"
          }
        />
        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
            ECTA
          </p>
          <div className="mt-1">
            <QualitySummary quality={line.quality} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PurchaseDetail({ purchase }: { purchase: Purchase }) {
  const lines = purchase.lines ?? [];
  const [openLineKey, setOpenLineKey] = useState<string | null>(null);
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
            createdAt={purchase.createdAt}
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
          description={`${lines.length} line${lines.length === 1 ? "" : "s"} · click a row for lot details`}
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
                    <th>Lot (SKU)</th>
                    <th className="text-right tabular-nums">Qty (Farasula)</th>
                    <th className="text-right tabular-nums">Price / Farasula</th>
                    <th className="text-right tabular-nums">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const measured = fromStoredPurchaseLine(
                      line.quantity,
                      line.unitPrice,
                      line.lineTotal
                    );
                    const rowKey = line.id ?? `${line.itemId}-${i}`;
                    const open = openLineKey === rowKey;
                    const lotCode =
                      line.lot?.code ?? line.item?.sku ?? line.lotId?.slice(0, 8);
                    return (
                    <Fragment key={rowKey}>
                    <tr
                      className="cursor-pointer hover:bg-[var(--frappe-section-head)]/80"
                      onClick={() =>
                        setOpenLineKey((current) =>
                          current === rowKey ? null : rowKey
                        )
                      }
                    >
                      <td>
                        <span className="inline-flex items-center gap-1.5">
                          <ChevronDownIcon
                            className={`size-3.5 text-[var(--frappe-text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
                          />
                          {line.item?.description ?? line.itemId}
                        </span>
                      </td>
                      <td>
                        {line.lotId ? (
                          <Link
                            href={`/lots/${line.lotId}`}
                            className="font-medium text-[var(--frappe-primary)] hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {lotCode}
                          </Link>
                        ) : (
                          <span>{line.item?.sku ?? "—"}</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">
                        {farasulaKgLabel(measured.farasula) ?? "—"}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatMoney(measured.pricePerFarasula)}
                      </td>
                      <td className="text-right tabular-nums font-medium">
                        {formatMoney(lineAmount(line))}
                      </td>
                    </tr>
                    {open ? (
                      <tr key={`${rowKey}-details`} className="bg-[var(--frappe-section-head)]/40">
                        <td colSpan={5} className="px-3 py-3">
                          <LotDetailsPanel line={line} />
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                    );
                  })}
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

        {/* <FrappeSection
          title="Warehouse stock"
          description="Purchased coffee is available at this warehouse. A process run is started separately from Processing, using the stock you select. Normal operation is a processing yield of 80% or more."
        >
          {(purchase.processRuns ?? []).length === 0 ? (
            <p className="text-sm text-[var(--frappe-text-muted)]">
              This purchase is in warehouse inventory.{" "}
              <Link
                href="/process-runs/new"
                className="text-[var(--frappe-primary)] hover:underline"
              >
                Create a process run
              </Link>{" "}
              when you are ready to process it.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="frappe-list-table">
                <thead>
                  <tr>
                    <th>Workflow</th>
                    <th>Run</th>
                    <th>Lot (SKU)</th>
                    <th>Kg</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(purchase.processRuns ?? []).map((run) => (
                    <tr key={run.id}>
                      <td>
                        {processWorkflowLabel(
                          run.workflow ?? purchase.purchaseType
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/process-runs/${run.id}`}
                          className="font-medium text-[var(--frappe-primary)] hover:underline"
                        >
                          {run.runNumber}
                        </Link>
                      </td>
                      <td>
                        {run.inputLotId ? (
                          <Link
                            href={`/lots/${run.inputLotId}`}
                            className="text-[var(--frappe-primary)] hover:underline"
                          >
                            {run.inputLot?.code ?? "Lot"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="tabular-nums">
                        {formatQty(run.quantityInput)} kg
                      </td>
                      <td>
                        <Badge variant="outline">
                          {processStatusLabel(run.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FrappeSection> */}

        <FrappeSection
          title="Warehouse test scores"
          description="Moisture, cupping, screen, and defects recorded on each lot"
        >
          {lines.some((line) => line.lot) ? (
            <div className="overflow-x-auto">
              <table className="frappe-list-table">
                <thead>
                  <tr>
                    <th>Lot (SKU)</th>
                    <th>Moisture %</th>
                    <th>Cupping</th>
                    <th>Screen</th>
                    <th>Defects</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const lot = line.lot;
                    if (!lot) return null;
                    return (
                      <tr key={line.id ?? `scores-${i}`}>
                        <td className="font-medium">{lot.code}</td>
                        <td>{scoreValue(lot.moisturePercent, "%")}</td>
                        <td>{scoreValue(lot.cuppingScore)}</td>
                        <td>{scoreValue(lot.screenSize)}</td>
                        <td>
                          {lot.defectCount != null || lot.defectLevel
                            ? `${lot.defectCount ?? "—"} / ${lot.defectLevel ?? "—"}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--frappe-text-muted)]">
              No lot scores on this purchase.
            </p>
          )}
        </FrappeSection>

        {lines.some((l) => l.quality || l.lotId) ? (
          <FrappeSection
            title="Ethiopian Coffee and Tea Authority (ECTA) quality Results"
            description="Lab results linked to this purchase and lot"
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
