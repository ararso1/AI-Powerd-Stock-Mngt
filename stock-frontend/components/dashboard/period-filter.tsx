"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PERIOD_PRESET_OPTIONS,
  type PeriodPreset,
} from "@/lib/period-range";
import { cn } from "@/lib/utils";

const GROUPS = ["Day", "Week", "Month", "Quarter", "Year", "Custom"] as const;

export function PeriodFilter({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  className,
  disabled,
}: {
  value: PeriodPreset;
  onChange: (value: PeriodPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--frappe-text-muted)]">
        Period
      </p>
      <div className="flex flex-wrap gap-1.5">
        {GROUPS.map((group) => {
          const options = PERIOD_PRESET_OPTIONS.filter((o) => o.group === group);
          return (
            <div key={group} className="flex flex-wrap gap-1.5">
              {options.map((opt) => {
                const active = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                      "h-8 rounded-md border px-2.5 text-xs font-medium transition",
                      active
                        ? "border-[var(--frappe-primary)] bg-[var(--frappe-primary)] text-white"
                        : "border-[var(--frappe-border)] bg-[var(--frappe-surface)] text-[var(--frappe-text)] hover:border-[var(--frappe-primary)]",
                      disabled && "pointer-events-none opacity-50"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {value === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label
              htmlFor="period-custom-from"
              className="text-xs text-[var(--frappe-text-muted)]"
            >
              From
            </Label>
            <Input
              id="period-custom-from"
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
              disabled={disabled}
              className="h-9 w-[150px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="period-custom-to"
              className="text-xs text-[var(--frappe-text-muted)]"
            >
              To
            </Label>
            <Input
              id="period-custom-to"
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => onCustomToChange(e.target.value)}
              disabled={disabled}
              className="h-9 w-[150px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
