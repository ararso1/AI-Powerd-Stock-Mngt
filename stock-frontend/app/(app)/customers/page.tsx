"use client";

import { MasterDataPage } from "@/components/master-data/master-data-page";
import { Badge } from "@/components/ui/badge";
import type { Customer } from "@/lib/types";

const CUSTOMER_TYPE_OPTIONS = [
  { value: "RETAIL", label: "Retail" },
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "CAFE", label: "Cafe" },
  { value: "OTHER", label: "Other" },
];

export default function CustomersPage() {
  return (
    <MasterDataPage<Customer>
      title="Customers"
      endpoint="/customers"
      readPermission="customers.read"
      writePermission="customers.write"
      supportsActive
      fields={[
        { name: "name", label: "Name", required: true },
        {
          name: "customerType",
          label: "Type",
          type: "select",
          options: CUSTOMER_TYPE_OPTIONS,
        },
        { name: "phone", label: "Phone" },
        { name: "email", label: "Email", type: "email" },
        {
          name: "creditLimit",
          label: "Credit limit (ETB)",
          type: "number",
        },
        { name: "address", label: "Address", type: "textarea" },
      ]}
      columns={[
        { key: "name", header: "Name", cell: (r) => r.name },
        {
          key: "type",
          header: "Type",
          cell: (r) => r.customerType ?? "RETAIL",
        },
        { key: "phone", header: "Phone", cell: (r) => r.phone ?? "—" },
        { key: "email", header: "Email", cell: (r) => r.email ?? "—" },
        {
          key: "creditLimit",
          header: "Credit limit",
          cell: (r) =>
            r.creditLimit != null && r.creditLimit !== ""
              ? Number(r.creditLimit).toLocaleString()
              : "—",
        },
        {
          key: "status",
          header: "Status",
          cell: (r) => (
            <Badge variant={r.isActive === false ? "secondary" : "outline"}>
              {r.isActive === false ? "Inactive" : "Active"}
            </Badge>
          ),
        },
      ]}
    />
  );
}
