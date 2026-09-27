"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeButtonLink,
  FrappeButtonPrimary,
  FrappeButtonSecondary,
  FrappeDocument,
  FrappeFormGrid,
  FrappeSection,
} from "@/components/frappe";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { errorMessage, formatDate, formatMoney } from "@/lib/format";
import {
  agingRiskBadgeVariant,
  customerTypeLabel,
} from "@/lib/customers";
import { CustomerDocumentsPanel } from "@/components/customers/customer-documents-panel";
import type { Customer } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { toast } from "sonner";

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
        {label}
      </p>
      <p className="text-sm text-[var(--frappe-text)] whitespace-pre-wrap">
        {value ?? "—"}
      </p>
    </div>
  );
}

function dash(value?: string | null) {
  const t = value?.trim();
  return t || "—";
}

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [deleting, setDeleting] = useState(false);

  const {
    data: customer,
    loading,
    error,
    reload,
  } = useFetch(
    () =>
      id
        ? api<Customer>(`/customers/${id}/profile`)
        : Promise.reject(new Error("Invalid customer id")),
    [id]
  );

  const credit = customer?.credit;

  async function handleDelete() {
    if (!customer) return;
    setDeleting(true);
    try {
      await api(`/customers/${customer.id}`, { method: "DELETE" });
      toast.success("Customer deactivated");
      router.push("/customers");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function handleReactivate() {
    if (!customer) return;
    try {
      await api(`/customers/${customer.id}`, {
        method: "PATCH",
        body: { isActive: true },
      });
      toast.success("Customer reactivated");
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <AppShell
      title={loading ? "Customer" : customer?.name ?? "Customer"}
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Customers", href: "/customers" },
        { label: customer?.name ?? (id ? id.slice(0, 8) : "…") },
      ]}
    >
      <PermissionGate permission="customers.read">
        {loading ? (
          <PageLoading />
        ) : error || !customer ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Customer not found
            </p>
            <FrappeButtonLink href="/customers" className="mt-4">
              Back to customers
            </FrappeButtonLink>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <FrappeButtonLink href="/customers">← Back to list</FrappeButtonLink>
              <Badge
                variant={customer.isActive === false ? "secondary" : "outline"}
                className="ml-auto"
              >
                {customer.isActive === false ? "Inactive" : "Active"}
              </Badge>
              <Badge variant="secondary">
                {customerTypeLabel(customer.customerType)}
              </Badge>
              <PermissionGate permission="customers.write">
                <FrappeButtonPrimary asChild>
                  <Link href={`/customers/${customer.id}/edit`}>Edit</Link>
                </FrappeButtonPrimary>
                {customer.isActive === false ? (
                  <FrappeButtonSecondary
                    type="button"
                    onClick={() => void handleReactivate()}
                  >
                    Reactivate
                  </FrappeButtonSecondary>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <FrappeButtonSecondary type="button">
                        Delete
                      </FrappeButtonSecondary>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete customer?</AlertDialogTitle>
                        <AlertDialogDescription>
                          “{customer.name}” will be marked inactive. Credit and
                          sales history remain available.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={deleting}
                          onClick={() => void handleDelete()}
                        >
                          {deleting ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </PermissionGate>
            </div>

            {credit?.alerts &&
            (credit.alerts.highlyCriticalCount > 0 ||
              credit.alerts.overdueCount > 0) ? (
              <div className="space-y-2 rounded border border-[var(--frappe-red)]/40 bg-[var(--frappe-red)]/5 p-3">
                {credit.alerts.highlyCriticalCount > 0 ? (
                  <p className="text-sm text-[var(--frappe-text)]">
                    <span className="font-semibold">Highly critical:</span>{" "}
                    {credit.alerts.highlyCriticalCount} open credit
                    {credit.alerts.highlyCriticalCount === 1 ? "" : "s"} aged
                    60+ days ({formatMoney(credit.alerts.highlyCriticalBalance)}
                    ).
                  </p>
                ) : null}
                {credit.alerts.overdueCount > 0 ? (
                  <p className="text-sm text-[var(--frappe-text)]">
                    <span className="font-semibold">Past due date:</span>{" "}
                    {credit.alerts.overdueCount} open credit
                    {credit.alerts.overdueCount === 1 ? "" : "s"}.
                  </p>
                ) : null}
                <Link
                  href="/credits?overdue=1"
                  className="text-xs font-medium text-[var(--frappe-primary)] hover:underline"
                >
                  Open credits desk →
                </Link>
              </div>
            ) : null}

            <FrappeDocument>
              <FrappeSection title="Identity">
                <FrappeFormGrid columns={3}>
                  <DetailField label="Name" value={customer.name} />
                  <DetailField
                    label="Type"
                    value={customerTypeLabel(customer.customerType)}
                  />
                  <DetailField
                    label="Contact person"
                    value={dash(customer.contactPerson)}
                  />
                  <DetailField
                    label="Organization"
                    value={dash(customer.organizationName)}
                  />
                  <DetailField label="TIN" value={dash(customer.tinNumber)} />
                </FrappeFormGrid>
              </FrappeSection>

              <FrappeSection title="Contact & location">
                <FrappeFormGrid columns={3}>
                  <DetailField label="Phone" value={dash(customer.phone)} />
                  <DetailField
                    label="Alternate phone"
                    value={dash(customer.alternatePhone)}
                  />
                  <DetailField label="Email" value={dash(customer.email)} />
                  <DetailField label="Address" value={dash(customer.address)} />
                  <DetailField label="City" value={dash(customer.city)} />
                  <DetailField label="Region" value={dash(customer.region)} />
                </FrappeFormGrid>
              </FrappeSection>

              {customer.customerType === "AGENT" ? (
                <FrappeSection
                  title="Agent agreement documents"
                  description="View-only; upload from Edit customer"
                >
                  <CustomerDocumentsPanel
                    customerId={customer.id}
                    documents={customer.documents ?? []}
                    readOnly
                    onChanged={() => void reload()}
                  />
                </FrappeSection>
              ) : null}

              <FrappeSection
                title="Credit account"
                description="Synced from credit sales and payments"
              >
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded border border-[var(--frappe-border)] p-3">
                    <p className="text-xs text-[var(--frappe-text-muted)]">
                      Credit limit
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {credit?.creditLimit != null
                        ? formatMoney(credit.creditLimit)
                        : "Not set"}
                    </p>
                  </div>
                  <div className="rounded border border-[var(--frappe-border)] p-3">
                    <p className="text-xs text-[var(--frappe-text-muted)]">
                      Outstanding
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {formatMoney(credit?.outstanding ?? "0")}
                    </p>
                  </div>
                  <div className="rounded border border-[var(--frappe-border)] p-3">
                    <p className="text-xs text-[var(--frappe-text-muted)]">
                      Available credit
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {credit?.availableCredit != null
                        ? formatMoney(credit.availableCredit)
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded border border-[var(--frappe-border)] p-3">
                    <p className="text-xs text-[var(--frappe-text-muted)]">
                      Past due
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {formatMoney(credit?.overdue ?? "0")}
                    </p>
                  </div>
                </div>
                {credit ? (
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded border border-[var(--frappe-border)] p-3">
                      <p className="text-xs text-[var(--frappe-text-muted)]">
                        Repayment score
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {credit.creditScore != null
                          ? `${credit.creditScore} / 100`
                          : "—"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
                        {credit.creditScore == null
                          ? "Shown after a credit is fully repaid"
                          : "Average of repaid credits"}
                      </p>
                    </div>
                    <div className="rounded border border-[var(--frappe-border)] p-3">
                      <p className="text-xs text-[var(--frappe-text-muted)]">
                        Aging status
                      </p>
                      <div className="mt-1">
                        <Badge
                          variant={agingRiskBadgeVariant(credit.agingStatus)}
                        >
                          {credit.agingStatus ?? "Clear"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
                        {credit.agingDays != null
                          ? `${credit.agingLabel ?? ""} · ${credit.agingDays} days`
                          : "No open credit"}
                      </p>
                    </div>
                    <div className="rounded border border-[var(--frappe-border)] p-3">
                      <p className="text-xs text-[var(--frappe-text-muted)]">
                        Initial credit limit
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {credit.initialCreditLimit != null
                          ? formatMoney(credit.initialCreditLimit)
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded border border-[var(--frappe-border)] p-3">
                      <p className="text-xs text-[var(--frappe-text-muted)]">
                        Eligible limit increase
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {credit.eligibleIncrease != null
                          ? formatMoney(credit.eligibleIncrease)
                          : "—"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
                        {credit.eligibleIncreasePercent != null
                          ? credit.eligibleIncreasePercent > 0
                            ? `${credit.eligibleIncreasePercent}% of the initial limit if repaid now`
                            : "Past 30 days — no increase"
                          : credit.normalIncrease
                            ? `Normal 15 days +${formatMoney(credit.normalIncrease)} · Attention 30 days +${formatMoney(credit.attentionIncrease ?? 0)}`
                            : "Set a credit limit to enable increases"}
                      </p>
                    </div>
                  </div>
                ) : null}
                {credit?.lastLimitIncreasePercent != null &&
                parseFloat(credit.lastLimitIncrease ?? "0") > 0 ? (
                  <p className="mb-3 text-sm text-[var(--frappe-text-muted)]">
                    Last repayment in {credit.lastRepaymentDays ?? "—"} days
                    {credit.lastRepaymentRisk
                      ? ` (${credit.lastRepaymentRisk})`
                      : ""}{" "}
                    raised the limit by {credit.lastLimitIncreasePercent}% (
                    {formatMoney(credit.lastLimitIncrease ?? 0)}).
                  </p>
                ) : null}
                {credit?.overLimit ? (
                  <p className="mb-3 text-sm text-[var(--frappe-red)]">
                    Outstanding exceeds the configured credit limit. New credit
                    sales are blocked.
                  </p>
                ) : null}
                {!credit?.creditLimit ? (
                  <p className="mb-3 text-sm text-[var(--frappe-text-muted)]">
                    Set a credit limit on Edit before recording credit sales.
                  </p>
                ) : null}

                {credit?.aging?.buckets?.length ? (
                  <div className="mb-4 overflow-x-auto">
                    <p className="mb-2 text-xs font-medium text-[var(--frappe-text-muted)]">
                      Aging (from original sale / credit date)
                    </p>
                    <table className="frappe-list-table w-full">
                      <thead>
                        <tr>
                          <th>Bucket</th>
                          <th>Risk</th>
                          <th className="text-right">Count</th>
                          <th className="text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credit.aging.buckets.map((b) => (
                          <tr key={b.key}>
                            <td>{b.label}</td>
                            <td>
                              <Badge variant={agingRiskBadgeVariant(b.risk)}>
                                {b.risk ?? "—"}
                              </Badge>
                            </td>
                            <td className="text-right tabular-nums">
                              {b.count}
                            </td>
                            <td className="text-right tabular-nums">
                              {formatMoney(b.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <p className="mb-2 text-xs font-medium text-[var(--frappe-text-muted)]">
                  Open credit from sales
                </p>
                {(credit?.openCredits?.length ?? 0) === 0 ? (
                  <p className="text-sm text-[var(--frappe-text-muted)]">
                    No open credit balances.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="frappe-list-table w-full">
                      <thead>
                        <tr>
                          <th>Sale / credit date</th>
                          <th>Due</th>
                          <th>Aging</th>
                          <th className="text-right">Balance</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credit!.openCredits!.map((c) => (
                          <tr key={c.id}>
                            <td>
                              {c.saleId ? (
                                <Link
                                  href={`/sales/${c.saleId}`}
                                  className="text-[var(--frappe-primary)] hover:underline"
                                >
                                  {formatDate(
                                    c.saleDate ?? c.createdAt ?? ""
                                  )}
                                </Link>
                              ) : (
                                formatDate(c.createdAt ?? "")
                              )}
                            </td>
                            <td>
                              {c.dueDate ? formatDate(c.dueDate) : "—"}
                              {c.isOverdue ? (
                                <Badge
                                  variant="destructive"
                                  className="ml-2"
                                >
                                  Overdue
                                  {c.daysOverdue != null
                                    ? ` ${c.daysOverdue}d`
                                    : ""}
                                </Badge>
                              ) : null}
                            </td>
                            <td>
                              <Badge
                                variant={agingRiskBadgeVariant(c.agingRisk)}
                              >
                                {c.agingRisk ?? c.agingLabel ?? "—"}
                                {c.agingDays != null
                                  ? ` · ${c.agingDays}d`
                                  : ""}
                              </Badge>
                            </td>
                            <td className="text-right tabular-nums">
                              {formatMoney(c.balance)}
                            </td>
                            <td>{c.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </FrappeSection>

              <FrappeSection title="Payment history">
                {(credit?.payments?.length ?? 0) === 0 ? (
                  <p className="text-sm text-[var(--frappe-text-muted)]">
                    No credit payments recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="frappe-list-table w-full">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Bank</th>
                          <th className="text-right">Amount</th>
                          <th>Sale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credit!.payments!.map((p) => (
                          <tr key={p.id}>
                            <td>{formatDate(p.date)}</td>
                            <td>{p.bankAccount?.name ?? "—"}</td>
                            <td className="text-right tabular-nums">
                              {formatMoney(p.amount)}
                            </td>
                            <td>
                              {p.saleId ? (
                                <Link
                                  href={`/sales/${p.saleId}`}
                                  className="text-[var(--frappe-primary)] hover:underline"
                                >
                                  View sale
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </FrappeSection>

              {customer.notes?.trim() ? (
                <FrappeSection title="Notes">
                  <DetailField label="Internal notes" value={customer.notes} />
                </FrappeSection>
              ) : null}
            </FrappeDocument>
          </div>
        )}
      </PermissionGate>
    </AppShell>
  );
}
