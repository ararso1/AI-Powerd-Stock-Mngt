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
import { errorMessage } from "@/lib/format";
import { supplierTypeLabel } from "@/lib/suppliers";
import type { Supplier } from "@/lib/types";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";

function DeleteSupplierButton({
  supplier,
  onSuccess,
}: {
  supplier: Supplier;
  onSuccess: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api(`/suppliers/${supplier.id}`, { method: "DELETE" });
      toast.success(`${supplier.name} deactivated`);
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
          disabled={deleting || supplier.isActive === false}
          title={
            supplier.isActive === false
              ? "Already inactive"
              : "Deactivate supplier"
          }
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
          <AlertDialogDescription>
            “{supplier.name}” will be marked inactive and hidden from default
            lists. Purchase history is preserved. You can reactivate from the
            profile later.
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

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "all">("active");
  const debouncedSearch = useDebouncedValue(search);

  const { rows, meta, setPage, setLimit, loading, reload } =
    usePaginatedList<Supplier>(
      (page, limit) =>
        buildListPath("/suppliers", {
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
      title="Suppliers"
      subtitle="Coffee procurement partners and documentation"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Suppliers" },
      ]}
      actions={
        <PermissionGate permission="suppliers.write">
          <FrappeButtonPrimary asChild>
            <Link href="/suppliers/new">
              <PlusIcon className="size-3.5" />
              New supplier
            </Link>
          </FrappeButtonPrimary>
        </PermissionGate>
      }
    >
      <PermissionGate permission="suppliers.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search name, phone, TIN, organization…"
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
            emptyTitle="No suppliers yet"
            emptyDescription="Register farmers, cooperatives, and traders for coffee procurement."
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
                      href={`/suppliers/${r.id}`}
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
                cell: (r) => supplierTypeLabel(r.supplierType),
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
                key: "location",
                header: "Location",
                cell: (r) => {
                  const parts = [r.woreda, r.zone, r.region].filter(Boolean);
                  return parts.length ? parts.join(", ") : r.address || "—";
                },
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
                  <PermissionGate permission="suppliers.write">
                    <DeleteSupplierButton supplier={r} onSuccess={reload} />
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
