"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusIcon, Trash2Icon } from "lucide-react";

export function FrappeGridTable({
  columns,
  children,
  onAddRow,
  addLabel = "Add Row",
  className,
}: {
  columns: { key: string; label: string; className?: string }[];
  children: React.ReactNode;
  onAddRow?: () => void;
  addLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="frappe-grid w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-2 py-2 text-left text-xs font-semibold text-[var(--frappe-text-muted)]",
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
            <th className="w-10 px-2 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--frappe-border)]">{children}</tbody>
      </table>
      {onAddRow ? (
        <div className="border-t border-[var(--frappe-border)] bg-[var(--frappe-section-head)]/50 px-2 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-[var(--frappe-primary)] hover:text-[var(--frappe-primary-hover)]"
            onClick={onAddRow}
          >
            <PlusIcon className="size-3.5" />
            {addLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function FrappeGridRow({
  children,
  onRemove,
  canRemove = true,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  canRemove?: boolean;
}) {
  return (
    <tr className="bg-[var(--frappe-surface)] hover:bg-[var(--frappe-section-head)]/80">
      {children}
      <td className="px-1 py-1 align-middle">
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-[var(--frappe-text-muted)] hover:text-[var(--frappe-red)]"
            onClick={onRemove}
            disabled={!canRemove}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

export function FrappeGridCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-2 py-1.5 align-middle", className)}>{children}</td>
  );
}
