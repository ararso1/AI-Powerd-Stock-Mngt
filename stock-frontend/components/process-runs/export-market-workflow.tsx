"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FrappeButtonLink,
  FrappeButtonPrimary,
} from "@/components/frappe";
import { StageProgress } from "@/components/process-runs/stage-progress";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@/lib/api";
import { errorMessage, formatDate, formatQty } from "@/lib/format";
import { COFFEE_GRADE_OPTIONS } from "@/lib/lots";
import { processStatusLabel } from "@/lib/process-runs";
import type { ExportStageResult, ProcessRun } from "@/lib/types";
import { toast } from "sonner";

const DEFAULT_FLOW = [
  "Processing Started",
  "Cleaning",
  "Packaging",
  "Export Store",
] as const;

function lossPct(input: number, removed: number) {
  if (!(input > 0)) return 0;
  return (removed / input) * 100;
}

function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function ExportMarketWorkflow({
  run,
  onReload,
}: {
  run: ProcessRun;
  onReload: () => Promise<unknown>;
}) {
  const results = (run.stageResults ?? []) as ExportStageResult[];
  const next = run.exportMarket?.nextStage ?? null;
  const stages = run.exportMarket?.stages?.length
    ? run.exportMarket.stages
    : [...DEFAULT_FLOW];
  const currentIndex =
    run.status === "COMPLETED" ? stages.length : results.length;
  const available = parseFloat(
    run.exportMarket?.availableInputKg ?? run.quantityInput
  );
  const packaging = results.find(
    (row) => row.stage === "Packaging" || row.stage === "Packaging & Export Store"
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <FrappeButtonLink href="/process-runs">← Processing</FrappeButtonLink>
        <Badge variant="outline" className="ml-auto">
          {processStatusLabel(run.status)}
        </Badge>
      </div>

      <section className="overflow-x-auto rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-5">
        <StageProgress stages={stages} currentIndex={currentIndex} />
      </section>

      <Traceability run={run} results={results} />

      {results.map((stage) => (
        <StageRecord key={stage.stage} stage={stage} />
      ))}

      <PermissionGate permission="process.write">
        {next === "Processing Started" ? (
          <ProcessingStartForm
            runId={run.id}
            inputKg={parseFloat(run.quantityInput)}
            onReload={onReload}
          />
        ) : null}
        {next === "Cleaning" ? (
          <CleaningForm
            runId={run.id}
            inputKg={available}
            onReload={onReload}
          />
        ) : null}
        {next === "Packaging" ? (
          <PackagingForm
            runId={run.id}
            inputKg={available}
            onReload={onReload}
          />
        ) : null}
        {next === "Export Store" && packaging ? (
          <ExportStoreForm
            runId={run.id}
            packaging={packaging}
            onReload={onReload}
          />
        ) : null}
      </PermissionGate>

      <ReadySummary run={run} results={results} />
    </div>
  );
}

function ReadySummary({
  run,
  results,
}: {
  run: ProcessRun;
  results: ExportStageResult[];
}) {
  const stored = results.find(
    (row) => row.stage === "Export Store" || row.stage === "Packaging & Export Store"
  );
  const packaging = results.find((row) => row.stage === "Packaging");
  const started = results.find((row) => row.stage === "Processing Started");
  if (!stored) return null;
  const grade = stored.expectedGrade ?? started?.expectedGrade ?? "—";
  const full = stored.doniyaCount ?? packaging?.doniyaCount ?? 0;
  const each = stored.kgPerDoniya ?? packaging?.kgPerDoniya;
  const remainder = stored.remainderKg ?? packaging?.remainderKg ?? "0";
  const total = stored.packagedKg ?? stored.outputQty;

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--frappe-border)] px-4 py-3">
        <div>
          <p className="text-xs text-[var(--frappe-text-muted)]">Export batch</p>
          <h2 className="text-base font-semibold">{run.runNumber}</h2>
        </div>
        <Badge className="ml-auto border-transparent bg-emerald-600 text-white">
          Ready
        </Badge>
      </div>
      <dl className="grid gap-4 px-4 py-4 sm:grid-cols-3">
        <Stat label="Total quantity" value={`${formatQty(total)} kg`} />
        <Stat
          label="Full Doniya"
          value={each ? `${full} × ${formatQty(each)} kg` : String(full)}
        />
        <Stat label="Remaining" value={`${formatQty(remainder)} kg`} />
        <Stat label="Grade" value={grade} />
        <Stat label="Batch" value={run.runNumber} />
        <Stat label="Export lot" value={stored.outputLotCode ?? "—"} />
      </dl>
      <p className="border-t border-[var(--frappe-border)] px-4 py-3 text-sm text-[var(--frappe-text-muted)]">
        This coffee is export-ready
        {stored.exportStoreLocationName ? ` at ${stored.exportStoreLocationName}` : ""}.
        Open it from{" "}
        <Link href="/exports" className="text-[var(--frappe-primary)] hover:underline">
          Exports
        </Link>
        .
      </p>
    </section>
  );
}

function Traceability({
  run,
  results,
}: {
  run: ProcessRun;
  results: ExportStageResult[];
}) {
  const sources = run.exportMarket?.sourceLots ?? [];
  const started = results.find((row) => row.stage === "Processing Started");
  const cleaning = results.find((row) => row.stage === "Cleaning");
  const packed = results.find(
    (row) =>
      row.stage === "Packaging" ||
      row.stage === "Export Store" ||
      row.stage === "Packaging & Export Store"
  );

  return (
    <section className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--frappe-text)]">
        Lot traceability
      </h2>
      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
        {run.runNumber} · input {formatQty(run.quantityInput)} kg
        {started?.expectedGrade
          ? ` · expected grade ${started.expectedGrade}`
          : ""}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--frappe-text-muted)]">
              <th className="py-1 pr-3 font-medium">Source lot</th>
              <th className="py-1 pr-3 font-medium">Grade</th>
              <th className="py-1 pr-3 font-medium">ECTA</th>
              <th className="py-1 font-medium">Taken</th>
            </tr>
          </thead>
          <tbody>
            {(run.inputLines ?? []).map((line) => {
              const source = sources.find((lot) => lot.id === line.lotId);
              return (
                <tr key={line.lotId} className="border-t border-[var(--frappe-border)]">
                  <td className="py-2 pr-3">
                    <Link
                      href={`/lots/${line.lotId}`}
                      className="text-[var(--frappe-primary)] hover:underline"
                    >
                      {line.lotCode}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{source?.grade ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {source?.ectaGrade || source?.ectaCertificateNumber
                      ? `${source.ectaGrade ?? "—"} ${source.ectaCertificateNumber ?? ""}`.trim()
                      : "—"}
                  </td>
                  <td className="py-2 tabular-nums">{formatQty(line.quantity)} kg</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <Stat label="Processing output" value={started ? `${formatQty(started.outputQty)} kg` : "—"} />
        <Stat label="Cleaning output" value={cleaning ? `${formatQty(cleaning.outputQty)} kg` : "—"} />
        <Stat
          label="Packaged"
          value={
            packed?.packagedKg
              ? `${formatQty(packed.packagedKg)} kg`
              : "—"
          }
        />
      </dl>
    </section>
  );
}

function StageRecord({ stage }: { stage: ExportStageResult }) {
  const highLoss = (stage.warnings ?? []).includes("HIGH_LOSS");
  return (
    <section className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{stage.stage}</h2>
        {highLoss ? <Badge variant="destructive">High Loss</Badge> : null}
        <span className="ml-auto text-xs text-[var(--frappe-text-muted)]">
          {formatDate(stage.completedAt)}
          {stage.completedByName ? ` · ${stage.completedByName}` : ""}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
        <Stat label="Input" value={`${formatQty(stage.inputQty)} kg`} />
        <Stat label="Reject" value={`${formatQty(stage.removedQty)} kg`} />
        <Stat label="Output" value={`${formatQty(stage.outputQty)} kg`} />
        <Stat label="Loss" value={`${stage.lossPercent}%`} />
        {stage.expectedGrade ? (
          <Stat label="Expected grade" value={stage.expectedGrade} />
        ) : null}
        {stage.kgPerDoniya ? (
          <Stat
            label="Packaging"
            value={`${stage.doniyaCount ?? 0} × ${formatQty(stage.kgPerDoniya)} kg`}
          />
        ) : null}
        {stage.remainderKg ? (
          <Stat label="Remaining" value={`${formatQty(stage.remainderKg)} kg`} />
        ) : null}
        {stage.outputLotCode ? (
          <Stat
            label={
              stage.stage === "Export Store" || stage.stage === "Packaging & Export Store"
                ? "Export store lot"
                : stage.stage === "Packaging"
                  ? "Packaging lot"
                  : "Output lot"
            }
            value={stage.outputLotCode}
          />
        ) : null}
      </dl>
      {stage.rejectLotCode ? (
        <p className="mt-2 text-xs text-[var(--frappe-text-muted)]">
          Reject {formatQty(stage.removedQty)} kg moved to the reject store as{" "}
          {stage.rejectLotId ? (
            <Link
              href={`/lots/${stage.rejectLotId}`}
              className="text-[var(--frappe-primary)] hover:underline"
            >
              {stage.rejectLotCode}
            </Link>
          ) : (
            stage.rejectLotCode
          )}
          .
        </p>
      ) : null}
      {stage.exportStoreLocationName ? (
        <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
          Stored at {stage.exportStoreLocationName}
          {stage.remainderLotCode
            ? `. Remainder lot ${stage.remainderLotCode}`
            : ""}
          .
        </p>
      ) : null}
      {stage.postEcta ? (
        <p className="mt-2 text-xs text-[var(--frappe-text-muted)]">
          Post-processing ECTA {stage.postEcta.grade ?? "—"}
          {stage.postEcta.certificateNumber
            ? ` · ${stage.postEcta.certificateNumber}`
            : ""}
          {stage.postEcta.moisturePercent
            ? ` · moisture ${stage.postEcta.moisturePercent}%`
            : ""}
          {stage.postEcta.cuppingScore
            ? ` · cupping ${stage.postEcta.cuppingScore}`
            : ""}
        </p>
      ) : null}
      {(stage.documents ?? []).length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-[var(--frappe-text-muted)]">
          {stage.documents!.map((doc) => (
            <li key={doc.key}>
              {doc.label}
              {doc.reference ? ` · ${doc.reference}` : ""}
              {doc.notes ? ` · ${doc.notes}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ProcessingStartForm({
  runId,
  inputKg,
  onReload,
}: {
  runId: string;
  inputKg: number;
  onReload: () => Promise<unknown>;
}) {
  const [grade, setGrade] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!grade) {
      toast.error("Enter the expected output grade");
      return;
    }
    setSaving(true);
    try {
      await api(`/process-runs/${runId}/export-stage`, {
        method: "POST",
        body: {
          inputQty: inputKg,
          removedQty: 0,
          lossPercent: 0,
          expectedGrade: grade,
          notes: notes.trim() || undefined,
        },
      });
      toast.success("Processing start saved");
      await onReload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4"
    >
      <h2 className="text-sm font-semibold">Processing start</h2>
      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
        {formatQty(inputKg)} kg was taken from the warehouse. Enter the
        expected grade. Loss is recorded when cleaning ends.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Input kg">
          <Input readOnly value={formatQty(inputKg)} />
        </Field>
        <Field label="Expected output grade">
          <Select value={grade || undefined} onValueChange={setGrade}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              {COFFEE_GRADE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <FrappeButtonPrimary type="submit" className="mt-4" disabled={saving}>
        Save processing start
      </FrappeButtonPrimary>
    </form>
  );
}

function CleaningForm({
  runId,
  inputKg,
  onReload,
}: {
  runId: string;
  inputKg: number;
  onReload: () => Promise<unknown>;
}) {
  const [removed, setRemoved] = useState("");
  const [percent, setPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const preview = useMemo(() => {
    const kg = parseFloat(removed);
    if (Number.isFinite(kg)) return lossPct(inputKg, kg);
    const pct = parseFloat(percent);
    return Number.isFinite(pct) ? pct : 0;
  }, [removed, percent, inputKg]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = lossBody(inputKg, removed, percent);
    if (!body) return;
    if (!(body.removedQty > 0) && !(parseFloat(percent) > 0)) {
      toast.error("Enter the cleaning loss in kg or percent");
      return;
    }
    setSaving(true);
    try {
      await api(`/process-runs/${runId}/export-stage`, {
        method: "POST",
        body: { inputQty: inputKg, ...body, notes: notes.trim() || undefined },
      });
      toast.success("Cleaning ended. The usable coffee is ready for packaging");
      await onReload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4"
    >
      <h2 className="text-sm font-semibold">Cleaning</h2>
      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
        {formatQty(inputKg)} kg from processing. When cleaning ends, enter the
        loss in kilograms or percent. Rejected kilograms go to the reject
        store, and the rest moves to packaging.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Input kg">
          <Input readOnly value={formatQty(inputKg)} />
        </Field>
        <Field label="Loss / reject kg">
          <Input
            type="number"
            min={0}
            step="0.001"
            value={removed}
            onChange={(e) => {
              setRemoved(e.target.value);
              const kg = parseFloat(e.target.value);
              setPercent(
                Number.isFinite(kg) ? lossPct(inputKg, kg).toFixed(2) : ""
              );
            }}
          />
        </Field>
        <Field label="Loss %">
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={percent}
            onChange={(e) => {
              setPercent(e.target.value);
              const pct = parseFloat(e.target.value);
              setRemoved(
                Number.isFinite(pct)
                  ? round3((inputKg * pct) / 100).toFixed(3)
                  : ""
              );
            }}
          />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <p
        className={`mt-3 text-sm ${preview > 13 ? "font-medium text-red-600" : "text-[var(--frappe-text-muted)]"}`}
      >
        {preview > 13
          ? `High Loss · ${preview.toFixed(2)}%`
          : `Loss ${preview.toFixed(2)}% · within the 13% limit`}
      </p>
      <FrappeButtonPrimary type="submit" className="mt-4" disabled={saving}>
        End cleaning
      </FrappeButtonPrimary>
    </form>
  );
}

function doniyaSplit(availableKg: number, kgPerDoniya: number) {
  if (!(kgPerDoniya > 0) || !(availableKg > 0)) {
    return { full: 0, packagedKg: 0, remainderKg: Math.max(0, availableKg) };
  }
  const full = Math.floor((availableKg + 1e-9) / kgPerDoniya);
  const packagedKg = round3(full * kgPerDoniya);
  const remainderKg = round3(Math.max(0, availableKg - packagedKg));
  return { full, packagedKg, remainderKg };
}

function PackagingForm({
  runId,
  inputKg,
  onReload,
}: {
  runId: string;
  inputKg: number;
  onReload: () => Promise<unknown>;
}) {
  const [kgPerDoniya, setKgPerDoniya] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const each = parseFloat(kgPerDoniya);
  const split = useMemo(
    () => doniyaSplit(inputKg, Number.isFinite(each) ? each : 0),
    [inputKg, each]
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!(each > 0)) {
      toast.error("Enter kilograms per Doniya");
      return;
    }
    if (split.full < 1) {
      toast.error("Kilograms per Doniya is higher than the coffee ready for packaging");
      return;
    }
    setSaving(true);
    try {
      await api(`/process-runs/${runId}/export-stage`, {
        method: "POST",
        body: {
          inputQty: inputKg,
          kgPerDoniya: each,
          notes: notes.trim() || undefined,
        },
      });
      toast.success("Packaged coffee is in the export store");
      await onReload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4"
    >
      <h2 className="text-sm font-semibold">Packaging</h2>
      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
        {formatQty(inputKg)} kg is ready for packaging. Enter kilograms per
        Doniya. Full Doniya and the leftover kilograms update as you type.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Ready for packaging">
          <Input readOnly value={`${formatQty(inputKg)} kg`} />
        </Field>
        <Field label="KG per Doniya">
          <Input
            type="number"
            min={0.001}
            step="0.001"
            value={kgPerDoniya}
            onChange={(e) => setKgPerDoniya(e.target.value)}
          />
        </Field>
        <Field label="Full Doniya">
          <Input readOnly value={String(split.full)} />
        </Field>
        <Field label="Remaining kg">
          <Input readOnly value={formatQty(split.remainderKg)} />
        </Field>
        <Field label="Packaged kg">
          <Input readOnly value={formatQty(split.packagedKg)} />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <FrappeButtonPrimary type="submit" className="mt-4" disabled={saving}>
        Save packaging
      </FrappeButtonPrimary>
    </form>
  );
}

function ExportStoreForm({
  runId,
  packaging,
  onReload,
}: {
  runId: string;
  packaging: ExportStageResult;
  onReload: () => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const packagedKg = parseFloat(packaging.packagedKg ?? packaging.outputQty);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/process-runs/${runId}/export-stage`, {
        method: "POST",
        body: { inputQty: packagedKg },
      });
      toast.success("Moved to the export store");
      await onReload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4"
    >
      <h2 className="text-sm font-semibold">Export store</h2>
      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
        {packaging.doniyaCount ?? 0} full Doniya
        {packaging.kgPerDoniya
          ? ` at ${formatQty(packaging.kgPerDoniya)} kg each`
          : ""}{" "}
        move to the export store and stay there until shipment.
        {parseFloat(packaging.remainderKg ?? "0") > 0
          ? ` ${formatQty(packaging.remainderKg)} kg did not fill a Doniya and stays out of the export store.`
          : ""}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Packaged kg">
          <Input readOnly value={formatQty(packagedKg)} />
        </Field>
        <Field label="Full Doniya">
          <Input readOnly value={String(packaging.doniyaCount ?? 0)} />
        </Field>
        <Field label="Remaining kg">
          <Input readOnly value={formatQty(packaging.remainderKg ?? 0)} />
        </Field>
      </div>
      <FrappeButtonPrimary type="submit" className="mt-4" disabled={saving}>
        Move to export store
      </FrappeButtonPrimary>
    </form>
  );
}

function lossBody(inputKg: number, removed: string, percent: string) {
  const kg = parseFloat(removed);
  const pct = parseFloat(percent);
  if (!Number.isFinite(kg) && !Number.isFinite(pct)) {
    toast.error("Enter the loss in kilograms or percent");
    return null;
  }
  const removedQty = Number.isFinite(kg)
    ? round3(kg)
    : round3((inputKg * pct) / 100);
  if (removedQty - inputKg > 0.0005) {
    toast.error("Loss cannot be more than the input");
    return null;
  }
  return {
    removedQty,
    lossPercent: Number.isFinite(pct) ? pct : lossPct(inputKg, removedQty),
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--frappe-text-muted)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
