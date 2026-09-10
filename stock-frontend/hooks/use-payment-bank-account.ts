"use client";

import { useEffect } from "react";
import { needsBankAccount } from "@/lib/document-utils";
import { resolveBankAccountId } from "@/lib/bank-accounts";
import type { BankAccount, PaymentMethod } from "@/lib/types";

/** Auto-select cash till when only one CASH account applies. */
export function useAutoPaymentAccount(
  paymentMethod: PaymentMethod,
  accounts: BankAccount[] | null | undefined,
  bankAccountId: string,
  setBankAccountId: (id: string) => void
) {
  useEffect(() => {
    if (!needsBankAccount(paymentMethod) || !accounts?.length) return;
    const resolved = resolveBankAccountId(
      paymentMethod,
      accounts,
      bankAccountId
    );
    if (
      paymentMethod === "CASH" &&
      resolved &&
      bankAccountId !== resolved &&
      accounts.length === 1
    ) {
      setBankAccountId(resolved);
    }
  }, [accounts, paymentMethod, bankAccountId, setBankAccountId]);
}

export function onPaymentMethodChange(
  method: PaymentMethod,
  setPaymentMethod: (m: PaymentMethod) => void,
  setBankAccountId: (id: string) => void
) {
  setPaymentMethod(method);
  setBankAccountId("");
}

export function bankAccountValidationError(
  method: PaymentMethod,
  accounts: BankAccount[] | null | undefined,
  resolvedId: string | undefined
): string | null {
  if (!needsBankAccount(method)) return null;
  if (resolvedId) return null;
  if (method === "CASH") {
    if ((accounts?.length ?? 0) === 0) {
      return 'No cash till found. Create a CASH account under Bank.';
    }
    return "Select a cash till";
  }
  if ((accounts?.length ?? 0) === 0) {
    return "Create a BANK account under Bank settings.";
  }
  return "Select a bank account for the transfer";
}
