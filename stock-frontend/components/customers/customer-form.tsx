"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FrappeButtonLink,
  FrappeButtonPrimary,
  FrappeButtonSecondary,
  FrappeDocument,
  FrappeField,
  FrappeFormGrid,
  FrappeFormToolbar,
  FrappeSection,
} from "@/components/frappe";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import {
  buildCustomerCreateBody,
  buildCustomerUpdateBody,
  emptyCustomerForm,
  customerFormFromRecord,
  customerTypeSelectOptions,
  formatFileSize,
  uploadCustomerDocument,
  type CustomerFormValues,
} from "@/lib/customers";
import type { Customer, CustomerDocument } from "@/lib/types";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";

type AgreementDraft = {
  key: string;
  title: string;
  file: File | null;
};

export function CustomerForm({
  customer,
  onSaved,
}: {
  customer?: Customer;
  onSaved?: (c: Customer) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(customer);
  const [values, setValues] = useState<CustomerFormValues>(() =>
    customer ? customerFormFromRecord(customer) : emptyCustomerForm()
  );
  const [saving, setSaving] = useState(false);
  const [agreementDrafts, setAgreementDrafts] = useState<AgreementDraft[]>(() =>
    customer?.customerType === "AGENT"
      ? [{ key: "initial", title: "", file: null }]
      : []
  );
  const [removedDocIds, setRemovedDocIds] = useState<string[]>([]);

  const existingAgreements = (customer?.documents ?? []).filter(
    (d) =>
      d.kind === "AGENT_AGREEMENT" && !removedDocIds.includes(d.id)
  );

  const isAgent = values.customerType === "AGENT";

  function setField<K extends keyof CustomerFormValues>(
    key: K,
    value: CustomerFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function addAgreementDraft() {
    setAgreementDrafts((rows) => [
      ...rows,
      { key: `${Date.now()}-${rows.length}`, title: "", file: null },
    ]);
  }

  function updateAgreementDraft(
    key: string,
    patch: Partial<Pick<AgreementDraft, "title" | "file">>
  ) {
    setAgreementDrafts((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  function removeAgreementDraft(key: string) {
    setAgreementDrafts((rows) => rows.filter((r) => r.key !== key));
  }

  async function syncDocuments(customerId: string) {
    const jobs: Promise<unknown>[] = [];
    for (const row of agreementDrafts) {
      if (!row.file) continue;
      jobs.push(
        uploadCustomerDocument(
          customerId,
          "AGENT_AGREEMENT",
          row.file,
          row.title.trim() || undefined
        )
      );
    }
    for (const id of removedDocIds) {
      jobs.push(
        api(`/customers/${customerId}/documents/${id}`, { method: "DELETE" })
      );
    }
    await Promise.all(jobs);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (isAgent) {
      for (const row of agreementDrafts) {
        if (row.title.trim() && !row.file) {
          toast.error(`Choose a file for “${row.title.trim()}”`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const saved = isEdit
        ? await api<Customer>(`/customers/${customer!.id}`, {
            method: "PATCH",
            body: buildCustomerUpdateBody(values),
          })
        : await api<Customer>("/customers", {
            method: "POST",
            body: buildCustomerCreateBody(values),
          });

      if (isAgent || removedDocIds.length) {
        await syncDocuments(saved.id);
      }

      const refreshed = await api<Customer>(`/customers/${saved.id}`);
      toast.success(isEdit ? "Customer updated" : "Customer created");
      onSaved?.(refreshed);
      router.push(`/customers/${refreshed.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-4">
      <FrappeFormToolbar>
        <FrappeButtonLink
          href={customer ? `/customers/${customer.id}` : "/customers"}
        >
          Cancel
        </FrappeButtonLink>
        <FrappeButtonPrimary type="submit" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create customer"}
        </FrappeButtonPrimary>
      </FrappeFormToolbar>

      <FrappeDocument>
        <FrappeSection title="Identity" description="Who this customer is">
          <FrappeFormGrid columns={2}>
            <FrappeField label="Customer name" required>
              <Input
                value={values.name}
                onChange={(e) => setField("name", e.target.value)}
                required
                autoFocus={!isEdit}
              />
            </FrappeField>
            <FrappeField label="Customer type">
              <Select
                value={values.customerType}
                onValueChange={(v) => {
                  const next = v as CustomerFormValues["customerType"];
                  setField("customerType", next);
                  if (next === "AGENT") {
                    setAgreementDrafts((rows) =>
                      rows.length
                        ? rows
                        : [{ key: `${Date.now()}`, title: "", file: null }]
                    );
                  } else {
                    setAgreementDrafts([]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {customerTypeSelectOptions(values.customerType).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FrappeField>
            <FrappeField label="Contact person">
              <Input
                value={values.contactPerson}
                onChange={(e) => setField("contactPerson", e.target.value)}
              />
            </FrappeField>
            <FrappeField label="Organization / trade name">
              <Input
                value={values.organizationName}
                onChange={(e) => setField("organizationName", e.target.value)}
              />
            </FrappeField>
            <FrappeField label="TIN number">
              <Input
                value={values.tinNumber}
                onChange={(e) => setField("tinNumber", e.target.value)}
              />
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>

        <FrappeSection title="Contact">
          <FrappeFormGrid columns={2}>
            <FrappeField label="Phone">
              <Input
                value={values.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </FrappeField>
            <FrappeField label="Alternate phone">
              <Input
                value={values.alternatePhone}
                onChange={(e) => setField("alternatePhone", e.target.value)}
              />
            </FrappeField>
            <FrappeField label="Email" fullWidth>
              <Input
                type="email"
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>

        <FrappeSection title="Location">
          <FrappeFormGrid columns={2}>
            <FrappeField label="Address" fullWidth>
              <Textarea
                value={values.address}
                onChange={(e) => setField("address", e.target.value)}
                rows={2}
              />
            </FrappeField>
            <FrappeField label="City">
              <Input
                value={values.city}
                onChange={(e) => setField("city", e.target.value)}
              />
            </FrappeField>
            <FrappeField label="Region">
              <Input
                value={values.region}
                onChange={(e) => setField("region", e.target.value)}
              />
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>

        <FrappeSection
          title="Credit limit"
          description="Required for credit sales. Additional credit sales are blocked when outstanding reaches this limit."
        >
          <FrappeFormGrid columns={2}>
            <FrappeField
              label="Credit limit (ETB)"
              hint="Leave empty to disallow credit sales until a limit is set"
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                value={values.creditLimit}
                onChange={(e) => setField("creditLimit", e.target.value)}
                placeholder="e.g. 500000"
              />
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>

        {isAgent ? (
          <FrappeSection
            title="Agent agreement documents"
            description="Upload signed agent agreement files (PDF or image, max 10MB each)"
          >
            {existingAgreements.length > 0 ? (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
                  Existing documents
                </p>
                {existingAgreements.map((doc: CustomerDocument) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center gap-2 rounded border border-[var(--frappe-border)] px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--frappe-text)]">
                        {doc.title || doc.originalName}
                      </p>
                      <p className="text-[11px] text-[var(--frappe-text-muted)]">
                        {doc.originalName} · {formatFileSize(doc.sizeBytes)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() =>
                        setRemovedDocIds((ids) => [...ids, doc.id])
                      }
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-3">
              {agreementDrafts.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-2 rounded border border-[var(--frappe-border)] p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <FrappeField label="Document label">
                    <Input
                      value={row.title}
                      onChange={(e) =>
                        updateAgreementDraft(row.key, {
                          title: e.target.value,
                        })
                      }
                      placeholder="e.g. Agent agreement 2026"
                    />
                  </FrappeField>
                  <FrappeField label="File">
                    <Input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) =>
                        updateAgreementDraft(row.key, {
                          file: e.target.files?.[0] ?? null,
                        })
                      }
                    />
                    {row.file ? (
                      <p className="mt-1 text-[11px] text-[var(--frappe-text-muted)]">
                        Selected: {row.file.name}
                      </p>
                    ) : null}
                  </FrappeField>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeAgreementDraft(row.key)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={addAgreementDraft}
            >
              <PlusIcon className="mr-1 size-3.5" />
              Add agreement document
            </Button>
          </FrappeSection>
        ) : null}

        <FrappeSection title="Notes">
          <FrappeFormGrid columns={1}>
            <FrappeField label="Internal notes">
              <Textarea
                value={values.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
              />
            </FrappeField>
            {isEdit ? (
              <div className="flex items-center gap-2">
                <Switch
                  id="customer-active"
                  checked={values.isActive}
                  onCheckedChange={(checked) => setField("isActive", checked)}
                />
                <Label htmlFor="customer-active">Active customer</Label>
              </div>
            ) : null}
          </FrappeFormGrid>
        </FrappeSection>
      </FrappeDocument>

      {isEdit ? (
        <div className="flex justify-end">
          <FrappeButtonSecondary
            type="button"
            onClick={() => router.push(`/customers/${customer!.id}`)}
          >
            Back to profile
          </FrappeButtonSecondary>
        </div>
      ) : null}
    </form>
  );
}
