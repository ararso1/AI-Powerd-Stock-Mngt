"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  className,
  disabled,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)}>
      <div className="grid gap-2">
        <Label
          htmlFor="date-from"
          className="text-sm text-[var(--frappe-text-muted)]"
        >
          From
        </Label>
        <Input
          id="date-from"
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-[150px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]"
        />
      </div>
      <div className="grid gap-2">
        <Label
          htmlFor="date-to"
          className="text-sm text-[var(--frappe-text-muted)]"
        >
          To
        </Label>
        <Input
          id="date-to"
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-[150px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]"
        />
      </div>
    </div>
  );
}
