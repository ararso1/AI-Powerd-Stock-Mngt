import type { CommissionBasis, PaymentMethod } from "@/lib/types";
import type { SearchOption } from "@/components/shared/search-select";

export const PAYMENT_METHOD_OPTIONS: SearchOption[] = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank" },
  { value: "CREDIT", label: "Credit" },
];

export const COMMISSION_BASIS_OPTIONS: SearchOption[] = [
  { value: "PROFIT", label: "Profit (revenue − cost)" },
  { value: "SALES", label: "Sales (subtotal)" },
];

export function paymentMethodOption(method: PaymentMethod): SearchOption {
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === method) ?? {
      value: method,
      label: method,
    }
  );
}

export function commissionBasisOption(basis: CommissionBasis): SearchOption {
  return (
    COMMISSION_BASIS_OPTIONS.find((option) => option.value === basis) ?? {
      value: basis,
      label: basis,
    }
  );
}
