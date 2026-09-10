"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FrappeButtonLink } from "@/components/frappe";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { toast } from "sonner";

export function PurchaseDocumentActions({
  purchaseId,
  status,
  canEdit = true,
}: {
  purchaseId: string;
  status?: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [voiding, setVoiding] = useState(false);
  const isVoided = status === "VOIDED";

  async function handleVoid() {
    if (
      !confirm(
        "Void this purchase? Stock and bank entries will be reversed. This cannot be undone."
      )
    ) {
      return;
    }
    setVoiding(true);
    try {
      await api(`/purchases/${purchaseId}`, { method: "DELETE" });
      toast.success("Purchase voided");
      router.push("/purchases");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setVoiding(false);
    }
  }

  if (isVoided) return null;

  return (
    <PermissionGate permission="purchase.write">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <FrappeButtonLink href={`/purchases/${purchaseId}/edit`}>
            Edit
          </FrappeButtonLink>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs text-destructive"
          disabled={voiding}
          onClick={handleVoid}
        >
          {voiding ? "Voiding…" : "Void"}
        </Button>
      </div>
    </PermissionGate>
  );
}

export function SaleDocumentActions({
  saleId,
  status,
  canEdit = true,
}: {
  saleId: string;
  status?: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [voiding, setVoiding] = useState(false);
  const isVoided = status === "VOIDED";

  async function handleVoid() {
    if (
      !confirm(
        "Void this sale? Stock and bank entries will be reversed. This cannot be undone."
      )
    ) {
      return;
    }
    setVoiding(true);
    try {
      await api(`/sales/${saleId}`, { method: "DELETE" });
      toast.success("Sale voided");
      router.push("/sales");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setVoiding(false);
    }
  }

  if (isVoided) return null;

  return (
    <PermissionGate permission="sales.write">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <FrappeButtonLink href={`/sales/${saleId}/edit`}>Edit</FrappeButtonLink>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs text-destructive"
          disabled={voiding}
          onClick={handleVoid}
        >
          {voiding ? "Voiding…" : "Void"}
        </Button>
      </div>
    </PermissionGate>
  );
}
