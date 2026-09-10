"use client";

import { SearchSelect } from "@/components/shared/search-select";

export interface ItemSearchOption {
  itemId: string;
  label: string;
}

export function ItemSearchSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select item…",
  searchPlaceholder = "Search by name or SKU…",
  emptyMessage = "No items found.",
  disabled,
  loading,
  filterLocally = true,
  onQueryChange,
  className,
}: {
  value: string;
  onValueChange: (itemId: string) => void;
  options: ItemSearchOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  loading?: boolean;
  filterLocally?: boolean;
  onQueryChange?: (query: string) => void;
  className?: string;
}) {
  return (
    <SearchSelect
      value={value}
      onValueChange={onValueChange}
      options={options.map((option) => ({
        value: option.itemId,
        label: option.label,
      }))}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      loadingMessage="Loading items…"
      disabled={disabled}
      loading={loading}
      filterLocally={filterLocally}
      onQueryChange={onQueryChange}
      className={className}
    />
  );
}
