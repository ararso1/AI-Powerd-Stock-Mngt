import type { LinkedCredit, PaymentMethod } from "@/lib/types";

/** Resolve document total from API fields (`total`, legacy `totalAmount`, or `subtotal`). */
export function documentTotal(doc: {
  total?: string;
  subtotal?: string;
  totalAmount?: string;
}): string | undefined {
  return doc.total ?? doc.totalAmount ?? doc.subtotal;
}

export function creditHasPayments(credit?: LinkedCredit): boolean {
  if (!credit?.paidAmount) return false;
  const paid = parseFloat(credit.paidAmount);
  return !Number.isNaN(paid) && paid > 0;
}

export function creditBalance(record: {
  balance?: string;
  amount: string;
  paidAmount?: string;
}): string {
  if (record.balance !== undefined && record.balance !== "") {
    return record.balance;
  }
  const amount = parseFloat(record.amount) || 0;
  const paid = parseFloat(record.paidAmount ?? "0") || 0;
  return Math.max(0, amount - paid).toFixed(2);
}

export function needsBankAccount(method: PaymentMethod): boolean {
  return method === "CASH" || method === "BANK";
}
