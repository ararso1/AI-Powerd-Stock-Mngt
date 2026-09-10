import type { BankAccount, BankAccountType, PaymentMethod } from "@/lib/types";

export interface BankAccountFormValues {
  name: string;
  accountType: BankAccountType;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  balance: string;
  isActive: boolean;
}

export const emptyBankAccountForm = (
  accountType: BankAccountType = "BANK"
): BankAccountFormValues => ({
  name: "",
  accountType,
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  balance: "",
  isActive: true,
});

export function bankAccountFormFromRecord(
  account: BankAccount
): BankAccountFormValues {
  return {
    name: account.name,
    accountType: account.accountType ?? "BANK",
    bankName: account.bankName ?? "",
    accountHolderName: account.accountHolderName ?? "",
    accountNumber: account.accountNumber ?? "",
    balance: "",
    isActive: account.isActive !== false,
  };
}

export function formatBankAccountLabel(account: BankAccount): string {
  if (account.bankName) {
    return `${account.name} — ${account.bankName}`;
  }
  return account.name;
}

export function bankAccountTypeForPayment(
  method: PaymentMethod
): BankAccountType | null {
  if (method === "CASH") return "CASH";
  if (method === "BANK") return "BANK";
  return null;
}

export function bankAccountsUrl(type?: BankAccountType | null): string {
  if (type) return `/banks/accounts?type=${type}`;
  return "/banks/accounts";
}

/** Active accounts for dropdowns; keeps selected account visible when editing. */
export function bankAccountsForSelect(
  accounts: BankAccount[],
  selectedId?: string
): BankAccount[] {
  const active = accounts.filter((a) => a.isActive !== false);
  if (selectedId && !active.some((a) => a.id === selectedId)) {
    const current = accounts.find((a) => a.id === selectedId);
    if (current) return [...active, current];
  }
  return active;
}

export function bankAccountSelectOptions(
  accounts: BankAccount[],
  selectedId?: string
): { id: string; label: string }[] {
  return bankAccountsForSelect(accounts, selectedId).map((b) => ({
    id: b.id,
    label: formatBankAccountLabel(b),
  }));
}

export function resolveBankAccountId(
  method: PaymentMethod,
  accounts: BankAccount[] | null | undefined,
  selectedId: string
): string | undefined {
  if (method === "CREDIT") return undefined;
  const list = bankAccountsForSelect(accounts ?? [], selectedId);
  if (selectedId && list.some((a) => a.id === selectedId)) return selectedId;
  if (method === "CASH" && list.length > 0) return list[0].id;
  return selectedId || undefined;
}

export function showsPaymentAccountPicker(
  method: PaymentMethod,
  accounts: BankAccount[] | null | undefined
): boolean {
  if (method === "BANK") return true;
  if (method === "CASH") return (accounts?.length ?? 0) > 1;
  return false;
}

export function paymentAccountFieldLabel(method: PaymentMethod): string {
  return method === "CASH" ? "Cash till" : "Bank account";
}

export function buildBankAccountBody(
  values: BankAccountFormValues,
  mode: "create" | "edit"
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: values.name.trim(),
  };
  if (mode === "create") {
    body.accountType = values.accountType;
  }
  if (values.bankName.trim()) body.bankName = values.bankName.trim();
  if (values.accountHolderName.trim()) {
    body.accountHolderName = values.accountHolderName.trim();
  }
  if (values.accountNumber.trim()) {
    body.accountNumber = values.accountNumber.trim();
  }
  if (mode === "create" && values.balance.trim()) {
    const balance = parseFloat(values.balance);
    if (!Number.isNaN(balance)) body.balance = balance;
  }
  if (mode === "edit") {
    body.isActive = values.isActive;
  }
  return body;
}
