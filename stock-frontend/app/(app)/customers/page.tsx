"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeButtonPrimary,
  FrappeFilterBar,
  FrappeListToolbar,
} from "@/components/frappe";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { buildListPath } from "@/lib/list-query";
import { errorMessage, formatMoney } from "@/lib/format";
import { customerTypeLabel } from "@/lib/customers";
import type { Customer } from "@/lib/types";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";

function DeleteCustomerButton({
  customer,
  onSuccess,
}: {
  customer: Customer;
  onSuccess: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api(`/customers/${customer.id}`, { method: "DELETE" });
      toast.success(`${customer.name} deactivated`);
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={deleting || customer.isActive === false}
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete customer?</AlertDialogTitle>
          <AlertDialogDescription>
            “{customer.name}” will be marked inactive. Sales and credit history
            are preserved.
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
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "all">("active");
  const debouncedSearch = useDebouncedValue(search);

  const { rows, meta, setPage, setLimit, loading, reload } =
    usePaginatedList<Customer>(
      (page, limit) =>
        buildListPath("/customers", {
          params: {
            search: debouncedSearch || undefined,
            includeInactive: status === "all" ? true : undefined,
          },
          page,
          limit,
        }),
      [debouncedSearch, status]
    );

  return (
    <AppShell
      title="Customers"
      subtitle="Profiles, credit limits, and receivables linked to sales"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Customers" },
      ]}
      actions={
        <PermissionGate permission="customers.write">
          <FrappeButtonPrimary asChild>
            <Link href="/customers/new">
              <PlusIcon className="size-3.5" />
              New customer
            </Link>
          </FrappeButtonPrimary>
        </PermissionGate>
      }
    >
      <PermissionGate permission="customers.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search name, phone, TIN…"
          />
          <div className="grid gap-2">
            <Label className="text-sm text-[var(--frappe-text-muted)]">
              Status
            </Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "active" | "all")}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="all">Include inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FrappeFilterBar>
        <FrappeListToolbar>
          <span className="text-[var(--frappe-text-muted)]">
            {meta.total} record{meta.total === 1 ? "" : "s"}
          </span>
        </FrappeListToolbar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="No customers yet"
            emptyDescription="Register buyers for local and wholesale sales."
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={[
              {
                key: "name",
                header: "Name",
                cell: (r) => (
                  <div>
                    <Link
                      href={`/customers/${r.id}`}
                      className="font-medium text-[var(--frappe-primary)] hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.organizationName && r.organizationName !== r.name ? (
                      <p className="text-xs text-[var(--frappe-text-muted)]">
                        {r.organizationName}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "type",
                header: "Type",
                cell: (r) => customerTypeLabel(r.customerType),
              },
              {
                key: "contact",
                header: "Contact",
                cell: (r) => (
                  <div className="text-sm">
                    <p>{r.contactPerson || "—"}</p>
                    <p className="text-xs text-[var(--frappe-text-muted)]">
                      {r.phone || r.email || "—"}
                    </p>
                  </div>
                ),
              },
              {
                key: "creditLimit",
                header: "Credit limit",
                cell: (r) =>
                  r.creditLimit != null && r.creditLimit !== ""
                    ? formatMoney(r.creditLimit)
                    : "Not set",
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
                  <PermissionGate permission="customers.write">
                    <DeleteCustomerButton customer={r} onSuccess={reload} />
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
