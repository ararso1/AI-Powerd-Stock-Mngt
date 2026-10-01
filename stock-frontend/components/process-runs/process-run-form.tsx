"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FrappeButtonPrimary,
  FrappeButtonSecondary,
  FrappeDocument,
  FrappeField,
  FrappeFormGrid,
  FrappeSection,
} from "@/components/frappe";
import { StageProgress } from "@/components/process-runs/stage-progress";
import { Checkbox } from "@/components/ui/checkbox";
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
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { fetchInventoryForLocation } from "@/lib/inventory-fetch";
import { isCoffeeSku, isWarehouseProcessStock } from "@/lib/inventory-items";
import { buildProcessRunsListPath } from "@/lib/list-query";
import { errorMessage, formatQty } from "@/lib/format";
import { COFFEE_GRADE_OPTIONS, coffeeFormLabel } from "@/lib/lots";
import type { ProcessRun, ProcessTemplate, StockRecord } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";

export type ProcessRunWorkflow = "LOCAL" | "EXPORT";

const SELECT = "__select__";

const OPEN_RUN = new Set(["DRAFT", "IN_PROGRESS", "QC_HOLD", "READY"]);

function stockKg(row: StockRecord) {
  const onHand = parseFloat(row.quantity) - parseFloat(row.reservedQuantity ?? "0");
  const lotQty = row.lot ? parseFloat(row.lot.quantity) : onHand;
  return Math.max(0, Math.min(onHand, lotQty));
}

function heldByLot(runs: ProcessRun[]) {
  const held = new Map<string, number>();
  const add = (lotId: string, qty: number) => {
    if (!lotId || !(qty > 0)) return;
    held.set(lotId, (held.get(lotId) ?? 0) + qty);
  };
  for (const run of runs) {
    if (!OPEN_RUN.has(run.status)) continue;
    const lines = run.inputLines ?? [];
    if (lines.length > 0) {
      if (run.workflow === "LOCAL" || run.workflow === "EXPORT") continue;
      for (const line of lines) add(line.lotId, parseFloat(line.quantity));
      continue;
    }
    if (
      run.inputLotId &&
      ((run.workflow !== "LOCAL" && run.workflow !== "EXPORT") ||
        (run.stageResults ?? []).length === 0)
    ) {
      add(run.inputLotId, parseFloat(run.quantityInput));
    }
  }
  return held;
}

export function ProcessRunForm({
  workflow,
}: {
  workflow: ProcessRunWorkflow;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [processCost, setProcessCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [expectedGrade, setExpectedGrade] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: templates } = useFetch(
    () => api<ProcessTemplate[]>("/process-templates"),
    []
  );
  const { data: locations } = useLocations();
  const workflowTemplates = (templates ?? []).filter(
    (t) => t.workflow === workflow
  );
  const template = workflowTemplates.find((t) => t.id === templateId);

  useEffect(() => {
    const matches = (templates ?? []).filter((t) => t.workflow === workflow);
    if (matches.length !== 1) return;
    setTemplateId((current) =>
      current === matches[0].id ? current : matches[0].id
    );
  }, [workflow, templates]);

  const { data: stockRows, loading: stockLoading } = useFetch(
    () =>
      locationId
        ? fetchInventoryForLocation(locationId)
        : Promise.resolve([] as StockRecord[]),
    [locationId]
  );
  const { data: locationRuns } = useFetch(
    () =>
      locationId
        ? fetchAllPages<ProcessRun>((page, limit) =>
            buildProcessRunsListPath({ locationId }, page, limit)
          )
        : Promise.resolve([] as ProcessRun[]),
    [locationId]
  );

  const held = useMemo(() => heldByLot(locationRuns ?? []), [locationRuns]);
  const freeKg = (row: StockRecord) =>
    Math.max(0, stockKg(row) - (row.lotId ? held.get(row.lotId) ?? 0 : 0));
  const eligible = useMemo(
    () =>
      (stockRows ?? []).filter((row) => {
        if (!row.lotId || !row.lot) return false;
        if (!isWarehouseProcessStock(row)) return false;
        if (freeKg(row) <= 0) return false;
        return isCoffeeSku(row.item?.sku) || Boolean(row.lot);
      }),
    // freeKg closes over held, which is the dependency that changes availability.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stockRows, held]
  );

  const selectedTotal = useMemo(() => {
    return eligible.reduce((sum, row) => {
      const raw = row.lotId ? selected[row.lotId] : undefined;
      const qty = raw == null ? 0 : parseFloat(raw);
      return sum + (Number.isFinite(qty) ? qty : 0);
    }, 0);
  }, [eligible, selected]);

  const yieldFloor =
    workflow === "LOCAL" ? 80 : workflow === "EXPORT" ? 87 : null;
  const expectedOut = useMemo(() => {
    const y =
      yieldFloor ??
      (template ? parseFloat(template.expectedYieldPercent) : 0);
    if (selectedTotal <= 0 || !Number.isFinite(y)) return null;
    return (selectedTotal * y) / 100;
  }, [selectedTotal, template, yieldFloor]);

  const progressStages =
    workflow === "EXPORT"
      ? ["Processing Started", "Cleaning", "Packaging", "Export Store"]
      : [
          "Processing Started",
          "Cleaning",
          "Roast & Ground",
          "Sales Store",
        ];

  function toggleLot(row: StockRecord, on: boolean) {
    const lotId = row.lotId;
    if (!lotId) return;
    setSelected((current) => {
      const next = { ...current };
      if (on) next[lotId] = freeKg(row).toFixed(3);
      else delete next[lotId];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!templateId || !locationId) {
      toast.error("Select a warehouse");
      return;
    }

    const shared = {
      templateId,
      locationId,
      processCost: parseFloat(processCost) || 0,
      notes: notes.trim() || undefined,
    };

    const inputs: Array<{ lotId: string; quantity: number }> = [];
    for (const row of eligible) {
      const lotId = row.lotId;
      if (!lotId || selected[lotId] == null) continue;
      const quantity = parseFloat(selected[lotId]);
      const available = freeKg(row);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error(`${row.lot?.code ?? "Lot"} needs a quantity above 0`);
        return;
      }
      if (quantity - available > 0.0001) {
        toast.error(
          `${row.lot?.code ?? "Lot"} has ${formatQty(available)} kg available`
        );
        return;
      }
      inputs.push({ lotId, quantity });
    }
    if (inputs.length === 0) {
      toast.error("Select at least one stock lot");
      return;
    }
    const exportStart =
      workflow === "EXPORT" ? exportProcessingStart(expectedGrade) : null;
    if (workflow === "EXPORT" && !exportStart) return;
    setSaving(true);
    let run: ProcessRun;
    try {
      run = await api<ProcessRun>("/process-runs", {
        method: "POST",
        body: { ...shared, inputs },
      });
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
      return;
    }
    if (exportStart) {
      try {
        await api(`/process-runs/${run.id}/export-stage`, {
          method: "POST",
          body: {
            inputQty: selectedTotal,
            removedQty: exportStart.removedQty,
            lossPercent: exportStart.lossPercent,
            expectedGrade: exportStart.expectedGrade,
            notes: notes.trim() || undefined,
          },
        });
      } catch (err) {
        toast.error(errorMessage(err));
        router.push(`/process-runs/${run.id}`);
        setSaving(false);
        return;
      }
    }
    toast.success(
      workflow === "EXPORT"
        ? `${run.runNumber} is ready for cleaning`
        : `Created ${run.runNumber}`
    );
    router.push(`/process-runs/${run.id}`);
    setSaving(false);
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="mx-auto max-w-4xl space-y-4"
    >
      <section className="overflow-x-auto rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-5">
        <StageProgress stages={progressStages} currentIndex={0} />
        {workflow === "EXPORT" ? (
          <p className="mt-4 text-center text-xs text-[var(--frappe-text-muted)]">
            Start Processing records the expected grade and opens Cleaning. Loss is entered when cleaning ends.
          </p>
        ) : null}
      </section>

      <FrappeDocument>
        <FrappeSection
          title="Process run"
          description={
            workflow === "EXPORT"
              ? "Choose the warehouse, then the coffee for this export run."
              : "Choose the warehouse, then the coffee for this local market run."
          }
        >
          <FrappeFormGrid columns={2}>
            <FrappeField label="Warehouse" required>
              <Select
                value={locationId || SELECT}
                onValueChange={(id) => {
                  setLocationId(id === SELECT ? "" : id);
                  setSelected({});
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT}>Select</SelectItem>
                  {(locations ?? []).map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>

        <FrappeSection
            title="Stock at this warehouse"
            description={
              workflow === "EXPORT"
                ? "Select the coffee and the processing quantity. Start Processing takes those kilograms and opens Cleaning."
                : "Select one or more warehouse lots. The entered kilograms leave this warehouse when the run is created and enter Processing Started."
            }
          >
            {!locationId ? (
              <p className="text-sm text-[var(--frappe-text-muted)]">
                Select a warehouse to see coffee stock.
              </p>
            ) : stockLoading ? (
              <p className="text-sm text-[var(--frappe-text-muted)]">
                Loading stock…
              </p>
            ) : eligible.length === 0 ? (
              <p className="text-sm text-[var(--frappe-text-muted)]">
                No coffee stock is available at this warehouse.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--frappe-border)] text-left text-xs text-[var(--frappe-text-muted)]">
                      <th className="w-10 py-2 font-medium" />
                      <th className="py-2 font-medium">Lot / item</th>
                      <th className="py-2 text-right font-medium">Available</th>
                      <th className="w-36 py-2 text-right font-medium">
                        Processing qty (kg)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligible.map((row) => {
                      const lotId = row.lotId ?? "";
                      const available = freeKg(row);
                      const checked = selected[lotId] != null;
                      const entered = parseFloat(selected[lotId] ?? "");
                      const over =
                        checked &&
                        Number.isFinite(entered) &&
                        entered - available > 0.0001;
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-[var(--frappe-border)] last:border-0"
                        >
                          <td className="py-3 align-middle">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleLot(row, value === true)
                              }
                              aria-label={`Select ${row.lot?.code ?? "lot"}`}
                            />
                          </td>
                          <td className="py-3 pr-3">
                            <p className="font-medium text-[var(--frappe-text)]">
                              {row.lot?.code ?? "Lot"} ·{" "}
                              {row.item?.description ?? row.item?.sku ?? "Coffee"}
                            </p>
                            <p className="text-xs text-[var(--frappe-text-muted)]">
                              {row.lot ? coffeeFormLabel(row.lot.form) : "Coffee"}
                              {row.lot?.grade ? ` · ${row.lot.grade}` : ""}
                            </p>
                          </td>
                          <td className="py-3 text-right tabular-nums">
                            {formatQty(available)} kg
                          </td>
                          <td className="py-3 pl-3">
                            <Input
                              type="number"
                              min={0.001}
                              step="0.001"
                              max={available}
                              disabled={!checked}
                              value={checked ? selected[lotId] : ""}
                              aria-invalid={over}
                              onChange={(event) =>
                                setSelected((current) => ({
                                  ...current,
                                  [lotId]: event.target.value,
                                }))
                              }
                            />
                            {over ? (
                              <p className="mt-1 text-xs text-red-600">
                                Exceeds {formatQty(available)} kg available
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-3 text-sm font-medium tabular-nums text-[var(--frappe-text)]">
                  Processing quantity {formatQty(selectedTotal)} kg
                </p>
              </div>
            )}
          </FrappeSection>

        {workflow === "EXPORT" ? (
          <FrappeSection
            title="Processing result"
            description="Expected grade after machine processing, and the yield if loss stays at 13% or less."
          >
            <FrappeFormGrid columns={2}>
              <FrappeField label="Expected output grade" required>
                <Select
                  value={expectedGrade || SELECT}
                  onValueChange={(value) =>
                    setExpectedGrade(value === SELECT ? "" : value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT}>Select grade</SelectItem>
                    {COFFEE_GRADE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FrappeField>
              <FrappeField
                label="Expected yield"
                hint="Expected processing loss is 13% or less. Enter the actual loss when cleaning ends."
              >
                <Input
                  readOnly
                  value={
                    expectedOut != null
                      ? `87% or more ≈ ${formatQty(expectedOut)} kg`
                      : "87% or more"
                  }
                />
              </FrappeField>
            </FrappeFormGrid>
          </FrappeSection>
        ) : null}

        <FrappeSection title="Cost and notes">
          <FrappeFormGrid columns={2}>
            {workflow === "LOCAL" ? (
            <FrappeField
              label="Expected yield"
              hint="Normal operation is a yield of 80% or more."
            >
              <Input
                readOnly
                value={
                  expectedOut != null
                    ? `80% or more ≈ ${formatQty(expectedOut)} kg`
                    : "80% or more"
                }
              />
            </FrappeField>
            ) : null}

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

      <div className="flex flex-wrap gap-2">
        <FrappeButtonSecondary
          type="button"
          onClick={() => router.push("/process-runs/new")}
        >
          Cancel
        </FrappeButtonSecondary>
        <FrappeButtonPrimary type="submit" disabled={saving} className="ml-auto">
          {saving ? "Saving…" : "Start Processing"}
        </FrappeButtonPrimary>
      </div>
    </form>
  );
}

function exportProcessingStart(expectedGrade: string) {
  const grade = expectedGrade.trim();
  if (!grade) {
    toast.error("Enter the expected output grade");
    return null;
  }
  return { expectedGrade: grade, removedQty: 0, lossPercent: 0 };
}
