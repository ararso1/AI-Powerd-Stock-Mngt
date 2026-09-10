import type { ReactNode } from "react";

export function ListPageTotals({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  if (items.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums text-[var(--frappe-text-muted)]">
      {items.map((item) => (
        <span key={item.label}>
          {item.label}:{" "}
          <span className="font-medium text-[var(--frappe-text)]">
            {item.value}
          </span>
        </span>
      ))}
    </span>
  );
}
