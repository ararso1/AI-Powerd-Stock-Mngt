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

/** Lock structural edits when further credit payments exist (not the initial partial deposit). */
export function purchaseNotesOnly(purchase?: {
  hasCreditPayments?: boolean;
  paymentMethod?: PaymentMethod;
  credit?: LinkedCredit;
  supplierCredit?: LinkedCredit;
}): boolean {
  if (!purchase) return false;
  if (purchase.hasCreditPayments) return true;
  if (purchase.paymentMethod === "PARTIAL") return false;
  return creditHasPayments(purchase.credit ?? purchase.supplierCredit);
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
  return method === "CASH" || method === "BANK" || method === "PARTIAL";
}

export function createsPurchaseCredit(method: PaymentMethod): boolean {
  return method === "CREDIT" || method === "PARTIAL";
}

export function paymentMethodLabel(method?: PaymentMethod | string | null): string {
  if (!method) return "—";
  switch (method) {
    case "CASH":
      return "Cash";
    case "BANK":
      return "Bank transfer";
    case "CREDIT":
      return "Credit";
    case "PARTIAL":
      return "Partially paid";
    default:
      return String(method).replace(/_/g, " ");
  }
}
