"use client";

import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/shared/search-select";
import type { SearchOption } from "@/components/shared/search-select";

export function ReportEntityFilter({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SearchOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const allOptions: SearchOption[] = [
    { value: "", label: placeholder ?? `All ${label.toLowerCase()}s` },
    ...options,
  ];

  return (
    <div className={className}>
      <Label className="mb-2 block text-sm text-[var(--frappe-text-muted)]">
        {label}
      </Label>
      <SearchSelect
        value={value}
        onValueChange={onValueChange}
        options={allOptions}
        placeholder={placeholder ?? `All ${label.toLowerCase()}s`}
        searchPlaceholder={searchPlaceholder ?? `Search ${label.toLowerCase()}…`}
        emptyMessage={`No ${label.toLowerCase()} found.`}
        className="w-full min-w-[200px] sm:w-[240px]"
      />
    </div>
  );
}
