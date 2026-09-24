"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { SupplierDocumentsPanel } from "@/components/suppliers/supplier-documents-panel";
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
import { errorMessage, formatDate } from "@/lib/format";
import { supplierTypeLabel } from "@/lib/suppliers";
import type { Supplier } from "@/lib/types";
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

export default function SupplierProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [deleting, setDeleting] = useState(false);

  const {
    data: supplier,
    loading,
    error,
    reload,
  } = useFetch(
    () =>
      id
        ? api<Supplier>(`/suppliers/${id}`)
        : Promise.reject(new Error("Invalid supplier id")),
    [id]
  );

  async function handleDelete() {
    if (!supplier) return;
    setDeleting(true);
    try {
      await api(`/suppliers/${supplier.id}`, { method: "DELETE" });
      toast.success("Supplier deactivated");
      router.push("/suppliers");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function handleReactivate() {
    if (!supplier) return;
    try {
      await api(`/suppliers/${supplier.id}`, {
        method: "PATCH",
        body: { isActive: true },
      });
      toast.success("Supplier reactivated");
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const locationLine = [
    supplier?.kebele,
    supplier?.woreda,
    supplier?.zone,
    supplier?.region,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppShell
      title={loading ? "Supplier" : supplier?.name ?? "Supplier"}
      variant="form"
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: "Suppliers", href: "/suppliers" },
        { label: supplier?.name ?? (id ? id.slice(0, 8) : "…") },
      ]}
    >
      <PermissionGate permission="suppliers.read">
        {loading ? (
          <PageLoading />
        ) : error || !supplier ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Supplier not found
            </p>
            <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
              {error ?? "This record may have been removed."}
            </p>
            <FrappeButtonLink href="/suppliers" className="mt-4">
              Back to suppliers
            </FrappeButtonLink>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <FrappeButtonLink href="/suppliers">← Back to list</FrappeButtonLink>
              <Badge
                variant={supplier.isActive === false ? "secondary" : "outline"}
                className="ml-auto"
              >
                {supplier.isActive === false ? "Inactive" : "Active"}
              </Badge>
              <Badge variant="secondary">
                {supplierTypeLabel(supplier.supplierType)}
              </Badge>
              <PermissionGate permission="suppliers.write">
                <FrappeButtonPrimary asChild>
                  <Link href={`/suppliers/${supplier.id}/edit`}>Edit</Link>
                </FrappeButtonPrimary>
                {supplier.isActive === false ? (
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
                        <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
                        <AlertDialogDescription>
                          “{supplier.name}” will be marked inactive. Documents
                          and purchase history remain available.
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

            <FrappeDocument>
              <FrappeSection
                title="Identity"
                description={
                  supplier.organizationName
                    ? supplier.organizationName
                    : undefined
                }
              >
                <FrappeFormGrid columns={3}>
                  <DetailField label="Name" value={supplier.name} />
                  <DetailField
                    label="Type"
                    value={supplierTypeLabel(supplier.supplierType)}
                  />
                  <DetailField
                    label="Contact person"
                    value={dash(supplier.contactPerson)}
                  />
                  <DetailField
                    label="Organization"
                    value={dash(supplier.organizationName)}
                  />
                  <DetailField
                    label="Registered"
                    value={
                      supplier.createdAt
                        ? formatDate(supplier.createdAt)
                        : "—"
                    }
                  />
                </FrappeFormGrid>
              </FrappeSection>

              <FrappeSection title="Contact">
                <FrappeFormGrid columns={3}>
                  <DetailField label="Phone" value={dash(supplier.phone)} />
                  <DetailField
                    label="Alternate phone"
                    value={dash(supplier.alternatePhone)}
                  />
                  <DetailField label="Email" value={dash(supplier.email)} />
                </FrappeFormGrid>
              </FrappeSection>

              <FrappeSection title="Location">
                <FrappeFormGrid columns={2}>
                  <DetailField
                    label="Address"
                    value={dash(supplier.address)}
                  />
                  <DetailField
                    label="Admin. location"
                    value={locationLine || "—"}
                  />
                  <DetailField label="Region" value={dash(supplier.region)} />
                  <DetailField label="Zone" value={dash(supplier.zone)} />
                  <DetailField label="Woreda" value={dash(supplier.woreda)} />
                  <DetailField label="Kebele" value={dash(supplier.kebele)} />
                </FrappeFormGrid>
              </FrappeSection>

              <FrappeSection title="License details">
                <FrappeFormGrid columns={3}>
                  <DetailField label="TIN" value={dash(supplier.tinNumber)} />
                  <DetailField
                    label="License number"
                    value={dash(supplier.licenseNumber)}
                  />
                  <DetailField
                    label="License expiry"
                    value={
                      supplier.licenseExpiry
                        ? formatDate(supplier.licenseExpiry)
                        : "—"
                    }
                  />
                </FrappeFormGrid>
              </FrappeSection>

              <FrappeSection title="Bank / payment">
                {(supplier.bankAccounts?.length ?? 0) === 0 ? (
                  <p className="text-sm text-[var(--frappe-text-muted)]">
                    No bank accounts on file.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {supplier.bankAccounts!.map((acct, i) => (
                      <div
                        key={acct.id}
                        className="rounded border border-[var(--frappe-border)] p-3"
                      >
                        <p className="mb-2 text-xs font-medium text-[var(--frappe-text-muted)]">
                          Account {i + 1}
                        </p>
                        <FrappeFormGrid columns={3}>
                          <DetailField
                            label="Bank name"
                            value={dash(acct.bankName)}
                          />
                          <DetailField
                            label="Account holder name"
                            value={dash(acct.accountHolderName)}
                          />
                          <DetailField
                            label="Account number"
                            value={dash(acct.accountNumber)}
                          />
                        </FrappeFormGrid>
                      </div>
                    ))}
                  </div>
                )}
              </FrappeSection>

              {supplier.notes?.trim() ? (
                <FrappeSection title="Notes">
                  <DetailField label="Internal notes" value={supplier.notes} />
                </FrappeSection>
              ) : null}

              <FrappeSection
                title="License & Documents"
                description="View and manage stored files. Upload or replace from Edit."
              >
                <SupplierDocumentsPanel
                  supplierId={supplier.id}
                  documents={supplier.documents ?? []}
                  onChanged={() => void reload()}
                />
              </FrappeSection>
            </FrappeDocument>
          </div>
        )}
      </PermissionGate>
    </AppShell>
  );
}
