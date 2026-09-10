"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  exportInventoryToExcel,
  fetchInventoryForExport,
} from "@/lib/inventory-export";
import { errorMessage } from "@/lib/format";
import type { InventoryListQueryParams } from "@/lib/list-query";
import { toast } from "sonner";
import { DownloadIcon } from "lucide-react";

export function ExportInventoryButton({
  filters,
  locationLabel,
  disabled,
}: {
  filters: InventoryListQueryParams;
  locationLabel: string;
  disabled?: boolean;
}) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const rows = await fetchInventoryForExport(filters);
      if (rows.length === 0) {
        toast.error("No stock to export for the current filters");
        return;
      }
      exportInventoryToExcel(rows, locationLabel);
      toast.success(`Exported ${rows.length} item${rows.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleExport}
      disabled={disabled || exporting}
    >
      {exporting ? (
        <Spinner className="size-4" />
      ) : (
        <DownloadIcon className="size-4" />
      )}
      Export Excel
    </Button>
  );
}
