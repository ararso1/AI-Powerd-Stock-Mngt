"use client";

import { PackageOpenIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ImportDashboard() {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
          <PackageOpenIcon className="size-6 text-muted-foreground" />
        </div>
        <CardTitle className="text-xl">Import</CardTitle>
        <CardDescription className="max-w-md">
          Import procurement and inbound logistics analytics will live here —
          supplier landings, container intake, and import cost roll-up.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-10 text-center">
        <p className="text-2xl font-semibold tracking-tight text-[var(--frappe-text)]">
          Coming Soon
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          The Local and Export dashboards are ready today. Import tracking is
          next on the roadmap.
        </p>
      </CardContent>
    </Card>
  );
}
