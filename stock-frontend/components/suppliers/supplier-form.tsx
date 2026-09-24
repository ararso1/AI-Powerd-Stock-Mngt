"use client";

import { useId, useState } from "react";
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
import { api, apiBlob } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import {
  SUPPLIER_TYPE_OPTIONS,
  buildSupplierCreateBody,
  buildSupplierUpdateBody,
  emptyBankAccountRow,
  emptySupplierForm,
  supplierFormFromRecord,
  uploadSupplierDocument,
  type SupplierFormValues,
} from "@/lib/suppliers";
import type { Supplier, SupplierDocument, SupplierDocumentKind } from "@/lib/types";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";

const ACCEPT_DOC =
  "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf";
const ACCEPT_AGREEMENT = "application/pdf,.pdf";

type ExtraDocDraft = { key: string; title: string; file: File | null };

function ViewExistingLink({ doc }: { doc: SupplierDocument }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="text-xs font-medium text-[var(--frappe-primary)] hover:underline disabled:opacity-50"
      onClick={() => {
        setBusy(true);
        void apiBlob(doc.downloadPath)
          .then(({ blob }) => {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
          })
          .catch((err) => toast.error(errorMessage(err)))
          .finally(() => setBusy(false));
      }}
    >
      {busy ? "Opening…" : "View current"}
    </button>
  );
}

function FileField({
  label,
  hint,
  accept,
  existing,
  file,
  onFile,
}: {
  label: string;
  hint: string;
  accept: string;
  existing?: SupplierDocument;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const id = useId();
  return (
    <FrappeField label={label} hint={hint}>
      <div className="space-y-1.5">
        {existing ? (
          <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--frappe-text-muted)]">
            <span className="truncate">Current: {existing.originalName}</span>
            <ViewExistingLink doc={existing} />
          </p>
        ) : null}
        <Input
          id={id}
          type="file"
          accept={accept}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <p className="text-[11px] text-[var(--frappe-text-muted)]">
            Selected: {file.name}
          </p>
        ) : null}
      </div>
    </FrappeField>
  );
}

export function SupplierForm({
  supplier,
  onSaved,
}: {
  supplier?: Supplier;
  onSaved?: (s: Supplier) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(supplier);
  const [values, setValues] = useState<SupplierFormValues>(() =>
    supplier ? supplierFormFromRecord(supplier) : emptySupplierForm()
  );
  const [saving, setSaving] = useState(false);

  const [businessLicenseFile, setBusinessLicenseFile] = useState<File | null>(
    null
  );
  const [idFile, setIdFile] = useState<File | null>(null);
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const [extraDocs, setExtraDocs] = useState<ExtraDocDraft[]>([]);
  const [removedDocIds, setRemovedDocIds] = useState<string[]>([]);

  const existingDocs = (supplier?.documents ?? []).filter(
    (d) => !removedDocIds.includes(d.id)
  );
  const existingLicense = existingDocs.find((d) => d.kind === "BUSINESS_LICENSE");
  const existingId = existingDocs.find((d) => d.kind === "ID");
  const existingAgreement = existingDocs.find((d) => d.kind === "AGREEMENT");
  const existingOther = existingDocs.filter((d) => d.kind === "OTHER");

  function setField<K extends keyof SupplierFormValues>(
    key: K,
    value: SupplierFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function updateBankAccount(
    index: number,
    key: keyof ReturnType<typeof emptyBankAccountRow>,
    value: string
  ) {
    setValues((v) => ({
      ...v,
      bankAccounts: v.bankAccounts.map((row, i) =>
        i === index ? { ...row, [key]: value } : row
      ),
    }));
  }

  function addBankAccount() {
    setValues((v) => ({
      ...v,
      bankAccounts: [...v.bankAccounts, emptyBankAccountRow()],
    }));
  }

  function removeBankAccount(index: number) {
    setValues((v) => {
      const next = v.bankAccounts.filter((_, i) => i !== index);
      return {
        ...v,
        bankAccounts: next.length ? next : [emptyBankAccountRow()],
      };
    });
  }

  function addExtraDoc() {
    setExtraDocs((rows) => [
      ...rows,
      { key: `${Date.now()}-${rows.length}`, title: "", file: null },
    ]);
  }

  function updateExtraDoc(
    key: string,
    patch: Partial<Pick<ExtraDocDraft, "title" | "file">>
  ) {
    setExtraDocs((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  function removeExtraDoc(key: string) {
    setExtraDocs((rows) => rows.filter((r) => r.key !== key));
  }

  async function uploadPending(supplierId: string) {
    const jobs: Promise<unknown>[] = [];

    const dedicated: {
      kind: SupplierDocumentKind;
      file: File | null;
    }[] = [
      { kind: "BUSINESS_LICENSE", file: businessLicenseFile },
      { kind: "ID", file: idFile },
      { kind: "AGREEMENT", file: agreementFile },
    ];
    for (const { kind, file } of dedicated) {
      if (file) jobs.push(uploadSupplierDocument(supplierId, kind, file));
    }

    for (const row of extraDocs) {
      if (!row.file) continue;
      if (!row.title.trim()) {
        throw new Error("Additional documents need a name/label");
      }
      jobs.push(
        uploadSupplierDocument(supplierId, "OTHER", row.file, row.title)
      );
    }

    for (const id of removedDocIds) {
      jobs.push(
        api(`/suppliers/${supplierId}/documents/${id}`, { method: "DELETE" })
      );
    }

    await Promise.all(jobs);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    for (const row of extraDocs) {
      if (row.file && !row.title.trim()) {
        toast.error("Enter a name for each additional document");
        return;
      }
      if (row.title.trim() && !row.file) {
        toast.error(`Choose a file for “${row.title.trim()}”`);
        return;
      }
    }

    setSaving(true);
    try {
      const saved = isEdit
        ? await api<Supplier>(`/suppliers/${supplier!.id}`, {
            method: "PATCH",
            body: buildSupplierUpdateBody(values),
          })
        : await api<Supplier>("/suppliers", {
            method: "POST",
            body: buildSupplierCreateBody(values),
          });

      await uploadPending(saved.id);

      toast.success(isEdit ? "Supplier updated" : "Supplier registered");
      onSaved?.(saved);
      router.push(`/suppliers/${saved.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-4">
      <FrappeFormToolbar>
        <FrappeButtonLink href={supplier ? `/suppliers/${supplier.id}` : "/suppliers"}>
          Cancel
        </FrappeButtonLink>
        <FrappeButtonPrimary type="submit" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Register supplier"}
        </FrappeButtonPrimary>
      </FrappeFormToolbar>

      <FrappeDocument>
        <FrappeSection
          title="Identity"
          description="Primary registration details for coffee procurement"
        >
          <FrappeFormGrid columns={2}>
            <FrappeField label="Supplier name" required>
              <Input
                value={values.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Farm, coop, or company name"
                required
                autoFocus={!isEdit}
              />
            </FrappeField>
            <FrappeField label="Supplier type">
              <Select
                value={values.supplierType}
                onValueChange={(v) =>
                  setField("supplierType", v as SupplierFormValues["supplierType"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_TYPE_OPTIONS.map((o) => (
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
                placeholder="Primary contact name"
              />
            </FrappeField>
            <FrappeField label="Organization / legal name">
              <Input
                value={values.organizationName}
                onChange={(e) => setField("organizationName", e.target.value)}
                placeholder="If different from supplier name"
              />
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>

        <FrappeSection title="Contact" description="Phone, email, and reachability">
          <FrappeFormGrid columns={2}>
            <FrappeField label="Phone">
              <Input
                value={values.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="+251…"
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

        <FrappeSection
          title="Location"
          description="Address and Ethiopian administrative location"
        >
          <FrappeFormGrid columns={2}>
            <FrappeField label="Address" fullWidth>
              <Textarea
                value={values.address}
                onChange={(e) => setField("address", e.target.value)}
                rows={2}
                placeholder="Street, landmark, or farm location"
              />
            </FrappeField>
            <FrappeField label="Region">
              <Input
                value={values.region}
                onChange={(e) => setField("region", e.target.value)}
                placeholder="e.g. SNNPR, Sidama, Oromia"
              />
            </FrappeField>
            <FrappeField label="Zone">
              <Input
                value={values.zone}
                onChange={(e) => setField("zone", e.target.value)}
              />
            </FrappeField>
            <FrappeField label="Woreda">
              <Input
                value={values.woreda}
                onChange={(e) => setField("woreda", e.target.value)}
              />
            </FrappeField>
            <FrappeField label="Kebele">
              <Input
                value={values.kebele}
                onChange={(e) => setField("kebele", e.target.value)}
              />
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>

        <FrappeSection
          title="License & Documents"
          description="License details and secure document uploads"
        >
          <FrappeFormGrid columns={2}>
            <FrappeField label="TIN number">
              <Input
                value={values.tinNumber}
                onChange={(e) => setField("tinNumber", e.target.value)}
              />
            </FrappeField>
            <FrappeField label="License number">
              <Input
                value={values.licenseNumber}
                onChange={(e) => setField("licenseNumber", e.target.value)}
              />
            </FrappeField>
            <FrappeField label="License expiry">
              <Input
                type="date"
                value={values.licenseExpiry}
                onChange={(e) => setField("licenseExpiry", e.target.value)}
              />
            </FrappeField>
          </FrappeFormGrid>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <FileField
              label="Business License"
              hint="JPEG, PNG, WebP, or PDF · max 5MB"
              accept={ACCEPT_DOC}
              existing={existingLicense}
              file={businessLicenseFile}
              onFile={setBusinessLicenseFile}
            />
            <FileField
              label="ID Document"
              hint="JPEG, PNG, WebP, or PDF · max 5MB"
              accept={ACCEPT_DOC}
              existing={existingId}
              file={idFile}
              onFile={setIdFile}
            />
            <FileField
              label="Agreement / Contract"
              hint="PDF only · max 10MB"
              accept={ACCEPT_AGREEMENT}
              existing={existingAgreement}
              file={agreementFile}
              onFile={setAgreementFile}
            />
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
                Additional documents
              </p>
              <Button type="button" size="sm" variant="outline" onClick={addExtraDoc}>
                <PlusIcon className="size-3.5" />
                Add Document
              </Button>
            </div>

            {existingOther.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--frappe-border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.title}</p>
                  <p className="text-xs text-[var(--frappe-text-muted)]">
                    {doc.originalName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ViewExistingLink doc={doc} />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      setRemovedDocIds((ids) => [...ids, doc.id])
                    }
                  >
                    <Trash2Icon className="size-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            {extraDocs.map((row) => (
              <div
                key={row.key}
                className="rounded border border-dashed border-[var(--frappe-border)] p-3"
              >
                <div className="mb-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeExtraDoc(row.key)}
                  >
                    <Trash2Icon className="size-3.5" />
                    Remove
                  </Button>
                </div>
                <FrappeFormGrid columns={2}>
                  <FrappeField label="Document name / label" required>
                    <Input
                      value={row.title}
                      onChange={(e) =>
                        updateExtraDoc(row.key, { title: e.target.value })
                      }
                      placeholder="e.g. Tax certificate, Trade license"
                    />
                  </FrappeField>
                  <FrappeField label="File" required>
                    <Input
                      type="file"
                      accept={ACCEPT_DOC}
                      onChange={(e) =>
                        updateExtraDoc(row.key, {
                          file: e.target.files?.[0] ?? null,
                        })
                      }
                    />
                  </FrappeField>
                </FrappeFormGrid>
              </div>
            ))}

            {extraDocs.length === 0 && existingOther.length === 0 ? (
              <p className="text-sm text-[var(--frappe-text-muted)]">
                Optional — use Add Document for licenses, certificates, or other
                files.
              </p>
            ) : null}
          </div>
        </FrappeSection>

        <FrappeSection
          title="Bank / payment"
          description="Add one or more settlement accounts"
        >
          <div className="space-y-3">
            {values.bankAccounts.map((row, index) => (
              <div
                key={index}
                className="rounded border border-[var(--frappe-border)] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
                    Account {index + 1}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-destructive"
                    onClick={() => removeBankAccount(index)}
                    disabled={values.bankAccounts.length <= 1}
                  >
                    <Trash2Icon className="size-3.5" />
                    Remove
                  </Button>
                </div>
                <FrappeFormGrid columns={3}>
                  <FrappeField label="Bank name">
                    <Input
                      value={row.bankName}
                      onChange={(e) =>
                        updateBankAccount(index, "bankName", e.target.value)
                      }
                      placeholder="e.g. Commercial Bank of Ethiopia"
                    />
                  </FrappeField>
                  <FrappeField label="Account holder name">
                    <Input
                      value={row.accountHolderName}
                      onChange={(e) =>
                        updateBankAccount(
                          index,
                          "accountHolderName",
                          e.target.value
                        )
                      }
                    />
                  </FrappeField>
                  <FrappeField label="Account number">
                    <Input
                      value={row.accountNumber}
                      onChange={(e) =>
                        updateBankAccount(index, "accountNumber", e.target.value)
                      }
                    />
                  </FrappeField>
                </FrappeFormGrid>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={addBankAccount}>
              <PlusIcon className="size-3.5" />
              Add bank account
            </Button>
          </div>
        </FrappeSection>

        <FrappeSection title="Notes">
          <FrappeFormGrid columns={1}>
            <FrappeField label="Internal notes" hint="Visible to staff with supplier access">
              <Textarea
                value={values.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
                placeholder="Quality notes, preferred grades, logistics, etc."
              />
            </FrappeField>
            {isEdit ? (
              <div className="flex items-center gap-2">
                <Switch
                  id="supplier-active"
                  checked={values.isActive}
                  onCheckedChange={(checked) => setField("isActive", checked)}
                />
                <Label htmlFor="supplier-active">Active supplier</Label>
              </div>
            ) : null}
          </FrappeFormGrid>
        </FrappeSection>
      </FrappeDocument>

      {isEdit ? (
        <div className="flex justify-end">
          <FrappeButtonSecondary
            type="button"
            onClick={() => router.push(`/suppliers/${supplier!.id}`)}
          >
            Back to profile
          </FrappeButtonSecondary>
        </div>
      ) : null}
    </form>
  );
}
