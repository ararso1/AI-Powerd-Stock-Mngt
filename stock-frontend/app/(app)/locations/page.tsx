"use client";

import { useState } from "react";
import { MasterDataPage } from "@/components/master-data/master-data-page";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Location, LocationType } from "@/lib/types";

const ALL_TYPES = "__all__";

export default function LocationsPage() {
  const [type, setType] = useState<string>(ALL_TYPES);
  const [includeInactive, setIncludeInactive] = useState(false);

  return (
    <MasterDataPage<Location>
      title="Locations"
      endpoint="/locations"
      readPermission="locations.read"
      writePermission="locations.write"
      emptyDescription="Create warehouse and showroom locations."
      listParams={{
        type: type === ALL_TYPES ? undefined : (type as LocationType),
        includeInactive: includeInactive || undefined,
      }}
      filterExtras={
        <>
          <div className="grid gap-2">
            <Label className="text-sm text-[var(--frappe-text-muted)]">
              Type
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-[160px] border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPES}>All types</SelectItem>
                <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                <SelectItem value="SHOWROOM">Showroom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 self-end">
            <Switch
              id="locations-include-inactive"
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
            />
            <Label
              htmlFor="locations-include-inactive"
              className="text-sm font-normal text-[var(--frappe-text)]"
            >
              Include inactive
            </Label>
          </div>
        </>
      }
      fields={[
        { name: "name", label: "Name", required: true },
        {
          name: "type",
          label: "Type",
          type: "select",
          required: true,
          options: [
            { value: "WAREHOUSE", label: "Warehouse" },
            { value: "SHOWROOM", label: "Showroom" },
          ],
        },
        { name: "address", label: "Address", type: "textarea" },
      ]}
      columns={[
        { key: "name", header: "Name", cell: (r) => r.name },
        {
          key: "type",
          header: "Type",
          cell: (r) => <Badge variant="outline">{r.type}</Badge>,
        },
        {
          key: "address",
          header: "Address",
          cell: (r) => r.address ?? "—",
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
      supportsActive
    />
  );
}
