"use client";

import Link from "next/link";
import { FrappeField } from "@/components/frappe";
import { SearchSelect } from "@/components/shared/search-select";
import { cn } from "@/lib/utils";

export interface EntityOption {
  id: string;
  label: string;
}

export function EntitySelectField({
  label,
  required,
  fullWidth,
  hint,
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  listHref,
  listLabel,
  quickCreate,
  emptyMessage,
  disabled,
  stackedActions,
  loading,
  filterLocally = true,
  onQueryChange,
}: {
  label: string;
  required?: boolean;
  fullWidth?: boolean;
  hint?: string;
  value: string;
  onValueChange: (id: string) => void;
  options: EntityOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  listHref: string;
  listLabel: string;
  quickCreate?: React.ReactNode;
  emptyMessage: string;
  disabled?: boolean;
  /** Stack select and action links vertically (better in narrow modals). */
  stackedActions?: boolean;
  loading?: boolean;
  filterLocally?: boolean;
  onQueryChange?: (query: string) => void;
}) {
  const hasOptions = options.length > 0;
  const emptyHint =
    hint ??
    (hasOptions ? undefined : `No ${label.toLowerCase()} yet — create one or open the list.`);

  return (
    <FrappeField
      label={label}
      required={required}
      fullWidth={fullWidth}
      hint={emptyHint}
    >
      <div
        className={cn(
          "flex flex-col gap-2",
          !stackedActions && "sm:flex-row sm:items-center"
        )}
      >
        <SearchSelect
          value={value}
          onValueChange={onValueChange}
          options={options.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          placeholder={
            hasOptions
              ? (placeholder ?? `Select ${label.toLowerCase()}`)
              : `No ${label.toLowerCase()}s`
          }
          searchPlaceholder={
            searchPlaceholder ?? `Search ${label.toLowerCase()}…`
          }
          emptyMessage={emptyMessage}
          disabled={disabled || (!hasOptions && !loading)}
          loading={loading}
          filterLocally={filterLocally}
          onQueryChange={onQueryChange}
          className="sm:flex-1"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {quickCreate}
          <Link
            href={listHref}
            className="text-xs text-[var(--frappe-text-muted)] hover:text-[var(--frappe-primary)] hover:underline"
          >
            {listLabel}
          </Link>
        </div>
      </div>
      {!hasOptions && !loading ? (
        <div className="mt-2 rounded border border-dashed border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-3 py-2 text-xs text-[var(--frappe-text-muted)]">
          {emptyMessage}
        </div>
      ) : null}
    </FrappeField>
  );
}
