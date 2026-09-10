import type { ItemType } from "@/lib/types";

export const ITEM_TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: "RAW", label: "Raw material" },
  { value: "SEMI", label: "Semi-finished" },
  { value: "FINISHED", label: "Finished good" },
  { value: "OTHER", label: "Other" },
];

export function itemTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return (
    ITEM_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type
  );
}
