"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeButtonLink,
  FrappeButtonPrimary,
  FrappeButtonSecondary,
  FrappeDocument,
  FrappeFormGrid,
  FrappeSection,
} from "@/components/frappe";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { errorMessage, formatDate, formatMoney, formatQty } from "@/lib/format";
import { coffeeFormLabel } from "@/lib/lots";
import { processStatusLabel } from "@/lib/process-runs";
import type { ProcessRun } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--frappe-text-muted)]">
        {label}
      </p>
      <div className="text-sm text-[var(--frappe-text)]">{value}</div>
    </div>
  );
}

export default function ProcessRunDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [busy, setBusy] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [moisture, setMoisture] = useState("11.5");
  const [defects, setDefects] = useState("0");
  const [cupping, setCupping] = useState("");
  const [passed, setPassed] = useState(true);
  const [qcNotes, setQcNotes] = useState("");
  const [qtyOut, setQtyOut] = useState("");
  const [qtyReject, setQtyReject] = useState("0");
  const [outGrade, setOutGrade] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");

  const { data: run, loading, error, reload } = useFetch(
    () =>
      id
        ? api<ProcessRun>(`/process-runs/${id}`)
        : Promise.reject(new Error("Invalid process run id")),
    [id]
  );

  async function runAction(
    path: string,
    body?: Record<string, unknown>,
    okMsg?: string
  ) {
    setBusy(true);
    try {
      await api(`/process-runs/${id}${path}`, {
        method: "POST",
        body: body ?? {},
      });
      toast.success(okMsg ?? "Updated");
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitQc() {
    setBusy(true);
    try {
      await api(`/process-runs/${id}/qc`, {
        method: "POST",
        body: {
          moisturePercent: moisture ? parseFloat(moisture) : undefined,
          defectCount: defects ? parseInt(defects, 10) : undefined,
          cuppingScore: cupping ? parseFloat(cupping) : undefined,
          passed,
          notes: qcNotes.trim() || undefined,
        },
      });
      toast.success(passed ? "QC passed" : "QC hold recorded");
      setQcOpen(false);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitComplete() {
    const out = parseFloat(qtyOut);
    if (!Number.isFinite(out) || out <= 0) {
      toast.error("Enter output quantity");
      return;
    }
    setBusy(true);
    try {
      await api(`/process-runs/${id}/complete`, {
        method: "POST",
        body: {
          quantityOutput: out,
          quantityReject: parseFloat(qtyReject) || 0,
          outputGrade: outGrade.trim() || undefined,
          moisturePercent: moisture ? parseFloat(moisture) : undefined,
          notes: completeNotes.trim() || undefined,
        },
      });
      toast.success("Process completed — output lot created");
      setCompleteOpen(false);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title={loading ? "Process run" : run?.runNumber ?? "Process run"}
      variant="form"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Processing", href: "/process-runs" },
        { label: run?.runNumber ?? (id ? id.slice(0, 8) : "…") },
      ]}
    >
      <PermissionGate permission="process.read">
        {loading ? (
          <PageLoading />
        ) : error || !run ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">
              Process run not found
            </p>
            <FrappeButtonLink href="/process-runs" className="mt-4">
              Back to list
            </FrappeButtonLink>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <FrappeButtonLink href="/process-runs">
                ← Back to list
              </FrappeButtonLink>
              <Badge variant="outline" className="ml-auto">
                {processStatusLabel(run.status)}
              </Badge>
              <PermissionGate permission="process.write">
                {run.status === "DRAFT" ? (
                  <FrappeButtonPrimary
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction("/start", {}, "Started")}
                  >
                    Start
                  </FrappeButtonPrimary>
                ) : null}
                {run.status === "IN_PROGRESS" &&
                (run.stages?.length ?? 0) > 0 &&
                run.currentStageIndex < (run.stages?.length ?? 0) ? (
                  <FrappeButtonPrimary
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction("/complete-stage", {}, "Stage completed")
                    }
                  >
                    Complete stage
                  </FrappeButtonPrimary>
                ) : null}
                {run.status === "QC_HOLD" ||
                run.status === "READY" ||
                run.status === "IN_PROGRESS" ? (
                  <FrappeButtonSecondary
                    type="button"
                    disabled={busy}
                    onClick={() => setQcOpen(true)}
                  >
                    Record QC
                  </FrappeButtonSecondary>
                ) : null}
                {run.status === "READY" ||
                (run.status === "IN_PROGRESS" &&
                  !run.template?.requiresQc) ? (
                  <FrappeButtonPrimary
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const expected =
                        (parseFloat(run.quantityInput) *
                          parseFloat(run.expectedYieldPercent)) /
                        100;
                      setQtyOut(expected.toFixed(3));
                      setOutGrade(run.inputLot?.grade ?? "");
                      setCompleteOpen(true);
                    }}
                  >
                    Complete & yield
                  </FrappeButtonPrimary>
                ) : null}
                {run.status !== "COMPLETED" && run.status !== "CANCELLED" ? (
                  <FrappeButtonSecondary
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction("/cancel", {}, "Cancelled")}
                  >
                    Cancel
                  </FrappeButtonSecondary>
                ) : null}
              </PermissionGate>
            </div>

            <FrappeDocument>
              <FrappeSection
                title="Run"
                description={
                  run.template
                    ? `${run.template.name} · ${coffeeFormLabel(run.template.inputForm)} → ${coffeeFormLabel(run.template.outputForm)}`
                    : undefined
                }
              >
                <FrappeFormGrid columns={3}>
                  <DetailField label="Run #" value={run.runNumber} />
                  <DetailField
                    label="Location"
                    value={run.location?.name ?? "—"}
                  />
                  <DetailField
                    label="Input lot"
                    value={
                      run.inputLot ? (
                        <Link
                          href={`/lots/${run.inputLotId}`}
                          className="text-[var(--frappe-primary)] hover:underline"
                        >
                          {run.inputLot.code}
                        </Link>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <DetailField
                    label="Input kg"
                    value={formatQty(run.quantityInput)}
                  />
                  <DetailField
                    label="Expected yield"
                    value={`${formatQty(run.expectedYieldPercent)}%`}
                  />
                  <DetailField
                    label="Actual yield"
                    value={
                      run.actualYieldPercent
                        ? `${formatQty(run.actualYieldPercent)}%`
                        : "—"
                    }
                  />
                  <DetailField
                    label="Output lot"
                    value={
                      run.outputLot ? (
                        <Link
                          href={`/lots/${run.outputLotId}`}
                          className="font-medium text-[var(--frappe-primary)] hover:underline"
                        >
                          {run.outputLot.code}
                        </Link>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <DetailField
                    label="Output kg"
                    value={
                      run.quantityOutput
                        ? formatQty(run.quantityOutput)
                        : "—"
                    }
                  />
                  <DetailField
                    label="Reject kg"
                    value={formatQty(run.quantityReject)}
                  />
                  <DetailField
                    label="Process cost"
                    value={formatMoney(run.processCost)}
                  />
                  <DetailField
                    label="Started"
                    value={formatDate(run.startedAt ?? undefined)}
                  />
                  <DetailField
                    label="Completed"
                    value={formatDate(run.completedAt ?? undefined)}
                  />
                </FrappeFormGrid>
              </FrappeSection>

              <FrappeSection title="Stages">
                {(run.stages?.length ?? 0) === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--csolve-text-muted)]">
                    No staged checklist — go straight to QC / complete.
                  </p>
                ) : (
                  <ol className="space-y-2 px-4 py-3">
                    {run.stages.map((stage, index) => {
                      const done = (run.stagesCompleted ?? []).includes(stage);
                      const current =
                        index === run.currentStageIndex &&
                        run.status === "IN_PROGRESS";
                      return (
                        <li
                          key={`${stage}-${index}`}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                            done
                              ? "border-[var(--csolve-leaf)]/40 bg-[var(--csolve-leaf)]/10"
                              : current
                                ? "border-[var(--csolve-roast)]/40 bg-[var(--csolve-roast)]/10"
                                : "border-[var(--csolve-border)]"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                              done
                                ? "bg-[var(--csolve-leaf)] text-white"
                                : "bg-[var(--csolve-section)] text-[var(--csolve-text-muted)]"
                            )}
                          >
                            {index + 1}
                          </span>
                          <span className="font-medium text-[var(--csolve-text)]">
                            {stage}
                          </span>
                          <span className="ml-auto text-xs text-[var(--csolve-text-muted)]">
                            {done ? "Done" : current ? "Current" : "Pending"}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </FrappeSection>

              <FrappeSection
                title="QC results"
                description={`${run.qcResults?.length ?? 0} record(s)`}
              >
                {(run.qcResults?.length ?? 0) === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--csolve-text-muted)]">
                    No QC recorded yet.
                  </p>
                ) : (
                  <table className="frappe-list-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Moisture</th>
                        <th>Defects</th>
                        <th>Cupping</th>
                        <th>Result</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(run.qcResults ?? []).map((qc) => (
                        <tr key={qc.id}>
                          <td>{formatDate(qc.createdAt)}</td>
                          <td>{qc.moisturePercent ?? "—"}</td>
                          <td>{qc.defectCount ?? "—"}</td>
                          <td>{qc.cuppingScore ?? "—"}</td>
                          <td>
                            <Badge variant="outline">
                              {qc.passed ? "Pass" : "Fail"}
                            </Badge>
                          </td>
                          <td>{qc.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </FrappeSection>
            </FrappeDocument>

            <Dialog open={qcOpen} onOpenChange={setQcOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record QC</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid gap-1.5">
                    <Label>Moisture %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={moisture}
                      onChange={(e) => setMoisture(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Defect count</Label>
                    <Input
                      type="number"
                      min={0}
                      value={defects}
                      onChange={(e) => setDefects(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Cupping score</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={cupping}
                      onChange={(e) => setCupping(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded border border-[var(--csolve-border)] px-3 py-2">
                    <Label>Passed</Label>
                    <Switch checked={passed} onCheckedChange={setPassed} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Notes</Label>
                    <Textarea
                      value={qcNotes}
                      onChange={(e) => setQcNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <FrappeButtonSecondary
                    type="button"
                    onClick={() => setQcOpen(false)}
                  >
                    Cancel
                  </FrappeButtonSecondary>
                  <FrappeButtonPrimary
                    type="button"
                    disabled={busy}
                    onClick={() => void submitQc()}
                  >
                    Save QC
                  </FrappeButtonPrimary>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Complete with yield</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid gap-1.5">
                    <Label>Output quantity (kg)</Label>
                    <Input
                      type="number"
                      min={0.001}
                      step="0.001"
                      value={qtyOut}
                      onChange={(e) => setQtyOut(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Reject / loss (kg)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      value={qtyReject}
                      onChange={(e) => setQtyReject(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Output grade</Label>
                    <Input
                      value={outGrade}
                      onChange={(e) => setOutGrade(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Notes</Label>
                    <Textarea
                      value={completeNotes}
                      onChange={(e) => setCompleteNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <FrappeButtonSecondary
                    type="button"
                    onClick={() => setCompleteOpen(false)}
                  >
                    Cancel
                  </FrappeButtonSecondary>
                  <FrappeButtonPrimary
                    type="button"
                    disabled={busy}
                    onClick={() => void submitComplete()}
                  >
                    Complete
                  </FrappeButtonPrimary>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </PermissionGate>
    </AppShell>
  );
}
