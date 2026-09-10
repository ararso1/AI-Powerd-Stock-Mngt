import type { CoffeeForm, LotEventType, LotStatus } from "@/lib/types";

export const COFFEE_FORM_OPTIONS: { value: CoffeeForm; label: string }[] = [
  { value: "CHERRY", label: "Cherry" },
  { value: "PARCHMENT", label: "Parchment" },
  { value: "GREEN", label: "Green" },
  { value: "ROASTED", label: "Roasted" },
  { value: "PACKAGED", label: "Packaged" },
  { value: "REJECT", label: "Reject" },
];

export const LOT_STATUS_OPTIONS: { value: LotStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "HOLD", label: "Hold" },
  { value: "VOIDED", label: "Voided" },
];

export function coffeeFormLabel(form: CoffeeForm | string): string {
  return COFFEE_FORM_OPTIONS.find((o) => o.value === form)?.label ?? form;
}

export function lotStatusLabel(status: LotStatus | string): string {
  return LOT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function lotEventLabel(type: LotEventType | string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
