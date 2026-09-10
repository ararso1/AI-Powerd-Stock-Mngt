"use client";

import { MasterDataPage } from "@/components/master-data/master-data-page";
import { Badge } from "@/components/ui/badge";
import type { Supplier } from "@/lib/types";

export default function SuppliersPage() {
  return (
    <MasterDataPage<Supplier>
      title="Suppliers"
      endpoint="/suppliers"
      readPermission="suppliers.read"
      writePermission="suppliers.write"
      supportsActive
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "phone", label: "Phone" },
        { name: "email", label: "Email", type: "email" },
        { name: "address", label: "Address", type: "textarea" },
      ]}
      columns={[
        { key: "name", header: "Name", cell: (r) => r.name },
        { key: "phone", header: "Phone", cell: (r) => r.phone ?? "—" },
        { key: "email", header: "Email", cell: (r) => r.email ?? "—" },
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
