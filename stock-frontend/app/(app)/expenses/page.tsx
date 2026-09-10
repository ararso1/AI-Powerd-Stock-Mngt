"use client";

import { useState } from "react";
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
import { api } from "@/lib/api";
import { apiList } from "@/lib/list-response";
import { buildExpensesListPath } from "@/lib/list-query";
import { bankAccountSelectOptions } from "@/lib/bank-accounts";
import { formatMoney, formatDate, errorMessage } from "@/lib/format";
import type { BankAccount, Expense, ExpenseCategory, ExpenseListTotals } from "@/lib/types";
import { ListPageTotals } from "@/components/shared/list-page-totals";
import { useFetch } from "@/hooks/use-fetch";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";

export default function ExpensesPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { rows, meta, totals, setPage, setLimit, loading, reload } =
    usePaginatedList<Expense, ExpenseListTotals>(
      (page, limit) =>
        buildExpensesListPath(
          {
            from: from || undefined,
            to: to || undefined,
            search: debouncedSearch || undefined,
          },
          page,
          limit
        ),
      [from, to, debouncedSearch]
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
                key: "amount",
                header: "Amount",
                className: "text-right",
                cell: (r) => formatMoney(r.amount),
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

function ExpenseDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);

  const {
    data: categories,
    reload: reloadCategories,
    setData: setCategories,
  } = useFetch(() => api<ExpenseCategory[]>("/expenses/categories"), []);
  const {
    data: banks,
    reload: reloadBanks,
    setData: setBanks,
  } = useFetch(() => apiList<BankAccount>("/banks/accounts"), []);

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
    setSaving(true);
    try {
      await api("/expenses", {
        method: "POST",
        body: {
          categoryId,
          bankAccountId,
          amount: parseFloat(amount),
          description,
          expenseDate,
        },
      });
      toast.success("Expense recorded");
      setOpen(false);
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
            <EntitySelectField
              label="Bank account"
              required
              value={bankAccountId}
              onValueChange={setBankAccountId}
              options={bankAccountSelectOptions(banks ?? [], bankAccountId)}
              listHref="/banks"
              listLabel="All accounts"
              emptyMessage="Create a bank account to pay from."
              quickCreate={
                <QuickBankAccountDialog onCreated={onBankCreated} />
              }
            />
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
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
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
