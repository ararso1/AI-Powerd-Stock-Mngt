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
import {
  buildLotsListPath,
  buildProcessRunsListPath,
} from "@/lib/list-query";
import { errorMessage, formatQty } from "@/lib/format";
import { coffeeFormLabel } from "@/lib/lots";
import type { Lot, ProcessRun, ProcessTemplate, StockRecord } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";

type RunWorkflow = "LOCAL" | "EXPORT" | "MILL";

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
      if (run.workflow === "LOCAL") continue;
      for (const line of lines) add(line.lotId, parseFloat(line.quantity));
      continue;
    }
    if (
      run.inputLotId &&
      (run.workflow !== "LOCAL" || (run.stageResults ?? []).length === 0)
    ) {
      add(run.inputLotId, parseFloat(run.quantityInput));
    }
  }
  return held;
}

export function ProcessRunForm() {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<RunWorkflow | "">("");
  const [templateId, setTemplateId] = useState("");
  const [inputLotId, setInputLotId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [processCost, setProcessCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const multiStock = workflow === "LOCAL" || workflow === "EXPORT";

  const { data: templates } = useFetch(
    () => api<ProcessTemplate[]>("/process-templates"),
    []
  );
  const { data: locations } = useLocations();
  const workflowTemplates = (templates ?? []).filter((t) => {
    if (workflow === "LOCAL" || workflow === "EXPORT") return t.workflow === workflow;
    if (workflow === "MILL") return !t.workflow;
    return false;
  });
  const template = workflowTemplates.find((t) => t.id === templateId);

  useEffect(() => {
    if (workflow !== "LOCAL" && workflow !== "EXPORT") return;
    const matches = (templates ?? []).filter((t) => t.workflow === workflow);
    if (matches.length !== 1) return;
    setTemplateId((current) =>
      current === matches[0].id ? current : matches[0].id
    );
  }, [workflow, templates]);

  const { data: lotsPage } = useFetch(
    () =>
      workflow === "MILL" && template
        ? api<{ data: Lot[] }>(
            buildLotsListPath(
              { form: template.inputForm, status: "ACTIVE" },
              1,
              100
            )
          )
        : Promise.resolve({ data: [] as Lot[] }),
    [workflow, template?.id, template?.inputForm]
  );

  const { data: stockRows, loading: stockLoading } = useFetch(
    () =>
      multiStock && locationId
        ? fetchInventoryForLocation(locationId)
        : Promise.resolve([] as StockRecord[]),
    [multiStock, locationId]
  );
  const { data: locationRuns } = useFetch(
    () =>
      multiStock && locationId
        ? fetchAllPages<ProcessRun>((page, limit) =>
            buildProcessRunsListPath({ locationId }, page, limit)
          )
        : Promise.resolve([] as ProcessRun[]),
    [multiStock, locationId]
  );

  const lots = lotsPage?.data ?? [];
  const selectedLot = lots.find((l) => l.id === inputLotId);
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

  const normalLocalYield = workflow === "LOCAL" || workflow === "";
  const expectedOut = useMemo(() => {
    const q = multiStock ? selectedTotal : parseFloat(quantityInput);
    const y = normalLocalYield
      ? 80
      : template
        ? parseFloat(template.expectedYieldPercent)
        : 0;
    if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(y)) return null;
    return (q * y) / 100;
  }, [multiStock, selectedTotal, quantityInput, template, normalLocalYield]);

  const progressStages =
    workflow === "EXPORT"
      ? ["Processing Started", "Export processing"]
      : workflow === "MILL"
        ? template?.stages?.length
          ? template.stages
          : ["Input", "Processing"]
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
    if (!workflow || !templateId || !locationId) {
      toast.error("Select a workflow and warehouse");
      return;
    }

    const shared = {
      templateId,
      locationId,
      processCost: parseFloat(processCost) || 0,
      notes: notes.trim() || undefined,
    };

    if (multiStock) {
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
      setSaving(true);
      try {
        const run = await api<ProcessRun>("/process-runs", {
          method: "POST",
          body: { ...shared, inputs },
        });
        toast.success(`Created ${run.runNumber}`);
        router.push(`/process-runs/${run.id}`);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }

    const qty = parseFloat(quantityInput);
    if (!inputLotId) {
      toast.error("Select an input lot");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid input quantity");
      return;
    }
    const available = selectedLot ? parseFloat(selectedLot.quantity) : 0;
    if (selectedLot && qty - available > 0.0001) {
      toast.error(`Only ${formatQty(available)} kg is available on this lot`);
      return;
    }
    setSaving(true);
    try {
      const run = await api<ProcessRun>("/process-runs", {
        method: "POST",
        body: { ...shared, inputLotId, quantityInput: qty },
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
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="mx-auto max-w-4xl space-y-4"
    >
      <section className="overflow-x-auto rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-5">
        <StageProgress stages={progressStages} currentIndex={0} />
        {workflow === "EXPORT" ? (
          <p className="mt-4 text-center text-xs text-[var(--frappe-text-muted)]">
            Export steps are added separately. Selected kilograms stay in the
            warehouse until those steps exist.
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <FrappeButtonSecondary type="button" onClick={() => router.back()}>
          Cancel
        </FrappeButtonSecondary>
        <FrappeButtonPrimary type="submit" disabled={saving} className="ml-auto">
          {saving ? "Saving…" : "Start Processing"}
        </FrappeButtonPrimary>
      </div>

      <FrappeDocument>
        <FrappeSection
          title="Process run"
          description={
            workflow === "MILL"
              ? "Choose the mill template, lot, and location."
              : "Choose the warehouse, then pick the coffee stock for this run."
          }
        >
          <FrappeFormGrid columns={2}>
            <FrappeField label="Workflow" required>
              <Select
                value={workflow || SELECT}
                onValueChange={(v) => {
                  const next = v === SELECT ? "" : (v as RunWorkflow);
                  setWorkflow(next);
                  setTemplateId("");
                  setInputLotId("");
                  setQuantityInput("");
                  setSelected({});
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT}>Select</SelectItem>
                  <SelectItem value="LOCAL">Local market processing</SelectItem>
                  <SelectItem value="EXPORT">Export processing</SelectItem>
                  <SelectItem value="MILL">Mill / other</SelectItem>
                </SelectContent>
              </Select>
            </FrappeField>

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

            {workflow === "MILL" ? (
              <>
                <FrappeField label="Template" required>
                  <Select
                    value={templateId || SELECT}
                    onValueChange={(v) => {
                      setTemplateId(v === SELECT ? "" : v);
                      setInputLotId("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT}>Select</SelectItem>
                      {workflowTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({coffeeFormLabel(t.inputForm)} →{" "}
                          {coffeeFormLabel(t.outputForm)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FrappeField>

                <FrappeField label="Input lot" required>
                  <Select
                    value={inputLotId || SELECT}
                    onValueChange={(v) => {
                      if (v === SELECT) {
                        setInputLotId("");
                        setQuantityInput("");
                        return;
                      }
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
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT}>Select</SelectItem>
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
                    max={
                      selectedLot ? parseFloat(selectedLot.quantity) : undefined
                    }
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    required
                  />
                </FrappeField>
              </>
            ) : null}
          </FrappeFormGrid>
        </FrappeSection>

        {multiStock ? (
          <FrappeSection
            title="Stock at this warehouse"
            description={
              workflow === "LOCAL"
                ? "Select one or more warehouse lots. The entered kilograms leave this warehouse when the run is created and enter Processing Started."
                : "Select one or more warehouse lots and set how much each one will contribute. Quantities are checked against what is on hand."
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
        ) : null}

        <FrappeSection title="Cost and notes">
          <FrappeFormGrid columns={2}>
            <FrappeField
              label="Expected yield"
              hint={
                normalLocalYield
                  ? "Normal operation is a yield of 80% or more."
                  : undefined
              }
            >
              <Input
                readOnly
                value={
                  normalLocalYield
                    ? `80% or more${
                        expectedOut != null
                          ? ` ≈ ${formatQty(expectedOut)} kg`
                          : ""
                      }`
                    : template
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
