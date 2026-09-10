"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { BankAccountFormFields } from "@/components/banks/bank-account-form-fields";
import { FrappeFilterBar } from "@/components/frappe";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { apiList } from "@/lib/list-response";
import { buildBanksTransactionsListPath } from "@/lib/list-query";
import {
  BANK_TRANSACTION_DIRECTION_OPTIONS,
  BANK_TRANSACTION_TYPE_OPTIONS,
  bankTransactionDirectionLabel,
  bankTransactionTypeLabel,
  formatBankTransactionAmount,
} from "@/lib/bank-transactions";
import {
  buildBankAccountBody,
  bankAccountFormFromRecord,
  emptyBankAccountForm,
  formatBankAccountLabel,
} from "@/lib/bank-accounts";
import { formatMoney, formatDate, errorMessage } from "@/lib/format";
import type {
  BankAccount,
  BankLiquidity,
  BankTransaction,
  BankTransactionDirection,
  BankTransactionType,
} from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useClientPaginatedList } from "@/hooks/use-client-paginated-list";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { PencilIcon, PlusIcon } from "lucide-react";

export default function BanksPage() {
  const [accountId, setAccountId] = useState<string>("");
  const [transactionType, setTransactionType] = useState<
    BankTransactionType | ""
  >("");
  const [direction, setDirection] = useState<BankTransactionDirection | "">(
    ""
  );
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: accounts, loading, reload } = useFetch(
    () => apiList<BankAccount>("/banks/accounts"),
    []
  );
  const { data: liquidity, reload: reloadLiquidity } = useFetch(
    () => api<BankLiquidity>("/banks/liquidity"),
    []
  );

  function refreshAll() {
    reload();
    reloadLiquidity();
  }

  const effectiveId = accountId || accounts?.[0]?.id || "";
  const {
    rows: accountRows,
    meta: accountMeta,
    setPage: setAccountPage,
    setLimit: setAccountLimit,
  } = useClientPaginatedList(accounts, [accounts]);

  const transactionList = usePaginatedList<BankTransaction>(
    (page, limit) =>
      effectiveId
        ? buildBanksTransactionsListPath(
            {
              bankAccountId: effectiveId,
              from: from || undefined,
              to: to || undefined,
              type: transactionType || undefined,
              direction: direction || undefined,
              search: debouncedSearch || undefined,
            },
            page,
            limit
          )
        : null,
    [effectiveId, from, to, transactionType, direction, debouncedSearch]
  );

  return (
    <AppShell
      title="Bank"
      actions={
        <PermissionGate permission="bank.write">
          <div className="flex gap-2">
            <AccountDialog onSuccess={refreshAll} />
            <AdjustmentDialog
              accounts={accounts ?? []}
              onSuccess={refreshAll}
            />
          </div>
        </PermissionGate>
      }
    >
      <PermissionGate permission="bank.read">
        {loading ? (
          <PageLoading />
        ) : (
          <Tabs defaultValue="accounts">
            <TabsList>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>
            <TabsContent value="accounts" className="mt-4 space-y-4">
              {liquidity?.totals ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Cash on hand</CardDescription>
                      <CardTitle className="text-xl tabular-nums">
                        {formatMoney(liquidity.totals.cashTotal)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Bank balances</CardDescription>
                      <CardTitle className="text-xl tabular-nums">
                        {formatMoney(liquidity.totals.bankTotal)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total liquidity</CardDescription>
                      <CardTitle className="text-xl tabular-nums">
                        {formatMoney(liquidity.totals.totalLiquidity)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>
              ) : null}
              <DataCardTable
                rows={accountRows}
                emptyTitle="No bank accounts"
                pagination={{
                  meta: accountMeta,
                  onPageChange: setAccountPage,
                  onLimitChange: setAccountLimit,
                }}
                columns={[
                  { key: "name", header: "Display name", cell: (r) => r.name },
                  {
                    key: "type",
                    header: "Type",
                    cell: (r) => (
                      <Badge variant="outline">
                        {r.accountType ?? "BANK"}
                      </Badge>
                    ),
                  },
                  {
                    key: "bank",
                    header: "Bank",
                    cell: (r) => r.bankName ?? "—",
                  },
                  {
                    key: "holder",
                    header: "Account holder",
                    cell: (r) => r.accountHolderName ?? "—",
                  },
                  {
                    key: "number",
                    header: "Account #",
                    cell: (r) => r.accountNumber ?? "—",
                  },
                  {
                    key: "balance",
                    header: "Balance",
                    className: "w-32 text-right tabular-nums",
                    cell: (r) => formatMoney(r.balance),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (r) => (
                      <Badge
                        variant={r.isActive === false ? "secondary" : "outline"}
                      >
                        {r.isActive === false ? "Inactive" : "Active"}
                      </Badge>
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    className: "w-16 text-right",
                    cell: (r) => (
                      <PermissionGate permission="bank.write">
                        <EditAccountDialog account={r} onSuccess={refreshAll} />
                      </PermissionGate>
                    ),
                  },
                ]}
              />
            </TabsContent>
            <TabsContent value="transactions" className="mt-4 space-y-4">
              <FrappeFilterBar>
                <ListSearchField
                  value={search}
                  onChange={setSearch}
                  placeholder="Search description…"
                />
                <div className="grid gap-2">
                  <Label className="text-sm text-[var(--frappe-text-muted)]">
                    Account
                  </Label>
                  <Select value={effectiveId} onValueChange={setAccountId}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {(accounts ?? [])
                        .filter((a) => a.isActive !== false)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {formatBankAccountLabel(a)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <DateRangeFilter
                  from={from}
                  to={to}
                  onFromChange={setFrom}
                  onToChange={setTo}
                />
                <div className="grid gap-2">
                  <Label className="text-sm text-[var(--frappe-text-muted)]">
                    Type
                  </Label>
                  <Select
                    value={transactionType || "__all__"}
                    onValueChange={(v) =>
                      setTransactionType(
                        v === "__all__" ? "" : (v as BankTransactionType)
                      )
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All types</SelectItem>
                      {BANK_TRANSACTION_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm text-[var(--frappe-text-muted)]">
                    Direction
                  </Label>
                  <Select
                    value={direction || "__all__"}
                    onValueChange={(v) =>
                      setDirection(
                        v === "__all__" ? "" : (v as BankTransactionDirection)
                      )
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {BANK_TRANSACTION_DIRECTION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </FrappeFilterBar>
              {transactionList.loading ? (
                <PageLoading />
              ) : (
                <DataCardTable
                  rows={transactionList.rows}
                  emptyTitle="No transactions"
                  pagination={{
                    meta: transactionList.meta,
                    onPageChange: transactionList.setPage,
                    onLimitChange: transactionList.setLimit,
                    disabled: transactionList.loading,
                  }}
                  columns={[
                    {
                      key: "date",
                      header: "Date",
                      cell: (r) => formatDate(r.createdAt),
                    },
                    {
                      key: "type",
                      header: "Type",
                      cell: (r) => (
                        <Badge variant="outline">
                          {bankTransactionTypeLabel(r.type)}
                        </Badge>
                      ),
                    },
                    {
                      key: "dir",
                      header: "Direction",
                      cell: (r) => bankTransactionDirectionLabel(r.direction),
                    },
                    {
                      key: "amount",
                      header: "Amount",
                      className: "text-right tabular-nums",
                      cell: (r) => formatBankTransactionAmount(r),
                    },
                    {
                      key: "balance",
                      header: "Balance after",
                      className: "text-right tabular-nums",
                      cell: (r) => formatMoney(r.balanceAfter),
                    },
                    {
                      key: "desc",
                      header: "Description",
                      cell: (r) => r.description ?? "—",
                    },
                  ]}
                />
              )}
            </TabsContent>
          </Tabs>
        )}
      </PermissionGate>
    </AppShell>
  );
}

function AccountDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(emptyBankAccountForm());
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      toast.error("Display name is required");
      return;
    }
    setSaving(true);
    try {
      await api("/banks/accounts", {
        method: "POST",
        body: buildBankAccountBody(values, "create"),
      });
      toast.success("Account created");
      setOpen(false);
      setValues(emptyBankAccountForm());
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValues(emptyBankAccountForm());
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PlusIcon />
          Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New account</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <BankAccountFormFields
              mode="create"
              values={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAccountDialog({
  account,
  onSuccess,
}: {
  account: BankAccount;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => bankAccountFormFromRecord(account));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      toast.error("Display name is required");
      return;
    }
    setSaving(true);
    try {
      await api(`/banks/accounts/${account.id}`, {
        method: "PATCH",
        body: buildBankAccountBody(values, "edit"),
      });
      toast.success("Account updated");
      setOpen(false);
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValues(bankAccountFormFromRecord(account));
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8">
          <PencilIcon className="size-4" />
          <span className="sr-only">Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit {account.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <BankAccountFormFields
              mode="edit"
              values={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentDialog({
  accounts,
  onSuccess,
}: {
  accounts: BankAccount[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/banks/transactions/adjustment", {
        method: "POST",
        body: {
          bankAccountId,
          amount: parseFloat(amount),
          direction,
          description,
        },
      });
      toast.success("Adjustment posted");
      setOpen(false);
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const activeAccounts = accounts.filter((a) => a.isActive !== false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          Adjustment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Balance adjustment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Account</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {formatBankAccountLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Direction</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as "in" | "out")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">In</SelectItem>
                  <SelectItem value="out">Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Post
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
