"use client";

import { useState } from "react";
import { SearchSelect } from "@/components/shared/search-select";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { FrappeFilterBar, FrappeListToolbar } from "@/components/frappe";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { EntitySelectField } from "@/components/shared/entity-select-field";
import { QuickExpenseCategoryDialog } from "@/components/expenses/quick-expense-category-dialog";
import { QuickBankAccountDialog } from "@/components/banks/quick-bank-account-dialog";
import { FrappeButtonPrimary } from "@/components/frappe";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, apiBlob } from "@/lib/api";
import { apiList } from "@/lib/list-response";
import { buildExpensesListPath } from "@/lib/list-query";
import {
  bankAccountSelectOptions,
  bankAccountsUrl,
  resolveBankAccountId,
} from "@/lib/bank-accounts";
import {
  bankAccountValidationError,
  onPaymentMethodChange,
  useAutoPaymentAccount,
} from "@/hooks/use-payment-bank-account";
import { formatMoney, formatDate, errorMessage } from "@/lib/format";
import type {
  BankAccount,
  Expense,
  ExpenseCategory,
  ExpenseListTotals,
  PaymentMethod,
} from "@/lib/types";
import { ListPageTotals } from "@/components/shared/list-page-totals";
import { useFetch } from "@/hooks/use-fetch";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";

export default function ExpensesPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [coffeeMarket, setCoffeeMarket] = useState<
    "" | "LOCAL" | "EXPORT" | "NONE"
  >("");
  const debouncedSearch = useDebouncedValue(search);
  const { rows, meta, totals, setPage, setLimit, loading, reload } =
    usePaginatedList<Expense, ExpenseListTotals>(
      (page, limit) =>
        buildExpensesListPath(
          {
            from: from || undefined,
            to: to || undefined,
            search: debouncedSearch || undefined,
            coffeeMarket: coffeeMarket || undefined,
          },
          page,
          limit
        ),
      [from, to, debouncedSearch, coffeeMarket]
    );

  return (
    <AppShell
      title="Expenses"
      actions={
        <PermissionGate permission="expense.write">
          <ExpenseDialog onSuccess={reload} />
        </PermissionGate>
      }
    >
      <PermissionGate permission="expense.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search expenses..."
          />
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
          <div className="grid min-w-[220px] gap-2">
            <Label className="text-sm text-[var(--frappe-text-muted)]">
              Coffee
            </Label>
            <SearchSelect
              value={coffeeMarket}
              onValueChange={(value) =>
                setCoffeeMarket(value as "" | "LOCAL" | "EXPORT" | "NONE")
              }
              options={COFFEE_MARKET_FILTER_OPTIONS}
              placeholder="All expenses"
              searchPlaceholder="Search…"
            />
          </div>
        </FrappeFilterBar>
        <FrappeListToolbar>
          <span className="text-[var(--frappe-text-muted)]">
            {meta.total} expense{meta.total === 1 ? "" : "s"}
          </span>
          {totals ? (
            <ListPageTotals
              items={[
                { label: "Total amount", value: formatMoney(totals.amount) },
              ]}
            />
          ) : null}
        </FrappeListToolbar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="No expenses"
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={[
              {
                key: "date",
                header: "Date",
                cell: (r) => formatDate(r.expenseDate),
              },
              {
                key: "category",
                header: "Category",
                cell: (r) => r.category?.name ?? "—",
              },
              {
                key: "desc",
                header: "Description",
                cell: (r) => r.description ?? "—",
              },
              {
                key: "coffee",
                header: "Coffee",
                cell: (r) => (
                  <CoffeeMarketCell expense={r} onSuccess={reload} />
                ),
              },
              {
                key: "amount",
                header: "Amount",
                className: "text-right",
                cell: (r) => formatMoney(r.amount),
              },
              {
                key: "payment",
                header: "Paid by",
                cell: (r) =>
                  r.paymentMethod === "CASH"
                    ? "Cash"
                    : r.bankAccount?.name
                      ? `Transfer · ${r.bankAccount.name}`
                      : "Transfer",
              },
              {
                key: "receipt",
                header: "Receipt",
                cell: (r) =>
                  r.receiptOriginalName ? (
                    <ReceiptLink id={r.id} name={r.receiptOriginalName} />
                  ) : (
                    "—"
                  ),
              },
              {
                key: "actions",
                header: "",
                className: "w-16 text-right",
                cell: (r) => (
                  <PermissionGate permission="expense.write">
                    <DeleteExpenseButton id={r.id} onSuccess={reload} />
                  </PermissionGate>
                ),
              },
            ]}
          />
        )}
      </PermissionGate>
    </AppShell>
  );
}

function DeleteExpenseButton({
  id,
  onSuccess,
}: {
  id: string;
  onSuccess: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this expense? Bank balance may be adjusted.")) return;
    setDeleting(true);
    try {
      await api(`/expenses/${id}`, { method: "DELETE" });
      toast.success("Expense deleted");
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-destructive"
      disabled={deleting}
      onClick={handleDelete}
    >
      <Trash2Icon className="size-4" />
      <span className="sr-only">Delete</span>
    </Button>
  );
}

const EXPENSE_PAYMENT_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Transfer" },
];

const COFFEE_MARKET_OPTIONS = [
  { value: "", label: "Unassigned" },
  { value: "LOCAL", label: "Local Market Coffee" },
  { value: "EXPORT", label: "Export Coffee" },
];

const COFFEE_MARKET_FILTER_OPTIONS = [
  { value: "", label: "All expenses" },
  { value: "LOCAL", label: "Local Market Coffee" },
  { value: "EXPORT", label: "Export Coffee" },
  { value: "NONE", label: "Unassigned" },
];

function coffeeMarketLabel(value?: string | null) {
  if (value === "LOCAL") return "Local Market Coffee";
  if (value === "EXPORT") return "Export Coffee";
  return "Unassigned";
}

function CoffeeMarketCell({
  expense,
  onSuccess,
}: {
  expense: Expense;
  onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function change(value: string) {
    const next = value === "" ? null : value;
    if ((expense.coffeeMarket ?? null) === next) return;
    setSaving(true);
    try {
      await api(`/expenses/${expense.id}`, {
        method: "PATCH",
        body: { coffeeMarket: next },
      });
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate
      permission="expense.write"
      fallback={
        <span className="text-sm">{coffeeMarketLabel(expense.coffeeMarket)}</span>
      }
    >
      <SearchSelect
        value={expense.coffeeMarket ?? ""}
        onValueChange={(value) => void change(value)}
        options={COFFEE_MARKET_OPTIONS}
        placeholder="Unassigned"
        searchPlaceholder="Search…"
        disabled={saving}
        className="min-w-[180px]"
      />
    </PermissionGate>
  );
}

function ExpenseDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [receipt, setReceipt] = useState<File | null>(null);
  const [coffeeMarket, setCoffeeMarket] = useState("");
  const [saving, setSaving] = useState(false);

  const accountType = paymentMethod === "CASH" ? "CASH" : "BANK";
  const {
    data: categories,
    reload: reloadCategories,
    setData: setCategories,
  } = useFetch(() => api<ExpenseCategory[]>("/expenses/categories"), []);
  const {
    data: banks,
    loading: banksLoading,
    reload: reloadBanks,
    setData: setBanks,
  } = useFetch(
    () => apiList<BankAccount>(bankAccountsUrl(accountType)),
    [accountType]
  );

  useAutoPaymentAccount(
    paymentMethod,
    banks,
    bankAccountId,
    setBankAccountId
  );

  const showAccountList =
    paymentMethod === "BANK" || (banks?.length ?? 0) !== 1;

  function onCategoryCreated(category: ExpenseCategory) {
    setCategories((prev) => [...(prev ?? []), category]);
    setCategoryId(category.id);
    reloadCategories();
  }

  function onBankCreated(account: BankAccount) {
    setBanks((prev) => [...(prev ?? []), account]);
    setBankAccountId(account.id);
    reloadBanks();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolvedBankId = resolveBankAccountId(
      paymentMethod,
      banks,
      bankAccountId
    );
    const bankError = bankAccountValidationError(
      paymentMethod,
      banks,
      resolvedBankId
    );
    if (bankError || !resolvedBankId) {
      toast.error(bankError ?? "Select an account");
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.append("categoryId", categoryId);
      form.append("paymentMethod", paymentMethod);
      form.append("bankAccountId", resolvedBankId);
      form.append("amount", amount);
      form.append("expenseDate", expenseDate);
      if (description.trim()) form.append("description", description.trim());
      if (coffeeMarket) form.append("coffeeMarket", coffeeMarket);
      if (receipt) form.append("file", receipt);
      await api("/expenses", { method: "POST", body: form });
      toast.success("Expense recorded");
      setOpen(false);
      setReceipt(null);
      setCoffeeMarket("");
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          Add expense
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-3">
            <DialogTitle className="text-base">Record expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <EntitySelectField
              label="Category"
              required
              value={categoryId}
              onValueChange={setCategoryId}
              options={(categories ?? []).map((c) => ({
                id: c.id,
                label: c.name,
              }))}
              listHref="/expenses"
              listLabel="Manage categories"
              emptyMessage="Create an expense category first."
              quickCreate={
                <QuickExpenseCategoryDialog onCreated={onCategoryCreated} />
              }
            />
            <div className="grid gap-2">
              <Label>Payment</Label>
              <SearchSelect
                value={paymentMethod}
                onValueChange={(value) =>
                  onPaymentMethodChange(
                    value as PaymentMethod,
                    setPaymentMethod,
                    setBankAccountId
                  )
                }
                options={EXPENSE_PAYMENT_OPTIONS}
                placeholder="Select payment"
                searchPlaceholder="Search…"
              />
            </div>
            {showAccountList ? (
              <EntitySelectField
                label={paymentMethod === "CASH" ? "Cash till" : "Bank account"}
                required
                value={bankAccountId}
                onValueChange={setBankAccountId}
                options={bankAccountSelectOptions(banks ?? [], bankAccountId)}
                listHref="/banks"
                listLabel="All accounts"
                emptyMessage={
                  paymentMethod === "CASH"
                    ? "Create a cash till under Bank."
                    : "Create a bank account to transfer from."
                }
                quickCreate={
                  <QuickBankAccountDialog
                    defaultAccountType={accountType}
                    onCreated={onBankCreated}
                  />
                }
                loading={banksLoading}
              />
            ) : null}
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Coffee</Label>
              <SearchSelect
                value={coffeeMarket}
                onValueChange={setCoffeeMarket}
                options={COFFEE_MARKET_OPTIONS}
                placeholder="Unassigned"
                searchPlaceholder="Search…"
              />
              <p className="text-xs text-[var(--frappe-text-muted)]">
                Optional. Leave unassigned when the expense is not for a
                specific coffee market.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-receipt">Receipt (optional)</Label>
              <Input
                id="expense-receipt"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-[var(--frappe-text-muted)]">
                JPEG, PNG, WebP, or PDF, up to 10MB.
              </p>
            </div>
          </div>
          <DialogFooter className="border-t border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-3">
            <FrappeButtonPrimary type="submit" disabled={saving}>
              Save
            </FrappeButtonPrimary>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptLink({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="text-xs font-medium text-[var(--frappe-primary)] hover:underline disabled:opacity-50"
      onClick={() => {
        setBusy(true);
        void apiBlob(`/expenses/${id}/receipt`)
          .then(({ blob }) => {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
          })
          .catch((err) => toast.error(errorMessage(err)))
          .finally(() => setBusy(false));
      }}
    >
      {busy ? "Opening…" : name}
    </button>
  );
}
