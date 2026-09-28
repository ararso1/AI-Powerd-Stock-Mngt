"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { FrappeFilterBar, FrappeListToolbar } from "@/components/frappe";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { apiList } from "@/lib/list-response";
import {
  bankAccountsForSelect,
  formatBankAccountLabel,
} from "@/lib/bank-accounts";
import { creditBalance } from "@/lib/document-utils";
import {
  buildCreditsCustomersListPath,
  buildCreditsSuppliersListPath,
} from "@/lib/list-query";
import { formatMoney, formatDate, errorMessage } from "@/lib/format";
import type {
  BankAccount,
  CreditAgingReport,
  CreditListTotals,
  CreditPaymentHistoryItem,
  CreditRecord,
  CreditStatus,
} from "@/lib/types";
import { ListPageTotals } from "@/components/shared/list-page-totals";
import { useFetch } from "@/hooks/use-fetch";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const CREDIT_STATUS_CLASS: Record<CreditStatus, string> = {
  OPEN: "border-transparent bg-primary/15 text-primary",
  PARTIAL: "border-transparent bg-warning text-warning-foreground",
  PAID: "border-transparent bg-[var(--csolve-moss)] text-[var(--csolve-parchment)]",
};

const CREDIT_STATUS_LABEL: Record<CreditStatus, string> = {
  OPEN: "Open",
  PARTIAL: "Partial",
  PAID: "Paid",
};

function creditStatusBadge(status: CreditStatus) {
  return (
    <Badge className={CREDIT_STATUS_CLASS[status]}>
      {CREDIT_STATUS_LABEL[status]}
    </Badge>
  );
}

function agingStatusClass(risk?: string | null) {
  if (!risk) return "border-transparent bg-muted text-muted-foreground";
  if (risk.includes("Highly")) {
    return "border-transparent bg-destructive text-[var(--csolve-parchment)]";
  }
  if (risk.includes("High Risk")) {
    return "border-transparent bg-destructive/15 text-destructive";
  }
  if (risk.includes("Attention")) {
    return "border-transparent bg-warning text-warning-foreground";
  }
  return "border-transparent bg-[var(--csolve-moss-soft)] text-[var(--csolve-moss)]";
}

function AgingStatusBadge({ risk }: { risk?: string | null }) {
  if (!risk) return null;
  return <Badge className={agingStatusClass(risk)}>{risk}</Badge>;
}

function isCreditOverdue(record: CreditRecord): boolean {
  if (record.status === "PAID" || !record.dueDate) return false;
  const due = new Date(record.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function creditColumns(
  partyKey: "customer" | "supplier",
  onSuccess: () => void
) {
  const sourceKey = partyKey === "customer" ? "sale" : "purchase";
  const sourceLabel = partyKey === "customer" ? "Sale" : "Purchase";
  const sourceHref = (r: CreditRecord) => {
    const id =
      partyKey === "customer"
        ? (r.saleId ?? r.sale?.id)
        : (r.purchaseId ?? r.purchase?.id);
    if (!id) return null;
    return partyKey === "customer" ? `/sales/${id}` : `/purchases/${id}`;
  };

  return [
    {
      key: "party",
      header: partyKey === "customer" ? "Customer" : "Supplier",
      cell: (r: CreditRecord) => {
        const party = partyKey === "customer" ? r.customer : r.supplier;
        if (!party?.name) return "—";
        return (
          <div className="min-w-0">
            <div className="font-medium text-[var(--frappe-text)]">
              {party.name}
            </div>
            {party.phone ? (
              <div className="text-xs text-[var(--frappe-text-muted)]">
                {party.phone}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: sourceKey,
      header: sourceLabel,
      cell: (r: CreditRecord) => {
        const href = sourceHref(r);
        const doc = partyKey === "customer" ? r.sale : r.purchase;
        if (!href) return "—";
        return (
          <Link
            href={href}
            className="font-medium text-[var(--frappe-primary)] hover:underline"
          >
            {doc?.createdAt ? formatDate(doc.createdAt) : href.split("/").pop()?.slice(0, 8) + "…"}
          </Link>
        );
      },
    },
    {
      key: "createdAt",
      header: "Credit date",
      cell: (r: CreditRecord) => formatDate(r.createdAt),
    },
    {
      key: "dueDate",
      header: "Due date",
      cell: (r: CreditRecord) => (
        <span
          className={cn(
            (r.isOverdue || isCreditOverdue(r)) &&
              "font-medium text-[var(--frappe-red)]"
          )}
        >
          {formatDate(r.dueDate)}
          {r.daysOverdue ? ` · ${r.daysOverdue}d overdue` : null}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Invoice",
      className: "text-right",
      cell: (r: CreditRecord) => formatMoney(r.amount),
    },
    {
      key: "paid",
      header: "Paid",
      className: "text-right",
      cell: (r: CreditRecord) => formatMoney(r.paidAmount),
    },
    {
      key: "balance",
      header: "Outstanding",
      className: "text-right",
      cell: (r: CreditRecord) => formatMoney(creditBalance(r)),
    },
    {
      key: "status",
      header: "Status",
      cell: (r: CreditRecord) => (
        <div className="flex flex-wrap items-center gap-1">
          {creditStatusBadge(r.status)}
          {partyKey === "customer" ? (
            <AgingStatusBadge risk={r.agingRisk} />
          ) : null}
          {r.isOverdue || isCreditOverdue(r) ? (
            <Badge className="border-transparent bg-destructive/15 text-destructive">
              Overdue
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "pay",
      header: "",
      cell: (r: CreditRecord) =>
        r.status === "PAID" ? null : (
          <PermissionGate permission="credit.write">
            <PaymentButton
              type={partyKey}
              credit={r}
              onSuccess={onSuccess}
            />
          </PermissionGate>
        ),
    },
  ];
}

export default function CreditsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CreditStatus | "">("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reminding, setReminding] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const customerList = usePaginatedList<CreditRecord, CreditListTotals>(
    (page, limit) =>
      buildCreditsCustomersListPath(
        {
          from: from || undefined,
          to: to || undefined,
          search: debouncedSearch || undefined,
          status: status || undefined,
          overdue: overdueOnly || undefined,
        },
        page,
        limit
      ),
    [from, to, debouncedSearch, status, overdueOnly]
  );
  const supplierList = usePaginatedList<CreditRecord, CreditListTotals>(
    (page, limit) =>
      buildCreditsSuppliersListPath(
        {
          from: from || undefined,
          to: to || undefined,
          search: debouncedSearch || undefined,
          status: status || undefined,
          overdue: overdueOnly || undefined,
        },
        page,
        limit
      ),
    [from, to, debouncedSearch, status, overdueOnly]
  );

  const { data: aging, reload: reloadAging } = useFetch(
    () => api<CreditAgingReport>("/credits/aging"),
    []
  );

  const reloadAll = () => {
    customerList.reload();
    supplierList.reload();
    void reloadAging();
  };

  async function sendReminders() {
    setReminding(true);
    try {
      const res = await api<{ sent: number }>("/credits/reminders", {
        method: "POST",
        body: {},
      });
      toast.success(`Sent ${res.sent} payment reminder${res.sent === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setReminding(false);
    }
  }

  return (
    <AppShell
      title="Credits"
      subtitle="Customer receivables & supplier payables — invoice, paid, outstanding"
      actions={
        <PermissionGate permission="credit.write">
          <Button
            variant="outline"
            disabled={reminding}
            onClick={() => void sendReminders()}
          >
            {reminding ? "Sending…" : "Send payment reminders"}
          </Button>
        </PermissionGate>
      }
    >
      <PermissionGate permission="credit.read">
        <CreditAnalysis aging={aging ?? null} />
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search credits..."
          />
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
          <Select
            value={status || "__all__"}
            onValueChange={(v) =>
              setStatus(v === "__all__" ? "" : (v as CreditStatus))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 rounded border border-[var(--frappe-border)] px-3 py-2">
            <Switch
              checked={overdueOnly}
              onCheckedChange={setOverdueOnly}
              id="overdue-only"
            />
            <Label htmlFor="overdue-only" className="text-sm">
              Overdue only
            </Label>
          </div>
        </FrappeFilterBar>
        <Tabs defaultValue="customers">
          <TabsList>
            <TabsTrigger value="customers">Customer credit</TabsTrigger>
            <TabsTrigger value="suppliers">Supplier payables</TabsTrigger>
            <TabsTrigger value="aging">Aging analysis</TabsTrigger>
          </TabsList>
          <TabsContent value="customers" className="mt-4">
            <FrappeListToolbar>
              <span className="text-[var(--frappe-text-muted)]">
                {customerList.meta.total} record
                {customerList.meta.total === 1 ? "" : "s"}
              </span>
              {customerList.totals ? (
                <ListPageTotals
                  items={[
                    {
                      label: "Invoice",
                      value: formatMoney(customerList.totals.amount),
                    },
                    {
                      label: "Paid",
                      value: formatMoney(customerList.totals.paidAmount),
                    },
                    {
                      label: "Outstanding",
                      value: formatMoney(customerList.totals.balance),
                    },
                  ]}
                />
              ) : null}
            </FrappeListToolbar>
            {customerList.loading ? (
              <PageLoading />
            ) : (
              <DataCardTable
                rows={customerList.rows}
                emptyTitle="No customer credits"
                pagination={{
                  meta: customerList.meta,
                  onPageChange: customerList.setPage,
                  onLimitChange: customerList.setLimit,
                  disabled: customerList.loading,
                }}
                columns={creditColumns("customer", reloadAll)}
              />
            )}
          </TabsContent>
          <TabsContent value="suppliers" className="mt-4">
            <FrappeListToolbar>
              <span className="text-[var(--frappe-text-muted)]">
                {supplierList.meta.total} record
                {supplierList.meta.total === 1 ? "" : "s"}
              </span>
              {supplierList.totals ? (
                <ListPageTotals
                  items={[
                    {
                      label: "Invoice",
                      value: formatMoney(supplierList.totals.amount),
                    },
                    {
                      label: "Paid",
                      value: formatMoney(supplierList.totals.paidAmount),
                    },
                    {
                      label: "Outstanding",
                      value: formatMoney(supplierList.totals.balance),
                    },
                  ]}
                />
              ) : null}
            </FrappeListToolbar>
            {supplierList.loading ? (
              <PageLoading />
            ) : (
              <DataCardTable
                rows={supplierList.rows}
                emptyTitle="No supplier credits"
                pagination={{
                  meta: supplierList.meta,
                  onPageChange: supplierList.setPage,
                  onLimitChange: supplierList.setLimit,
                  disabled: supplierList.loading,
                }}
                columns={creditColumns("supplier", reloadAll)}
              />
            )}
          </TabsContent>
          <TabsContent value="aging" className="mt-4 space-y-6">
            {!aging ? (
              <PageLoading />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <AgingPanel
                  title="Customer receivables aging"
                  side={aging.customers}
                />
                <AgingPanel
                  title="Supplier payables aging"
                  side={aging.suppliers}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PermissionGate>
    </AppShell>
  );
}

function moneyNumber(value?: string | null) {
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
}

function CreditAnalysis({ aging }: { aging: CreditAgingReport | null }) {
  if (!aging) {
    return (
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)]"
          />
        ))}
      </div>
    );
  }

  const receivables = moneyNumber(aging.customers.totalOutstanding);
  const payables = moneyNumber(aging.suppliers.totalOutstanding);
  const openCredits = aging.customers.buckets.reduce((sum, b) => sum + b.count, 0);
  const openBills = aging.suppliers.buckets.reduce((sum, b) => sum + b.count, 0);
  const current = aging.customers.buckets.find((b) => b.key === "d0_15");
  const watch = aging.customers.buckets.filter(
    (b) => b.risk && b.risk !== "Normal"
  );
  const watchBalance = watch.reduce((sum, b) => sum + moneyNumber(b.balance), 0);
  const watchCount = watch.reduce((sum, b) => sum + b.count, 0);
  const currentShare =
    receivables > 0 ? Math.round((moneyNumber(current?.balance) / receivables) * 100) : 0;

  return (
    <section className="mb-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AnalysisCard
          label="Customer receivables"
          value={formatMoney(aging.customers.totalOutstanding)}
          hint={
            openCredits === 1 ? "1 open credit" : `${openCredits} open credits`
          }
        />
        <AnalysisCard
          label="Supplier payables"
          value={formatMoney(aging.suppliers.totalOutstanding)}
          hint={openBills === 1 ? "1 open bill" : `${openBills} open bills`}
        />
        <AnalysisCard
          label="Still current"
          value={formatMoney(current?.balance ?? "0")}
          hint={
            receivables > 0
              ? `${currentShare}% of receivables · Normal, 0–15 days`
              : "No open customer credit"
          }
        />
        <AnalysisCard
          label="Needs attention"
          value={formatMoney(watchBalance)}
          hint={
            watchCount === 0
              ? "Nothing past 15 days"
              : watchCount === 1
                ? "1 credit past 15 days"
                : `${watchCount} credits past 15 days`
          }
          tone={watchBalance > 0 ? "watch" : "ok"}
        />
      </div>
      <p className="text-sm text-[var(--frappe-text-muted)]">
        {receivables <= 0
          ? "Customer credit is clear."
          : watchBalance <= 0
            ? "Every open customer credit is still inside the Normal 15-day window."
            : `${formatMoney(watchBalance)} of customer credit is past 15 days. ${formatMoney(payables)} is still owed to suppliers.`}
      </p>
    </section>
  );
}

function AnalysisCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "watch" | "ok";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 shadow-sm",
        tone === "watch"
          ? "border-[var(--csolve-honey)] bg-warning"
          : tone === "ok"
            ? "border-[var(--csolve-moss)] bg-[var(--csolve-moss-soft)]"
            : "border-[var(--frappe-border)] bg-[var(--frappe-surface)]"
      )}
    >
      <p className="text-sm text-[var(--frappe-text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--frappe-text)]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">{hint}</p>
    </div>
  );
}

function AgingPanel({
  title,
  side,
}: {
  title: string;
  side: CreditAgingReport["customers"];
}) {
  const total = moneyNumber(side.totalOutstanding);
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] shadow-sm">
      <div className="border-b border-[var(--frappe-border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--frappe-text)]">
          {title}
        </h3>
        <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
          Outstanding{" "}
          <span className="font-medium tabular-nums text-[var(--frappe-text)]">
            {formatMoney(side.totalOutstanding)}
          </span>
        </p>
      </div>
      <ul className="divide-y divide-[var(--frappe-border)]">
        {side.buckets.map((b) => {
          const balance = moneyNumber(b.balance);
          const share = total > 0 ? Math.round((balance / total) * 100) : 0;
          return (
            <li key={b.key} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--frappe-text)]">
                    {b.label}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <AgingStatusBadge risk={b.risk} />
                    <span className="text-xs text-[var(--frappe-text-muted)]">
                      {b.count === 1 ? "1 account" : `${b.count} accounts`}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatMoney(b.balance)}
                  </p>
                  <p className="text-xs tabular-nums text-[var(--frappe-text-muted)]">
                    {share}%
                  </p>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--frappe-section-head)]">
                <div
                  className={cn("h-full rounded-full", agingBarClass(b.risk))}
                  style={{ width: `${share}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function agingBarClass(risk?: string | null) {
  if (!risk) return "bg-[var(--frappe-primary)]";
  if (risk.includes("Highly") || risk.includes("High Risk")) return "bg-destructive";
  if (risk.includes("Attention")) return "bg-[var(--csolve-honey)]";
  return "bg-[var(--csolve-moss)]";
}

function PaymentButton({
  type,
  credit,
  onSuccess,
}: {
  type: "customer" | "supplier";
  credit: CreditRecord;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const outstanding = creditBalance(credit);
  const party =
    type === "customer" ? credit.customer?.name : credit.supplier?.name;
  const { data: banks } = useFetch(
    () => apiList<BankAccount>("/banks/accounts"),
    []
  );
  const historyPath =
    type === "customer"
      ? `/credits/customers/${credit.id}/payments`
      : `/credits/suppliers/${credit.id}/payments`;
  const { data: history } = useFetch(
    () =>
      open
        ? api<CreditPaymentHistoryItem[]>(historyPath)
        : Promise.resolve([] as CreditPaymentHistoryItem[]),
    [open, historyPath]
  );

  function handleOpen() {
    setAmount(outstanding);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(historyPath, {
        method: "POST",
        body: { amount: parseFloat(amount), bankAccountId },
      });
      toast.success("Payment recorded");
      setOpen(false);
      setAmount("");
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleOpen}>
        Pay
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setAmount("");
        }}
      >
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {party ? (
                <p className="text-sm text-[var(--frappe-text-muted)]">
                  {type === "customer" ? "Customer" : "Supplier"}:{" "}
                  <span className="font-medium text-[var(--frappe-text)]">
                    {party}
                  </span>
                </p>
              ) : null}
              <div className="rounded border border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-3 py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--frappe-text-muted)]">Invoice</span>
                  <span className="tabular-nums">{formatMoney(credit.amount)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--frappe-text-muted)]">Paid</span>
                  <span className="tabular-nums">
                    {formatMoney(credit.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 font-medium">
                  <span>Outstanding</span>
                  <span className="tabular-nums">{formatMoney(outstanding)}</span>
                </div>
                {credit.dueDate ? (
                  <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
                    Due {formatDate(credit.dueDate)}
                    {credit.isOverdue || isCreditOverdue(credit)
                      ? ` · ${credit.daysOverdue ?? ""}d overdue`
                      : null}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label>Partial / full payment amount</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  max={outstanding}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Bank account</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccountsForSelect(banks ?? [], bankAccountId).map(
                      (b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {formatBankAccountLabel(b)}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Payment history</Label>
                {!history?.length ? (
                  <p className="text-xs text-[var(--frappe-text-muted)]">
                    No payments recorded yet.
                  </p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                    {history.map((p) => (
                      <li
                        key={p.id}
                        className="flex justify-between gap-2 border-b border-[var(--frappe-border)] py-1"
                      >
                        <span>
                          {formatDate(p.date)}
                          {p.bankAccount?.name
                            ? ` · ${p.bankAccount.name}`
                            : ""}
                        </span>
                        <span className="tabular-nums font-medium">
                          {formatMoney(p.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving || !bankAccountId}>
                Submit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
