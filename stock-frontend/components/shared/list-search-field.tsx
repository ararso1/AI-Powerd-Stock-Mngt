"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SearchIcon } from "lucide-react";

export function ListSearchField({
  id = "list-search",
  label = "Search",
  value,
  onChange,
  placeholder = "Search…",
  className,
  disabled,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id} className="text-sm text-[var(--frappe-text-muted)]">
        {label}
      </Label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--frappe-text-muted)]" />
        <Input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-9 w-full min-w-[200px] border-[var(--frappe-border)] bg-[var(--frappe-surface)] pl-9 sm:w-[240px]"
        />
      </div>
    </div>
  );
}
