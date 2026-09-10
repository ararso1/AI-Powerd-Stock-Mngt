import type {
  BankTransaction,
  BankTransactionDirection,
  BankTransactionType,
} from "@/lib/types";
import { formatMoney } from "@/lib/format";

export const BANK_TRANSACTION_TYPE_OPTIONS: {
  value: BankTransactionType;
  label: string;
}[] = [
  { value: "SALE", label: "Sale" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "CREDIT_PAYMENT", label: "Credit payment" },
  { value: "EXPENSE", label: "Expense" },
];

export const BANK_TRANSACTION_DIRECTION_OPTIONS: {
  value: BankTransactionDirection;
  label: string;
}[] = [
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
];

const TYPE_LABELS = Object.fromEntries(
  BANK_TRANSACTION_TYPE_OPTIONS.map((option) => [option.value, option.label])
) as Record<BankTransactionType, string>;

export function bankTransactionTypeLabel(
  type: string | undefined
): string {
  if (!type) return "—";
  return TYPE_LABELS[type as BankTransactionType] ?? type.replace(/_/g, " ");
}

export function bankTransactionDirectionLabel(
  direction: BankTransactionDirection | string | undefined
): string {
  if (direction === "in") return "In";
  if (direction === "out") return "Out";
  return "—";
}

/** Amount is always positive from the API; sign comes from `direction`. */
export function formatBankTransactionAmount(
  tx: Pick<BankTransaction, "amount" | "direction">
): string {
  const n = parseFloat(tx.amount);
  if (Number.isNaN(n)) return formatMoney(tx.amount);
  if (tx.direction === "out") return formatMoney(-Math.abs(n));
  if (tx.direction === "in") return formatMoney(Math.abs(n));
  return formatMoney(tx.amount);
}
