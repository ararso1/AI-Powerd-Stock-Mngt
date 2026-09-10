"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeButtonPrimary,
  FrappeDocument,
  FrappeField,
  FrappeFormGrid,
  FrappeSection,
} from "@/components/frappe";
import { EntitySelectField } from "@/components/shared/entity-select-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { Incoterm } from "@/lib/types";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";

const INCOTERMS: Incoterm[] = ["FOB", "CIF", "CFR", "EXW", "FCA", "DAP"];

export default function NewExportPage() {
  const router = useRouter();
  const { data: locations } = useLocations();
  const [buyerName, setBuyerName] = useState("");
  const [volumeKg, setVolumeKg] = useState("19200");
  const [grade, setGrade] = useState("G1");
  const [pricePerKg, setPricePerKg] = useState("4.85");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [incoterm, setIncoterm] = useState<Incoterm>("FOB");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [stagingLocationId, setStagingLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const locationOptions = (locations ?? []).map((l) => ({
    id: l.id,
    label: `${l.name} (${l.type})`,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api<{ id: string }>("/exports", {
        method: "POST",
        body: {
          buyerName: buyerName.trim(),
          volumeKg: parseFloat(volumeKg),
          grade: grade.trim() || undefined,
          pricePerKg: parseFloat(pricePerKg),
          currencyCode,
          incoterm,
          windowStart: windowStart || undefined,
          windowEnd: windowEnd || undefined,
          stagingLocationId: stagingLocationId || undefined,
          notes: notes.trim() || undefined,
        },
      });
      toast.success("Export contract created");
      router.push(`/exports/${created.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="New export contract"
      subtitle="Not saved"
      variant="form"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Exports", href: "/exports" },
        { label: "New" },
      ]}
    >
      <PermissionGate permission="export.write">
        <form onSubmit={handleSubmit}>
          <FrappeDocument>
            <FrappeSection title="Contract">
              <FrappeFormGrid columns={2}>
                <FrappeField label="Buyer" required>
                  <Input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    required
                  />
                </FrappeField>
                <FrappeField label="Grade">
                  <Input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  />
                </FrappeField>
                <FrappeField label="Volume (kg)" required>
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    value={volumeKg}
                    onChange={(e) => setVolumeKg(e.target.value)}
                    required
                  />
                </FrappeField>
                <FrappeField label="Price / kg" required>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(e.target.value)}
                    required
                  />
                </FrappeField>
                <FrappeField label="Currency">
                  <Input
                    value={currencyCode}
                    onChange={(e) =>
                      setCurrencyCode(e.target.value.toUpperCase())
                    }
                    maxLength={3}
                  />
                </FrappeField>
                <FrappeField label="Incoterm">
                  <Select
                    value={incoterm}
                    onValueChange={(v) => setIncoterm(v as Incoterm)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FrappeField>
                <FrappeField label="Window start">
                  <Input
                    type="date"
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                  />
                </FrappeField>
                <FrappeField label="Window end">
                  <Input
                    type="date"
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
                  />
                </FrappeField>
                <EntitySelectField
                  label="Staging location"
                  value={stagingLocationId}
                  onValueChange={setStagingLocationId}
                  options={locationOptions}
                  listHref="/locations"
                  listLabel="Locations"
                />
                <FrappeField label="Notes" fullWidth>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </FrappeField>
              </FrappeFormGrid>
            </FrappeSection>
            <div className="flex justify-end gap-2 px-5 py-4">
              <FrappeButtonPrimary type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create contract"}
              </FrappeButtonPrimary>
            </div>
          </FrappeDocument>
        </form>
      </PermissionGate>
    </AppShell>
  );
}
