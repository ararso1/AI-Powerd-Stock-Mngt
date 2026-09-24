import type { Supplier, SupplierDocumentKind, SupplierType } from "@/lib/types";
import { api } from "@/lib/api";

export const SUPPLIER_TYPE_OPTIONS: { value: SupplierType; label: string }[] = [
  { value: "SUPPLIER", label: "Supplier" },
  { value: "FARMER", label: "Farmer" },
  { value: "COOPERATIVE", label: "Cooperative" },
  { value: "COLLECTOR", label: "Collector" },
  { value: "UNION", label: "Union" },
  { value: "TRADER", label: "Trader" },
  { value: "PROCESSOR", label: "Processor" },
  { value: "OTHER", label: "Other" },
];

export function supplierTypeLabel(type?: SupplierType | null): string {
  if (!type) return "—";
  return SUPPLIER_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function supplierDocumentKindLabel(kind: SupplierDocumentKind): string {
  switch (kind) {
    case "ID":
      return "ID document";
    case "AGREEMENT":
      return "Agreement / contract";
    case "BUSINESS_LICENSE":
      return "Business license";
    case "OTHER":
      return "Additional document";
    default:
      return kind;
  }
}

export async function uploadSupplierDocument(
  supplierId: string,
  kind: SupplierDocumentKind,
  file: File,
  title?: string
) {
  const form = new FormData();
  form.append("file", file);
  if (title?.trim()) form.append("title", title.trim());
  return api(`/suppliers/${supplierId}/documents/${kind}`, {
    method: "POST",
    body: form,
  });
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface SupplierBankAccountFormRow {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
}

export interface SupplierFormValues {
  name: string;
  supplierType: SupplierType;
  contactPerson: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  region: string;
  zone: string;
  woreda: string;
  kebele: string;
  organizationName: string;
  tinNumber: string;
  licenseNumber: string;
  licenseExpiry: string;
  bankAccounts: SupplierBankAccountFormRow[];
  notes: string;
  isActive: boolean;
}

export function emptyBankAccountRow(): SupplierBankAccountFormRow {
  return { bankName: "", accountHolderName: "", accountNumber: "" };
}

export function emptySupplierForm(): SupplierFormValues {
  return {
    name: "",
    supplierType: "SUPPLIER",
    contactPerson: "",
    phone: "",
    alternatePhone: "",
    email: "",
    address: "",
    region: "",
    zone: "",
    woreda: "",
    kebele: "",
    organizationName: "",
    tinNumber: "",
    licenseNumber: "",
    licenseExpiry: "",
    bankAccounts: [emptyBankAccountRow()],
    notes: "",
    isActive: true,
  };
}

export function supplierFormFromRecord(s: Supplier): SupplierFormValues {
  const accounts =
    s.bankAccounts?.map((a) => ({
      bankName: a.bankName ?? "",
      accountHolderName: a.accountHolderName ?? "",
      accountNumber: a.accountNumber ?? "",
    })) ?? [];
  return {
    name: s.name ?? "",
    supplierType: s.supplierType ?? "SUPPLIER",
    contactPerson: s.contactPerson ?? "",
    phone: s.phone ?? "",
    alternatePhone: s.alternatePhone ?? "",
    email: s.email ?? "",
    address: s.address ?? "",
    region: s.region ?? "",
    zone: s.zone ?? "",
    woreda: s.woreda ?? "",
    kebele: s.kebele ?? "",
    organizationName: s.organizationName ?? "",
    tinNumber: s.tinNumber ?? "",
    licenseNumber: s.licenseNumber ?? "",
    licenseExpiry: s.licenseExpiry ? String(s.licenseExpiry).slice(0, 10) : "",
    bankAccounts: accounts.length ? accounts : [emptyBankAccountRow()],
    notes: s.notes ?? "",
    isActive: s.isActive !== false,
  };
}

function opt(value: string): string | undefined {
  const t = value.trim();
  return t || undefined;
}

function normalizeBankAccounts(rows: SupplierBankAccountFormRow[]) {
  return rows
    .map((r) => ({
      bankName: r.bankName.trim(),
      accountHolderName: r.accountHolderName.trim(),
      accountNumber: r.accountNumber.trim(),
    }))
    .filter((r) => r.bankName && r.accountHolderName && r.accountNumber);
}

/** Build create body (omit empty optional fields). */
export function buildSupplierCreateBody(values: SupplierFormValues) {
  return {
    name: values.name.trim(),
    supplierType: values.supplierType,
    contactPerson: opt(values.contactPerson),
    phone: opt(values.phone),
    alternatePhone: opt(values.alternatePhone),
    email: opt(values.email),
    address: opt(values.address),
    region: opt(values.region),
    zone: opt(values.zone),
    woreda: opt(values.woreda),
    kebele: opt(values.kebele),
    organizationName: opt(values.organizationName),
    tinNumber: opt(values.tinNumber),
    licenseNumber: opt(values.licenseNumber),
    licenseExpiry: opt(values.licenseExpiry),
    bankAccounts: normalizeBankAccounts(values.bankAccounts),
    notes: opt(values.notes),
  };
}

/** Build update body; empty strings clear nullable fields. */
export function buildSupplierUpdateBody(values: SupplierFormValues) {
  const clearable = (value: string) => {
    const t = value.trim();
    return t || null;
  };
  return {
    name: values.name.trim(),
    supplierType: values.supplierType,
    contactPerson: clearable(values.contactPerson),
    phone: clearable(values.phone),
    alternatePhone: clearable(values.alternatePhone),
    email: clearable(values.email),
    address: clearable(values.address),
    region: clearable(values.region),
    zone: clearable(values.zone),
    woreda: clearable(values.woreda),
    kebele: clearable(values.kebele),
    organizationName: clearable(values.organizationName),
    tinNumber: clearable(values.tinNumber),
    licenseNumber: clearable(values.licenseNumber),
    licenseExpiry: clearable(values.licenseExpiry),
    bankAccounts: normalizeBankAccounts(values.bankAccounts),
    notes: clearable(values.notes),
    isActive: values.isActive,
  };
}
