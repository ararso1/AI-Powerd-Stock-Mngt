"use client";

import { Badge } from "@/components/ui/badge";
import {
  FrappeButtonLink,
  FrappeDocument,
  FrappeFormGrid,
  FrappeSection,
} from "@/components/frappe";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate, formatQty } from "@/lib/format";
import type { Bom } from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

export function BomDetail({ bom }: { bom: Bom }) {
  const lines = bom.lines ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FrappeButtonLink href="/boms">← Back to list</FrappeButtonLink>
        <Badge
          variant={bom.isActive === false ? "secondary" : "outline"}
          className="ml-auto"
        >
          {bom.isActive === false ? "Inactive" : "Active"}
        </Badge>
        <PermissionGate permission="bom.write">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/boms/${bom.id}/edit`}>Edit</Link>
          </Button>
        </PermissionGate>
      </div>

      <FrappeDocument>
        <FrappeSection
          title={bom.name}
          description={
            bom.createdAt ? `Created ${formatDate(bom.createdAt)}` : undefined
          }
        >
          <FrappeFormGrid columns={2}>
            <DetailField
              label="Finished item"
              value={bom.finishedItem?.description ?? bom.finishedItemId}
            />
            <DetailField label="Version" value={bom.version ?? "—"} />
            <DetailField
              label="Document ID"
              value={<span className="font-mono text-xs">{bom.id}</span>}
            />
            {bom.notes ? (
              <div className="sm:col-span-2">
                <DetailField label="Notes" value={bom.notes} />
              </div>
            ) : null}
          </FrappeFormGrid>
        </FrappeSection>

        <FrappeSection
          title="Components"
          description={`${lines.length} line${lines.length === 1 ? "" : "s"} per finished unit`}
        >
          {lines.length === 0 ? (
            <p className="text-sm text-[var(--frappe-text-muted)]">
              No component lines.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="frappe-list-table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>SKU</th>
                    <th className="text-right tabular-nums">Qty / FG</th>
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
                        {formatQty(String(line.quantity))}
                        {line.componentItem?.unit
                          ? ` ${line.componentItem.unit}`
                          : ""}
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
    </div>
  );
}
