"use client";

import { Badge } from "@/components/ui/badge";
import {
  FrappeDocument,
  FrappeFormGrid,
  FrappeSection,
  FrappeButtonLink,
} from "@/components/frappe";
import { formatDate, formatQty } from "@/lib/format";
import type { StockTransfer } from "@/lib/types";

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

export function TransferDetail({ transfer }: { transfer: StockTransfer }) {
  const lines = transfer.lines ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FrappeButtonLink href="/stock-transfers">← Back to list</FrappeButtonLink>
        <Badge variant="outline" className="ml-auto">
          {transfer.status}
        </Badge>
      </div>

      <FrappeDocument>
        <FrappeSection
          title="Transfer"
          description={
            transfer.createdAt
              ? `Created ${formatDate(transfer.createdAt)}`
              : undefined
          }
        >
          <FrappeFormGrid columns={2}>
            <DetailField
              label="From"
              value={transfer.fromLocation?.name ?? "—"}
            />
            <DetailField
              label="To"
              value={transfer.toLocation?.name ?? "—"}
            />
            <DetailField
              label="Document ID"
              value={
                <span className="font-mono text-xs">{transfer.id}</span>
              }
            />
            {transfer.notes ? (
              <div className="sm:col-span-2">
                <DetailField label="Notes" value={transfer.notes} />
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
              No line items on this transfer.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="frappe-list-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Lot</th>
                    <th>SKU</th>
                    <th className="text-right tabular-nums">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={line.id ?? `${line.itemId}-${i}`}>
                      <td>{line.item?.description ?? line.itemId}</td>
                      <td className="text-[var(--frappe-text-muted)]">
                        {line.lot?.code ?? "—"}
                      </td>
                      <td className="text-[var(--frappe-text-muted)]">
                        {line.item?.sku ?? "—"}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatQty(line.quantity)}
                        {line.item?.unit ? ` ${line.item.unit}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FrappeSection>
      </FrappeDocument>
    </div>
  );
}
