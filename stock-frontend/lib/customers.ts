import type {
  Customer,
  CustomerDocumentKind,
  CustomerMarket,
  CustomerType,
  Incoterm,
} from "@/lib/types";
import { api } from "@/lib/api";

export const CUSTOMER_MARKET_OPTIONS: {
  value: CustomerMarket;
  label: string;
  description: string;
}[] = [
  {
    value: "LOCAL",
    label: "Local customer",
    description: "Domestic roast / retail / wholesale buyers in Ethiopia",
  },
  {
    value: "INTERNATIONAL",
    label: "International (export)",
    description: "Overseas importers and export contract buyers",
  },
];

export const CUSTOMER_TYPE_OPTIONS: { value: CustomerType; label: string }[] = [
  { value: "NORMAL", label: "Normal customer" },
  { value: "AGENT", label: "Agent" },
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "CAFE", label: "Cafe" },
  { value: "OTHER", label: "Other" },
];

const LEGACY_TYPE_LABELS: Partial<Record<CustomerType, string>> = {
  RETAIL: "Retail",
};

export const INCOTERM_OPTIONS: Incoterm[] = [
  "FOB",
  "CIF",
  "CFR",
  "EXW",
  "FCA",
  "DAP",
];

export function customerMarketLabel(market?: CustomerMarket | null): string {
  if (!market) return "Local";
  return (
    CUSTOMER_MARKET_OPTIONS.find((o) => o.value === market)?.label ?? market
  );
}

export function customerTypeLabel(type?: CustomerType | null): string {
  if (!type) return "—";
  return (
    CUSTOMER_TYPE_OPTIONS.find((o) => o.value === type)?.label ??
    LEGACY_TYPE_LABELS[type] ??
    type
  );
}

export function customerDocumentKindLabel(kind: CustomerDocumentKind): string {
  switch (kind) {
    case "AGENT_AGREEMENT":
      return "Agent agreement";
    case "OTHER":
      return "Document";
    default:
      return kind;
  }
}

export async function uploadCustomerDocument(
  customerId: string,
  kind: CustomerDocumentKind,
  file: File,
  title?: string
) {
  const form = new FormData();
  form.append("file", file);
  if (title?.trim()) form.append("title", title.trim());
  return api(`/customers/${customerId}/documents/${kind}`, {
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

export function agingRiskBadgeVariant(
  risk?: string | null
): "outline" | "secondary" | "destructive" | "default" {
  if (!risk) return "outline";
  if (risk.includes("Highly")) return "destructive";
  if (risk.includes("High Risk")) return "destructive";
  if (risk.includes("Attention")) return "secondary";
  return "outline";
}

export interface CustomerFormValues {
  name: string;
  market: CustomerMarket;
  customerType: CustomerType;
  contactPerson: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  city: string;
  region: string;
  country: string;
  destinationPort: string;
  preferredIncoterm: string;
  preferredCurrency: string;
  tradeLicenseNumber: string;
  buyerCode: string;
  organizationName: string;
  tinNumber: string;
  notes: string;
  creditLimit: string;
  isActive: boolean;
}

export function emptyCustomerForm(
  market: CustomerMarket = "LOCAL"
): CustomerFormValues {
  return {
    name: "",
    market,
    customerType: "NORMAL",
    contactPerson: "",
    phone: "",
    alternatePhone: "",
    email: "",
    address: "",
    city: "",
    region: "",
    country: market === "LOCAL" ? "Ethiopia" : "",
    destinationPort: "",
    preferredIncoterm: market === "INTERNATIONAL" ? "FOB" : "",
    preferredCurrency: market === "INTERNATIONAL" ? "USD" : "ETB",
    tradeLicenseNumber: "",
    buyerCode: "",
    organizationName: "",
    tinNumber: "",
    notes: "",
    creditLimit: "",
    isActive: true,
  };
}

export function customerFormFromRecord(c: Customer): CustomerFormValues {
  const market = c.market ?? "LOCAL";
  return {
    name: c.name ?? "",
    market,
    customerType: c.customerType ?? "NORMAL",
    contactPerson: c.contactPerson ?? "",
    phone: c.phone ?? "",
    alternatePhone: c.alternatePhone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    region: c.region ?? "",
    country: c.country ?? (market === "LOCAL" ? "Ethiopia" : ""),
    destinationPort: c.destinationPort ?? "",
    preferredIncoterm: c.preferredIncoterm ?? "",
    preferredCurrency:
      c.preferredCurrency ?? (market === "INTERNATIONAL" ? "USD" : "ETB"),
    tradeLicenseNumber: c.tradeLicenseNumber ?? "",
    buyerCode: c.buyerCode ?? "",
    organizationName: c.organizationName ?? "",
    tinNumber: c.tinNumber ?? "",
    notes: c.notes ?? "",
    creditLimit:
      c.creditLimit != null && c.creditLimit !== ""
        ? String(Number(c.creditLimit))
        : "",
    isActive: c.isActive !== false,
  };
}

/** Options for the type select, including a legacy value if the record still uses one. */
export function customerTypeSelectOptions(
  current?: CustomerType | null
): { value: CustomerType; label: string }[] {
  const options = [...CUSTOMER_TYPE_OPTIONS];
  if (
    current &&
    !options.some((o) => o.value === current) &&
    LEGACY_TYPE_LABELS[current]
  ) {
    options.push({ value: current, label: LEGACY_TYPE_LABELS[current]! });
  }
  return options;
}

function opt(value: string): string | undefined {
  const t = value.trim();
  return t || undefined;
}

export function buildCustomerCreateBody(values: CustomerFormValues) {
  const limit = values.creditLimit.trim();
  return {
    name: values.name.trim(),
    market: values.market,
    customerType: values.customerType,
    contactPerson: opt(values.contactPerson),
    phone: opt(values.phone),
    alternatePhone: opt(values.alternatePhone),
    email: opt(values.email),
    address: opt(values.address),
    city: opt(values.city),
    region: opt(values.region),
    country: opt(values.country),
    destinationPort: opt(values.destinationPort),
    preferredIncoterm: opt(values.preferredIncoterm),
    preferredCurrency: opt(values.preferredCurrency)?.toUpperCase(),
    tradeLicenseNumber: opt(values.tradeLicenseNumber),
    buyerCode: opt(values.buyerCode),
    organizationName: opt(values.organizationName),
    tinNumber: opt(values.tinNumber),
    notes: opt(values.notes),
    creditLimit: limit !== "" ? Number(limit) : undefined,
  };
}

export function buildCustomerUpdateBody(values: CustomerFormValues) {
  const clearable = (value: string) => {
    const t = value.trim();
    return t || null;
  };
  const limit = values.creditLimit.trim();
  return {
    name: values.name.trim(),
    market: values.market,
    customerType: values.customerType,
    contactPerson: clearable(values.contactPerson),
    phone: clearable(values.phone),
    alternatePhone: clearable(values.alternatePhone),
    email: clearable(values.email),
    address: clearable(values.address),
    city: clearable(values.city),
    region: clearable(values.region),
    country: clearable(values.country),
    destinationPort: clearable(values.destinationPort),
    preferredIncoterm: clearable(values.preferredIncoterm),
    preferredCurrency: clearable(values.preferredCurrency)?.toUpperCase() ?? null,
    tradeLicenseNumber: clearable(values.tradeLicenseNumber),
    buyerCode: clearable(values.buyerCode),
    organizationName: clearable(values.organizationName),
    tinNumber: clearable(values.tinNumber),
    notes: clearable(values.notes),
    creditLimit: limit === "" ? null : Number(limit),
    isActive: values.isActive,
  };
}
