"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FrappeButtonPrimary,
  FrappeButtonSecondary,
  FrappeDocument,
  FrappeField,
  FrappeFormGrid,
  FrappeSection,
} from "@/components/frappe";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { buildLotsListPath } from "@/lib/list-query";
import { errorMessage, formatQty } from "@/lib/format";
import { coffeeFormLabel } from "@/lib/lots";
import type { Lot, ProcessRun, ProcessTemplate } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";

export function ProcessRunForm() {
  const router = useRouter();
  const [templateId, setTemplateId] = useState("");
  const [inputLotId, setInputLotId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [processCost, setProcessCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: templates } = useFetch(
    () => api<ProcessTemplate[]>("/process-templates"),
    []
  );
  const { data: locations } = useLocations();
  const template = (templates ?? []).find((t) => t.id === templateId);

  const { data: lotsPage } = useFetch(
    () =>
      template
        ? api<{ data: Lot[] }>(
            buildLotsListPath(
              { form: template.inputForm, status: "ACTIVE" },
              1,
              100
            )
          )
        : Promise.resolve({ data: [] as Lot[] }),
    [template?.id, template?.inputForm]
  );

  const lots = lotsPage?.data ?? [];
  const selectedLot = lots.find((l) => l.id === inputLotId);

  const expectedOut = useMemo(() => {
    const q = parseFloat(quantityInput);
    const y = template ? parseFloat(template.expectedYieldPercent) : 0;
    if (!Number.isFinite(q) || !Number.isFinite(y)) return null;
    return (q * y) / 100;
  }, [quantityInput, template]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(quantityInput);
    if (!templateId || !inputLotId || !locationId) {
      toast.error("Select template, lot, and location");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid input quantity");
      return;
    }
    setSaving(true);
    try {
      const run = await api<ProcessRun>("/process-runs", {
        method: "POST",
        body: {
          templateId,
          inputLotId,
          locationId,
          quantityInput: qty,
          processCost: parseFloat(processCost) || 0,
          notes: notes.trim() || undefined,
        },
      });
      toast.success(`Created ${run.runNumber}`);
      router.push(`/process-runs/${run.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap gap-2">
        <FrappeButtonSecondary type="button" onClick={() => router.back()}>
          Cancel
        </FrappeButtonSecondary>
        <FrappeButtonPrimary type="submit" disabled={saving} className="ml-auto">
          {saving ? "Saving…" : "Create run"}
        </FrappeButtonPrimary>
      </div>

      <FrappeDocument>
        <FrappeSection
          title="Process run"
          description="Converts an input lot through a mill template with QC and yield"
        >
          <FrappeFormGrid columns={2}>
            <FrappeField label="Template" required>
              <Select
                value={templateId || undefined}
                onValueChange={(v) => {
                  setTemplateId(v);
                  setInputLotId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {(templates ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({coffeeFormLabel(t.inputForm)} →{" "}
                      {coffeeFormLabel(t.outputForm)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FrappeField>

            <FrappeField label="Location" required>
              <Select
                value={locationId || undefined}
                onValueChange={setLocationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mill / location" />
                </SelectTrigger>
                <SelectContent>
                  {(locations ?? []).map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FrappeField>

            <FrappeField label="Input lot" required>
              <Select
                value={inputLotId || undefined}
                onValueChange={(v) => {
                  setInputLotId(v);
                  const lot = lots.find((l) => l.id === v);
                  if (lot) {
                    setQuantityInput(lot.quantity);
                    if (!locationId && lot.locationId) {
                      setLocationId(lot.locationId);
                    }
                  }
                }}
                disabled={!template}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      template ? "Select lot" : "Pick a template first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {lots.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.code} · {formatQty(lot.quantity)} kg ·{" "}
                      {lot.grade ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FrappeField>

            <FrappeField label="Input quantity (kg)" required>
              <Input
                type="number"
                min={0.001}
                step="0.001"
                max={selectedLot ? parseFloat(selectedLot.quantity) : undefined}
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                required
              />
            </FrappeField>

            <FrappeField label="Expected yield">
              <Input
                readOnly
                value={
                  template
                    ? `${template.expectedYieldPercent}% ≈ ${
                        expectedOut != null ? formatQty(expectedOut) : "—"
                      } kg`
                    : "—"
                }
              />
            </FrappeField>

            <FrappeField label="Process cost (ETB)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={processCost}
                onChange={(e) => setProcessCost(e.target.value)}
              />
            </FrappeField>

            <FrappeField label="Notes" fullWidth>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>
      </FrappeDocument>
    </form>
  );
}
