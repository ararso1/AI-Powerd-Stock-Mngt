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
  CreditListTotals,
  CreditRecord,
  CreditStatus,
} from "@/lib/types";
import { ListPageTotals } from "@/components/shared/list-page-totals";
import { useFetch } from "@/hooks/use-fetch";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function creditStatusBadge(status: CreditStatus) {
  const variant =
    status === "PAID"
      ? "secondary"
      : status === "PARTIAL"
        ? "outline"
        : "destructive";
  return <Badge variant={variant}>{status}</Badge>;
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
            isCreditOverdue(r) && "font-medium text-[var(--frappe-red)]"
          )}
        >
          {formatDate(r.dueDate)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
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
      header: "Balance",
      className: "text-right",
      cell: (r: CreditRecord) => formatMoney(creditBalance(r)),
    },
    {
      key: "status",
      header: "Status",
      cell: (r: CreditRecord) => creditStatusBadge(r.status),
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const customerList = usePaginatedList<CreditRecord, CreditListTotals>(
    (page, limit) =>
      buildCreditsCustomersListPath(
        {
          from: from || undefined,
          to: to || undefined,
          search: debouncedSearch || undefined,
          status: status || undefined,
        },
        page,
        limit
      ),
    [from, to, debouncedSearch, status]
  );
  const supplierList = usePaginatedList<CreditRecord, CreditListTotals>(
    (page, limit) =>
      buildCreditsSuppliersListPath(
        {
          from: from || undefined,
          to: to || undefined,
          search: debouncedSearch || undefined,
          status: status || undefined,
        },
        page,
        limit
      ),
    [from, to, debouncedSearch, status]
  );

  const reloadAll = () => {
    customerList.reload();
    supplierList.reload();
  };

  return (
    <AppShell title="Credits">
      <PermissionGate permission="credit.read">
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
        </FrappeFilterBar>
        <Tabs defaultValue="customers">
          <TabsList>
            <TabsTrigger value="customers">Customer credit</TabsTrigger>
            <TabsTrigger value="suppliers">Supplier credit</TabsTrigger>
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
                      label: "Amount",
                      value: formatMoney(customerList.totals.amount),
                    },
                    {
                      label: "Paid",
                      value: formatMoney(customerList.totals.paidAmount),
                    },
                    {
                      label: "Balance",
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
                      label: "Amount",
                      value: formatMoney(supplierList.totals.amount),
                    },
                    {
                      label: "Paid",
                      value: formatMoney(supplierList.totals.paidAmount),
                    },
                    {
                      label: "Balance",
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
        </Tabs>
      </PermissionGate>
    </AppShell>
  );
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

  function handleOpen() {
    setAmount(outstanding);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const path =
        type === "customer"
          ? `/credits/customers/${credit.id}/payments`
          : `/credits/suppliers/${credit.id}/payments`;
      await api(path, {
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
        <DialogContent>
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
              <p className="text-sm text-[var(--frappe-text-muted)]">
                Outstanding balance:{" "}
                <span className="font-medium tabular-nums text-[var(--frappe-text)]">
                  {formatMoney(outstanding)}
                </span>
                {credit.dueDate ? (
                  <>
                    {" "}
                    · Due {formatDate(credit.dueDate)}
                  </>
                ) : null}
              </p>
              <div className="grid gap-2">
                <Label>Amount</Label>
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
