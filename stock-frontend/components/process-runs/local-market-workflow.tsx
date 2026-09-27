"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FrappeButtonLink,
  FrappeButtonPrimary,
  FrappeButtonSecondary,
} from "@/components/frappe";
import { api } from "@/lib/api";
import { errorMessage, formatDate, formatQty } from "@/lib/format";
import { processStatusLabel } from "@/lib/process-runs";
import type { LocalStageResult, ProcessRun } from "@/lib/types";
import { toast } from "sonner";
import { StageProgress } from "@/components/process-runs/stage-progress";

const DEFAULT_FLOW = [
  "Processing Started",
  "Cleaning",
  "Roast & Ground",
  "Sales Store",
] as const;

function lossPct(input: number, removed: number) {
  if (!(input > 0)) return 0;
  return (removed / input) * 100;
}

function warningLabel(code: string) {
  if (code === "HIGH_LOSS") return "High Loss";
  if (code === "UNDER_SCREEN") return "Under Screen";
  return code;
}

export function LocalMarketWorkflow({
  run,
  onReload,
}: {
  run: ProcessRun;
  onReload: () => Promise<unknown>;
}) {
  const results = run.stageResults ?? [];
  const next = run.localMarket?.nextStage ?? null;
  const stages =
    run.localMarket?.stages?.length ? run.localMarket.stages : [...DEFAULT_FLOW];
  const currentIndex =
    run.status === "COMPLETED" ? stages.length : results.length;
  const purchaseKg = parseFloat(run.quantityInput);
  const available = parseFloat(run.localMarket?.availableInputKg ?? run.quantityInput);
  const committed = (run.inputLines ?? []).length > 0;
  const cleaningOut = parseFloat(run.localMarket?.cleaningOutputKg ?? "0");
  const roastOut = parseFloat(run.localMarket?.roastOutputKg ?? "0");

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

      {results.map((stage) => (
        <CompletedStage
          key={stage.stage}
          stage={stage}
          extra={
            stage.stage === "Processing Started" ? (
              <InputLineList run={run} />
            ) : null
          }
        />
      ))}

      {run.localMarket?.salesStore ? (
        <SalesStorePanel store={run.localMarket.salesStore} />
      ) : null}

      {next === "Processing Started" ? (
        <ProcessingStartedPanel
          run={run}
          purchaseKg={purchaseKg}
          onReload={onReload}
        />
      ) : null}

      {next === "Cleaning" ? (
        <QuantityStageForm
          title="Cleaning"
          hint="Normal operation is a yield of 80% or more. Output under 80% is flagged Under Screen, and loss above 20% is flagged High Loss. Removed kilograms go to the reject store."
          inputLabel="Input quantity (kg)"
          defaultInput={
            committed ? purchaseKg : Math.min(purchaseKg, available) || available
          }
          maxInput={committed ? purchaseKg : available}
          lockInput={committed}
          availableLabel={
            committed
              ? `${formatQty(purchaseKg)} kg already taken from the warehouse for this run`
              : `${formatQty(available)} kg available, including other stock on this lot`
          }
          onSubmit={(body) => postStage(run.id, body, onReload)}
        />
      ) : null}

      {next === "Roast & Ground" ? (
        <RoastAllocationForm
          availableKg={cleaningOut}
          onSubmit={(body) => postStage(run.id, body, onReload)}
        />
      ) : null}

      {next === "Sales Store" ? (
        run.localMarket?.roastPackKg != null ||
        run.localMarket?.groundPackKg != null ? (
          <SplitPackForm
            roastKg={parseFloat(run.localMarket?.roastPackKg ?? "0")}
            groundKg={parseFloat(run.localMarket?.groundPackKg ?? "0")}
            onSubmit={(body) => postStage(run.id, body, onReload)}
          />
        ) : (
          <PackForm
            availableKg={roastOut}
            onSubmit={(body) => postStage(run.id, body, onReload)}
          />
        )
      ) : null}
    </div>
  );
}

function ProcessingStartedPanel({
  run,
  purchaseKg,
  onReload,
}: {
  run: ProcessRun;
  purchaseKg: number;
  onReload: () => Promise<unknown>;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const lines = run.inputLines ?? [];
  const warehouse = run.location?.name ?? "the warehouse";

  async function confirmStart() {
    if (!(purchaseKg > 0)) {
      toast.error("This run has no input quantity");
      return;
    }
    setBusy(true);
    try {
      await api(`/process-runs/${run.id}/local-stage`, {
        method: "POST",
        body: { inputQty: purchaseKg, removedQty: 0 },
      });
      toast.success("Stage saved");
      setConfirmOpen(false);
      await onReload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function rollback() {
    setBusy(true);
    try {
      await api(`/process-runs/${run.id}/rollback`, { method: "POST" });
      toast.success(
        "Process rolled back. The kilograms are back in the warehouse."
      );
      setRollbackOpen(false);
      router.push("/process-runs");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--frappe-primary)] bg-[var(--frappe-surface)] p-4">
      <h3 className="text-base font-semibold">Processing Started</h3>
      <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
        {formatQty(purchaseKg)} kg has left the warehouse and is in this run.
        Confirm the coffee below before it moves to Cleaning.
      </p>
      <InputLineList run={run} />
      <div className="mt-4 flex flex-wrap gap-2">
        <FrappeButtonSecondary
          type="button"
          disabled={busy}
          onClick={() => setRollbackOpen(true)}
        >
          Roll back process
        </FrappeButtonSecondary>
        <FrappeButtonPrimary
          type="button"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
        >
          Complete Processing Started
        </FrappeButtonPrimary>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move this coffee to Cleaning?</AlertDialogTitle>
            <AlertDialogDescription>
              {formatQty(purchaseKg)} kg from {warehouse} will leave Processing
              Started and enter Cleaning. {run.runNumber}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-1 text-sm">
            {lines.length > 0 ? (
              lines.map((line) => (
                <li key={line.lotId}>
                  {line.lotCode} · {line.itemDescription} ·{" "}
                  <span className="tabular-nums">
                    {formatQty(line.quantity)} kg
                  </span>
                </li>
              ))
            ) : (
              <li>
                {run.inputLot?.code ?? "Input lot"} ·{" "}
                <span className="tabular-nums">{formatQty(purchaseKg)} kg</span>
              </li>
            )}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Back</AlertDialogCancel>
            <FrappeButtonPrimary
              type="button"
              disabled={busy}
              onClick={() => void confirmStart()}
            >
              {busy ? "Saving…" : "Continue to Cleaning"}
            </FrappeButtonPrimary>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll back this process?</AlertDialogTitle>
            <AlertDialogDescription>
              {formatQty(purchaseKg)} kg returns to {warehouse}. The stock
              movements for {run.runNumber} are removed and this process run is
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-1 text-sm">
            {lines.map((line) => (
              <li key={line.lotId}>
                {line.lotCode} · {formatQty(line.quantity)} kg
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep process</AlertDialogCancel>
            <FrappeButtonPrimary
              type="button"
              disabled={busy}
              onClick={() => void rollback()}
            >
              {busy ? "Rolling back…" : "Roll back and restore stock"}
            </FrappeButtonPrimary>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function InputLineList({ run }: { run: ProcessRun }) {
  const lines = run.inputLines ?? [];
  if (lines.length === 0 && !run.purchaseId) return null;
  return (
    <div className="mt-3 space-y-1 text-sm">
      {lines.map((line) => (
        <p key={line.lotId}>
          <Link
            href={`/lots/${line.lotId}`}
            className="text-[var(--frappe-primary)] hover:underline"
          >
            {line.lotCode}
          </Link>
          {" · "}
          {line.itemDescription}
          {" · "}
          <span className="tabular-nums">{formatQty(line.quantity)} kg</span>
        </p>
      ))}
      {run.purchaseId ? (
        <Link
          href={`/purchases/${run.purchaseId}`}
          className="text-[var(--frappe-primary)] hover:underline"
        >
          Open purchase
        </Link>
      ) : null}
    </div>
  );
}

function CompletedStage({
  stage,
  extra,
}: {
  stage: LocalStageResult;
  extra?: React.ReactNode;
}) {
  const isStore = stage.stage === "Sales Store";
  const started = stage.stage === "Processing Started";
  const splitRoast =
    stage.stage === "Roast & Ground" &&
    (stage.roastQty != null || stage.groundQty != null);
  const allocationNote = splitRoast ? (
    <div className="space-y-1">
      {stage.roastLotId ? (
        <p>
          <Link
            href={`/lots/${stage.roastLotId}`}
            className="text-[var(--frappe-primary)] hover:underline"
          >
            Roast coffee · {stage.roastLotCode} · {formatQty(stage.roastQty)} kg
          </Link>
        </p>
      ) : null}
      {stage.groundLotId ? (
        <p>
          <Link
            href={`/lots/${stage.groundLotId}`}
            className="text-[var(--frappe-primary)] hover:underline"
          >
            Ground coffee · {stage.groundLotCode} · {formatQty(stage.groundQty)} kg
          </Link>
        </p>
      ) : null}
    </div>
  ) : null;
  return (
    <StageCard
      title={stage.stage}
      status="Completed"
      when={stage.completedAt}
      who={stage.completedByName}
      lotCode={started || splitRoast ? null : stage.outputLotCode}
      lotId={started || splitRoast ? null : stage.outputLotId}
      warnings={stage.warnings}
      rows={
        splitRoast
          ? [
              ["From cleaning", `${formatQty(stage.inputQty)} kg`],
              ["Roast packaging", `${formatQty(stage.roastQty ?? "0")} kg`],
              ["Ground packaging", `${formatQty(stage.groundQty ?? "0")} kg`],
              ["Unallocated", `${formatQty(stage.unallocatedKg ?? "0")} kg`],
            ]
          : isStore
          ? [
              ["Input", `${formatQty(stage.inputQty)} kg`],
              ["Packaged", `${formatQty(stage.outputQty)} kg`],
              ["Unpackaged", `${formatQty(stage.remainderKg ?? "0")} kg`],
            ]
          : started
            ? [
                ["Input", `${formatQty(stage.inputQty)} kg from warehouse`],
                ["Output", `${formatQty(stage.outputQty)} kg in processing`],
                ["Loss", "—"],
              ]
            : [
                ["Input", `${formatQty(stage.inputQty)} kg`],
                ["Removed", `${formatQty(stage.removedQty)} kg`],
                ["Output", `${formatQty(stage.outputQty)} kg`],
                ["Loss", `${formatQty(stage.lossPercent)}%`],
              ]
      }
      note={
        extra || stage.rejectLotId || allocationNote ? (
          <>
            {extra}
            {allocationNote}
            {stage.rejectLotId ? (
              <Link
                href={`/lots/${stage.rejectLotId}`}
                className="text-[var(--frappe-primary)] hover:underline"
              >
                Reject store · {stage.rejectLotCode} · {formatQty(stage.removedQty)} kg
              </Link>
            ) : null}
          </>
        ) : null
      }
    />
  );
}

function StageCard({
  title,
  status,
  when,
  who,
  lotCode,
  lotId,
  rows,
  warnings,
  note,
}: {
  title: string;
  status: string;
  when?: string | null;
  who?: string | null;
  lotCode?: string | null;
  lotId?: string | null;
  rows: Array<[string, string]>;
  warnings?: string[];
  note?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-[var(--frappe-text)]">
            {title}
          </h3>
          <p className="text-xs text-[var(--frappe-text-muted)]">
            {status}
            {when ? ` · ${formatDate(when)}` : ""}
            {who ? ` · ${who}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(warnings ?? []).map((warning) => (
            <Badge key={warning} variant="destructive">
              {warningLabel(warning)}
            </Badge>
          ))}
        </div>
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-[var(--frappe-text-muted)]">{label}</dt>
            <dd className="text-sm font-medium tabular-nums text-[var(--frappe-text)]">
              {value}
            </dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-[var(--frappe-text-muted)]">Lot</dt>
          <dd className="text-sm font-medium">
            {lotId ? (
              <Link
                href={`/lots/${lotId}`}
                className="text-[var(--frappe-primary)] hover:underline"
              >
                {lotCode ?? "Open lot"}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
      {note ? <div className="mt-3 text-sm">{note}</div> : null}
    </section>
  );
}

function QuantityStageForm({
  title,
  hint,
  inputLabel,
  defaultInput,
  maxInput,
  availableLabel,
  lockInput = false,
  onSubmit,
}: {
  title: string;
  hint: string;
  inputLabel: string;
  defaultInput: number;
  maxInput: number;
  availableLabel: string;
  lockInput?: boolean;
  onSubmit: (body: { inputQty: number; removedQty: number }) => Promise<void>;
}) {
  const [inputQty, setInputQty] = useState(
    defaultInput > 0 ? String(round3(defaultInput)) : ""
  );
  const [removedQty, setRemovedQty] = useState("0");
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => {
    const input = parseFloat(inputQty);
    const removed = parseFloat(removedQty) || 0;
    if (!Number.isFinite(input) || input <= 0) return null;
    const output = round3(input - removed);
    const pct = lossPct(input, removed);
    const warnings: string[] = [];
    if (title === "Cleaning") {
      if (pct > 20) warnings.push("HIGH_LOSS");
      if (output / input < 0.8) warnings.push("UNDER_SCREEN");
    }
    return { output, pct, warnings };
  }, [inputQty, removedQty, title]);

  return (
    <form
      className="rounded-xl border border-[var(--frappe-primary)] bg-[var(--frappe-surface)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const input = parseFloat(inputQty);
        const removed = parseFloat(removedQty) || 0;
        if (!Number.isFinite(input) || input <= 0) {
          toast.error("Enter the input quantity");
          return;
        }
        if (removed < 0 || removed > input) {
          toast.error("Removed quantity cannot exceed the input");
          return;
        }
        setBusy(true);
        void onSubmit({ inputQty: input, removedQty: removed }).finally(() =>
          setBusy(false)
        );
      }}
    >
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">{hint}</p>
      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">{availableLabel}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={inputLabel}>
          <Input
            type="number"
            min={0.001}
            max={maxInput || undefined}
            step="0.001"
            value={inputQty}
            onChange={(event) => setInputQty(event.target.value)}
            readOnly={lockInput}
            required
          />
        </Field>
        <Field label="Removed / loss (kg)">
          <Input
            type="number"
            min={0}
            step="0.001"
            value={removedQty}
            onChange={(event) => setRemovedQty(event.target.value)}
          />
        </Field>
      </div>
      {preview ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span>Output {formatQty(preview.output)} kg</span>
          <span>Loss {formatQty(preview.pct)}%</span>
          {preview.warnings.map((warning) => (
            <Badge key={warning} variant="destructive">
              {warningLabel(warning)}
            </Badge>
          ))}
        </div>
      ) : null}
      <FrappeButtonPrimary type="submit" className="mt-4" disabled={busy}>
        {busy ? "Saving…" : `Complete ${title}`}
      </FrappeButtonPrimary>
    </form>
  );
}

function RoastAllocationForm({
  availableKg,
  onSubmit,
}: {
  availableKg: number;
  onSubmit: (body: {
    inputQty: number;
    roastQty: number;
    groundQty: number;
  }) => Promise<void>;
}) {
  const [roastQty, setRoastQty] = useState("");
  const [groundQty, setGroundQty] = useState("");
  const [busy, setBusy] = useState(false);
  const roast = parseFloat(roastQty) || 0;
  const ground = parseFloat(groundQty) || 0;
  const allocated = round3(roast + ground);
  const left = round3(availableKg - allocated);
  const over = allocated - availableKg > 1e-6;

  return (
    <form
      className="rounded-xl border border-[var(--frappe-primary)] bg-[var(--frappe-surface)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (allocated <= 0) {
          toast.error(
            "Enter kilograms for roast coffee packaging, ground coffee packaging, or both"
          );
          return;
        }
        if (over) {
          toast.error("Allocated quantity is more than the available input");
          return;
        }
        setBusy(true);
        void onSubmit({
          inputQty: availableKg,
          roastQty: round3(roast),
          groundQty: round3(ground),
        }).finally(() => setBusy(false));
      }}
    >
      <h3 className="text-base font-semibold">Roast & Ground</h3>
      <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
        {formatQty(availableKg)} kg came from cleaning. Split that quantity
        between roast coffee packaging and ground coffee packaging. The two
        amounts are tracked separately into the sales store.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Roast coffee packaging (kg)">
          <Input
            type="number"
            min={0}
            step="0.001"
            value={roastQty}
            onChange={(event) => setRoastQty(event.target.value)}
          />
        </Field>
        <Field label="Ground coffee packaging (kg)">
          <Input
            type="number"
            min={0}
            step="0.001"
            value={groundQty}
            onChange={(event) => setGroundQty(event.target.value)}
          />
        </Field>
      </div>
      <p className="mt-4 text-sm">
        Allocated {formatQty(Math.max(0, allocated))} kg of{" "}
        {formatQty(availableKg)} kg
        {over
          ? " · over the available quantity"
          : ` · ${formatQty(Math.max(0, left))} kg stays on the cleaned lot`}
      </p>
      <FrappeButtonPrimary type="submit" className="mt-4" disabled={busy}>
        {busy ? "Saving…" : "Complete Roast & Ground"}
      </FrappeButtonPrimary>
    </form>
  );
}

function SplitPackForm({
  roastKg,
  groundKg,
  onSubmit,
}: {
  roastKg: number;
  groundKg: number;
  onSubmit: (body: {
    inputQty: number;
    packs: Array<{ kind: "ROAST" | "GROUND"; sizeKg: number; count: number }>;
  }) => Promise<void>;
}) {
  const [roast1, setRoast1] = useState("0");
  const [roastHalf, setRoastHalf] = useState("0");
  const [ground1, setGround1] = useState("0");
  const [groundHalf, setGroundHalf] = useState("0");
  const [busy, setBusy] = useState(false);
  const roastUsed = packKg(roast1, roastHalf);
  const groundUsed = packKg(ground1, groundHalf);
  const roastLeft = round3(roastKg - roastUsed);
  const groundLeft = round3(groundKg - groundUsed);

  return (
    <form
      className="rounded-xl border border-[var(--frappe-primary)] bg-[var(--frappe-surface)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (roastUsed + groundUsed <= 0) {
          toast.error("Enter at least one package");
          return;
        }
        if (roastLeft < -1e-6 || groundLeft < -1e-6) {
          toast.error("Packages use more coffee than was allocated");
          return;
        }
        setBusy(true);
        void onSubmit({
          inputQty: round3(roastKg + groundKg),
          packs: [
            { kind: "ROAST", sizeKg: 1, count: countOf(roast1) },
            { kind: "ROAST", sizeKg: 0.5, count: countOf(roastHalf) },
            { kind: "GROUND", sizeKg: 1, count: countOf(ground1) },
            { kind: "GROUND", sizeKg: 0.5, count: countOf(groundHalf) },
          ],
        }).finally(() => setBusy(false));
      }}
    >
      <h3 className="text-base font-semibold">Sales Store</h3>
      <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
        Pack roast coffee and ground coffee separately as 1 kg or 0.5 kg.
        Packs move into the sales store. Anything left stays unpackaged on its
        own lot.
      </p>
      <PackFields
        title="Roast coffee packaging"
        availableKg={roastKg}
        count1={roast1}
        countHalf={roastHalf}
        onCount1={setRoast1}
        onCountHalf={setRoastHalf}
      />
      <PackFields
        title="Ground coffee packaging"
        availableKg={groundKg}
        count1={ground1}
        countHalf={groundHalf}
        onCount1={setGround1}
        onCountHalf={setGroundHalf}
      />
      <FrappeButtonPrimary type="submit" className="mt-4" disabled={busy}>
        {busy ? "Saving…" : "Move to sales store"}
      </FrappeButtonPrimary>
    </form>
  );
}

function PackFields({
  title,
  availableKg,
  count1,
  countHalf,
  onCount1,
  onCountHalf,
}: {
  title: string;
  availableKg: number;
  count1: string;
  countHalf: string;
  onCount1: (value: string) => void;
  onCountHalf: (value: string) => void;
}) {
  if (!(availableKg > 0)) return null;
  const used = packKg(count1, countHalf);
  const left = round3(availableKg - used);
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
        {formatQty(availableKg)} kg allocated
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={`1 kg packages (up to ${Math.floor(availableKg)})`}>
          <Input
            type="number"
            min={0}
            step="1"
            value={count1}
            onChange={(event) => onCount1(event.target.value)}
          />
        </Field>
        <Field label={`0.5 kg packages (up to ${Math.floor(availableKg / 0.5)})`}>
          <Input
            type="number"
            min={0}
            step="1"
            value={countHalf}
            onChange={(event) => onCountHalf(event.target.value)}
          />
        </Field>
      </div>
      <p className="mt-2 text-sm">
        Packaged {formatQty(Math.max(0, used))} kg
        {left >= 0
          ? ` · ${formatQty(left)} kg unpackaged`
          : " · over the allocated quantity"}
      </p>
    </div>
  );
}

function countOf(value: string) {
  return Math.max(0, parseInt(value, 10) || 0);
}

function packKg(count1: string, countHalf: string) {
  return round3(countOf(count1) + countOf(countHalf) * 0.5);
}

function PackForm({
  availableKg,
  onSubmit,
}: {
  availableKg: number;
  onSubmit: (body: {
    inputQty: number;
    packs: Array<{ sizeKg: number; count: number }>;
  }) => Promise<void>;
}) {
  const [count1, setCount1] = useState("0");
  const [countHalf, setCountHalf] = useState("0");
  const [busy, setBusy] = useState(false);
  const packs1 = Math.max(0, parseInt(count1, 10) || 0);
  const packsHalf = Math.max(0, parseInt(countHalf, 10) || 0);
  const used = round3(packs1 + packsHalf * 0.5);
  const remainder = round3(availableKg - used);
  const max1 = Math.floor(availableKg);
  const maxHalf = Math.floor(availableKg / 0.5);

  return (
    <form
      className="rounded-xl border border-[var(--frappe-primary)] bg-[var(--frappe-surface)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (used <= 0) {
          toast.error("Enter at least one package");
          return;
        }
        if (used - availableKg > 1e-6) {
          toast.error("Packages use more coffee than is available");
          return;
        }
        setBusy(true);
        void onSubmit({
          inputQty: availableKg,
          packs: [
            { sizeKg: 1, count: packs1 },
            { sizeKg: 0.5, count: packsHalf },
          ],
        }).finally(() => setBusy(false));
      }}
    >
      <h3 className="text-base font-semibold">Sales Store</h3>
      <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
        {formatQty(availableKg)} kg of roast & ground coffee can be packed as 1 kg
        or 0.5 kg. Packs move into the sales store. Anything left stays unpackaged.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={`1 kg packages (up to ${max1})`}>
          <Input
            type="number"
            min={0}
            step="1"
            value={count1}
            onChange={(event) => setCount1(event.target.value)}
          />
        </Field>
        <Field label={`0.5 kg packages (up to ${maxHalf})`}>
          <Input
            type="number"
            min={0}
            step="1"
            value={countHalf}
            onChange={(event) => setCountHalf(event.target.value)}
          />
        </Field>
      </div>
      <p className="mt-4 text-sm">
        Packaged {formatQty(Math.max(0, used))} kg
        {remainder >= 0
          ? ` · ${formatQty(remainder)} kg unpackaged`
          : " · over the available quantity"}
      </p>
      <FrappeButtonPrimary type="submit" className="mt-4" disabled={busy}>
        {busy ? "Saving…" : "Move to sales store"}
      </FrappeButtonPrimary>
    </form>
  );
}

function SalesStorePanel({
  store,
}: {
  store: NonNullable<ProcessRun["localMarket"]>["salesStore"];
}) {
  if (!store) return null;
  const place = store.packs.find((pack) => pack.locationName)?.locationName;
  return (
    <section className="rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-4">
      <h3 className="text-base font-semibold">In the sales store</h3>
      <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
        Packaged coffee is stock
        {place ? ` at ${place}` : ""}. Sales reduce the on-hand count.
        {store.roastRemainderKg != null || store.groundRemainderKg != null
          ? ` ${formatQty(store.roastRemainderKg ?? "0")} kg of roast coffee and ${formatQty(store.groundRemainderKg ?? "0")} kg of ground coffee are still unpackaged.`
          : parseFloat(store.remainderKg) > 0
            ? ` ${formatQty(store.remainderKg)} kg is still unpackaged.`
            : ""}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="frappe-list-table">
          <thead>
            <tr>
              <th>Coffee</th>
              <th>Package</th>
              <th>Produced</th>
              <th>Sold</th>
              <th>On hand</th>
              <th>Lot</th>
            </tr>
          </thead>
          <tbody>
            {store.packs.map((pack) => (
              <tr key={pack.lotId}>
                <td>
                  {pack.kind === "GROUND"
                    ? "Ground"
                    : pack.kind === "ROAST"
                      ? "Roast"
                      : "Roast & ground"}
                </td>
                <td>{pack.sizeKg} kg</td>
                <td className="tabular-nums">{pack.produced}</td>
                <td className="tabular-nums">{formatQty(pack.sold)}</td>
                <td className="tabular-nums">{formatQty(pack.onHand)}</td>
                <td>
                  <Link
                    href={`/lots/${pack.lotId}`}
                    className="text-[var(--frappe-primary)] hover:underline"
                  >
                    {pack.lotCode}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link href="/sales" className="text-[var(--frappe-primary)] hover:underline">
          Open sales
        </Link>
        <Link
          href="/inventory"
          className="text-[var(--frappe-primary)] hover:underline"
        >
          Open stock
        </Link>
      </div>
    </section>
  );
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

async function postStage(
  id: string,
  body: Record<string, unknown>,
  onReload: () => Promise<unknown>
) {
  try {
    await api(`/process-runs/${id}/local-stage`, { method: "POST", body });
    toast.success("Stage saved");
    await onReload();
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
