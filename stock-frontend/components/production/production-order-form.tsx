"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EntitySelectField } from "@/components/shared/entity-select-field";
import {
  FrappeButtonLink,
  FrappeButtonPrimary,
  FrappeDocument,
  FrappeField,
  FrappeFormGrid,
  FrappeFormToolbar,
  FrappeSection,
} from "@/components/frappe";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { fetchAllBoms } from "@/lib/bom-fetch";
import { errorMessage } from "@/lib/format";
import type { ProductionOrder } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

export function ProductionOrderForm() {
  const router = useRouter();
  const [bomId, setBomId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantityPlanned, setQuantityPlanned] = useState("1");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: boms, loading: bomsLoading } = useFetch(
    () => fetchAllBoms({ isActive: true }),
    []
  );
  const { data: locations, loading: locationsLoading } = useLocations();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bomId) {
      toast.error("Select a BOM");
      return;
    }
    if (!locationId) {
      toast.error("Select a location");
      return;
    }
    const qty = parseFloat(quantityPlanned);
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("Enter a positive planned quantity");
      return;
    }
    setSaving(true);
    try {
      const created = await api<ProductionOrder>("/production-orders", {
        method: "POST",
        body: {
          bomId,
          locationId,
          quantityPlanned: qty,
          notes: notes.trim() || undefined,
        },
      });
      toast.success("Production order created");
      router.push(`/production-orders/${created.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (bomsLoading || locationsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
      <FrappeFormToolbar>
        <FrappeButtonPrimary type="submit" disabled={saving}>
          {saving ? <Spinner className="size-4" /> : "Create"}
        </FrappeButtonPrimary>
        <FrappeButtonLink href="/production-orders">Cancel</FrappeButtonLink>
      </FrappeFormToolbar>

      <FrappeDocument>
        <FrappeSection
          title="Production order"
          description="BOM lines are snapshotted when the order is created"
        >
          <FrappeFormGrid columns={2}>
            <EntitySelectField
              label="BOM"
              required
              fullWidth
              value={bomId}
              onValueChange={setBomId}
              options={(boms ?? []).map((bom) => ({
                id: bom.id,
                label: bom.finishedItem?.description
                  ? `${bom.name} — ${bom.finishedItem.description}`
                  : bom.name,
              }))}
              listHref="/boms"
              listLabel="All BOMs"
              emptyMessage="Create an active BOM first."
            />
            <EntitySelectField
              label="Location"
              required
              value={locationId}
              onValueChange={setLocationId}
              options={(locations ?? []).map((loc) => ({
                id: loc.id,
                label: `${loc.name} (${loc.type})`,
              }))}
              listHref="/locations"
              listLabel="All locations"
              emptyMessage="Add a warehouse or showroom first."
            />
            <FrappeField label="Quantity planned" required>
              <Input
                type="number"
                step="any"
                min="0"
                value={quantityPlanned}
                onChange={(e) => setQuantityPlanned(e.target.value)}
                required
              />
            </FrappeField>
            <FrappeField label="Notes" fullWidth>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>
      </FrappeDocument>
    </form>
  );
}
