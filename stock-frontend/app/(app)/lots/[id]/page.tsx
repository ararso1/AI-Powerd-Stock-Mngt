"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LotTimeline } from "@/components/lots/lot-timeline";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { errorMessage, formatDate, formatQty } from "@/lib/format";
import { coffeeFormLabel, lotQcPhaseLabel, lotStatusLabel, LOT_QC_PHASE_OPTIONS } from "@/lib/lots";
import type { Lot, LotEvent, LotQcPhase } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
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
      <p className="text-sm text-[var(--frappe-text)]">{value}</p>
    </div>
  );
}

export default function LotDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitQty, setSplitQty] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [qcPhase, setQcPhase] = useState<LotQcPhase>("SAMPLE_TESTED");
  const [qcGrade, setQcGrade] = useState("");
  const [qcMoisture, setQcMoisture] = useState("");
  const [qcScreen, setQcScreen] = useState("");
  const [qcCup, setQcCup] = useState("");
  const [qcDefects, setQcDefects] = useState("");
  const [qcDefectLevel, setQcDefectLevel] = useState("");
  const [qcRejectReason, setQcRejectReason] = useState("");
  const [qcNotes, setQcNotes] = useState("");
  const [qcSaving, setQcSaving] = useState(false);

  const {
    data: lot,
    loading,
    error,
    reload,
  } = useFetch(
    () =>
      id
        ? api<Lot>(`/lots/${id}`)
        : Promise.reject(new Error("Invalid lot id")),
    [id]
  );

  const { data: events, loading: eventsLoading, reload: reloadEvents } =
    useFetch(
      () =>
        id
          ? api<LotEvent[]>(`/lots/${id}/timeline`)
          : Promise.reject(new Error("Invalid lot id")),
      [id]
    );

  async function handleSplit() {
    const qty = parseFloat(splitQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid split quantity");
      return;
    }
    setSplitting(true);
    try {
      const result = await api<{ parent: Lot; child: Lot }>(
        `/lots/${id}/split`,
        { method: "POST", body: { quantity: qty } }
      );
      toast.success(`Split created ${result.child.code}`);
      setSplitOpen(false);
      setSplitQty("");
      await reload();
      await reloadEvents();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSplitting(false);
    }
  }

  async function handleAdvanceQc() {
    setQcSaving(true);
    try {
      await api(`/lots/${id}/qc`, {
        method: "POST",
        body: {
          qcPhase,
          grade: qcGrade.trim() || undefined,
          moisturePercent: qcMoisture ? parseFloat(qcMoisture) : undefined,
          screenSize: qcScreen.trim() || undefined,
          cuppingScore: qcCup ? parseFloat(qcCup) : undefined,
          defectCount: qcDefects ? parseInt(qcDefects, 10) : undefined,
          defectLevel: qcDefectLevel.trim() || undefined,
          rejectReason:
            qcPhase === "REJECTED" ? qcRejectReason.trim() : undefined,
          notes: qcNotes.trim() || undefined,
        },
      });
      toast.success(`QC phase → ${lotQcPhaseLabel(qcPhase)}`);
      await reload();
      await reloadEvents();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setQcSaving(false);
    }
  }

  return (
    <AppShell
      title={loading ? "Lot" : lot?.code ?? "Lot"}
      variant="form"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Lots", href: "/lots" },
        { label: lot?.code ?? (id ? id.slice(0, 8) : "…") },
      ]}
    >
      <PermissionGate permission="lot.read">
        {loading ? (
          <PageLoading />
        ) : error || !lot ? (
          <div className="mx-auto max-w-lg rounded border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
            <p className="font-medium text-[var(--frappe-text)]">Lot not found</p>
            <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
              {error ?? "This record may have been removed."}
            </p>
            <FrappeButtonLink href="/lots" className="mt-4">
              Back to lots
            </FrappeButtonLink>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <FrappeButtonLink href="/lots">← Back to list</FrappeButtonLink>
              <Badge variant="outline" className="ml-auto">
                {lotStatusLabel(lot.status)}
              </Badge>
              <Badge variant="secondary">
                {lotQcPhaseLabel(lot.qcPhase)}
              </Badge>
              <PermissionGate permission="lot.split">
                {lot.status === "ACTIVE" ? (
                  <FrappeButtonSecondary
                    type="button"
                    onClick={() => setSplitOpen(true)}
                  >
                    Split lot
                  </FrappeButtonSecondary>
                ) : null}
              </PermissionGate>
            </div>

            <FrappeDocument>
              <FrappeSection
                title="Lot"
                description={`${coffeeFormLabel(lot.form)} · ${formatQty(lot.quantity)} kg`}
              >
                <FrappeFormGrid columns={3}>
                  <DetailField label="Code" value={lot.code} />
                  <DetailField label="Form" value={coffeeFormLabel(lot.form)} />
                  <DetailField label="Grade" value={lot.grade ?? "—"} />
                  <DetailField label="Crop year" value={lot.cropYear ?? "—"} />
                  <DetailField label="Variety" value={lot.variety ?? "—"} />
                  <DetailField
                    label="Process"
                    value={lot.processMethod ?? "—"}
                  />
                  <DetailField label="Region" value={lot.region ?? "—"} />
                  <DetailField label="Zone" value={lot.zone ?? "—"} />
                  <DetailField label="Woreda" value={lot.woreda ?? "—"} />
                  <DetailField label="Kebele" value={lot.kebele ?? "—"} />
                  <DetailField
                    label="Moisture %"
                    value={lot.moisturePercent ?? "—"}
                  />
                  <DetailField
                    label="Screen size"
                    value={lot.screenSize ?? "—"}
                  />
                  <DetailField
                    label="Cup score"
                    value={lot.cuppingScore ?? "—"}
                  />
                  <DetailField
                    label="Defects"
                    value={
                      lot.defectCount != null || lot.defectLevel
                        ? `${lot.defectCount ?? "—"} / ${lot.defectLevel ?? "—"}`
                        : "—"
                    }
                  />
                  <DetailField
                    label="QC phase"
                    value={lotQcPhaseLabel(lot.qcPhase)}
                  />
                  <DetailField
                    label="Inspector"
                    value={lot.inspector?.fullName ?? "—"}
                  />
                  <DetailField
                    label="Inspected"
                    value={formatDate(lot.inspectedAt ?? undefined)}
                  />
                  {lot.qcPhase === "REJECTED" || lot.form === "REJECT" ? (
                    <>
                      <DetailField
                        label="Reject %"
                        value={lot.rejectPercent ?? "—"}
                      />
                      <DetailField
                        label="Reject reason"
                        value={lot.rejectReason ?? "—"}
                      />
                      <DetailField
                        label="Reject action"
                        value={lot.rejectAction ?? "—"}
                      />
                    </>
                  ) : null}
                  <DetailField
                    label="Location"
                    value={lot.location?.name ?? "—"}
                  />
                  <DetailField
                    label="Catalog item"
                    value={lot.item?.description ?? "—"}
                  />
                  <DetailField
                    label="Parent lot"
                    value={
                      lot.parentLot ? (
                        <Link
                          href={`/lots/${lot.parentLot.id}`}
                          className="text-[var(--frappe-primary)] hover:underline"
                        >
                          {lot.parentLot.code}
                        </Link>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <DetailField
                    label="Created"
                    value={formatDate(lot.createdAt)}
                  />
                  <DetailField label="Notes" value={lot.notes ?? "—"} />
                </FrappeFormGrid>
              </FrappeSection>

              <FrappeSection
                title="Grading & quality"
                description="Received → Sample tested → Graded → Accepted / Rejected → Processed → Final grade"
              >
                <PermissionGate permission="lot.write">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <Label>Advance to phase</Label>
                      <Select
                        value={qcPhase}
                        onValueChange={(v) => setQcPhase(v as LotQcPhase)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOT_QC_PHASE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Grade</Label>
                      <Input
                        value={qcGrade}
                        onChange={(e) => setQcGrade(e.target.value)}
                        placeholder={lot.grade ?? "G1"}
                      />
                    </div>
                    <div>
                      <Label>Moisture %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={qcMoisture}
                        onChange={(e) => setQcMoisture(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Screen size</Label>
                      <Input
                        value={qcScreen}
                        onChange={(e) => setQcScreen(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Cup score</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={qcCup}
                        onChange={(e) => setQcCup(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Defect count</Label>
                      <Input
                        type="number"
                        value={qcDefects}
                        onChange={(e) => setQcDefects(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Defect level</Label>
                      <Input
                        value={qcDefectLevel}
                        onChange={(e) => setQcDefectLevel(e.target.value)}
                      />
                    </div>
                    {qcPhase === "REJECTED" ? (
                      <div className="sm:col-span-2">
                        <Label>Rejection reason</Label>
                        <Input
                          value={qcRejectReason}
                          onChange={(e) => setQcRejectReason(e.target.value)}
                          required
                        />
                      </div>
                    ) : null}
                    <div className="sm:col-span-2 lg:col-span-3">
                      <Label>Notes</Label>
                      <Input
                        value={qcNotes}
                        onChange={(e) => setQcNotes(e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <FrappeButtonPrimary
                        type="button"
                        disabled={qcSaving}
                        onClick={() => void handleAdvanceQc()}
                      >
                        {qcSaving ? "Saving…" : "Record quality step"}
                      </FrappeButtonPrimary>
                    </div>
                  </div>
                </PermissionGate>
              </FrappeSection>

              <FrappeSection
                title="Timeline"
                description={
                  eventsLoading
                    ? "Loading steps…"
                    : `${events?.length ?? 0} step${(events?.length ?? 0) === 1 ? "" : "s"}`
                }
              >
                {eventsLoading ? (
                  <PageLoading />
                ) : (
                  <LotTimeline events={events ?? []} />
                )}
              </FrappeSection>
            </FrappeDocument>

            <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Split {lot.code}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2 py-2">
                  <Label>Quantity to split (kg)</Label>
                  <Input
                    type="number"
                    min={0.001}
                    step="0.001"
                    max={parseFloat(lot.quantity) - 0.001}
                    value={splitQty}
                    onChange={(e) => setSplitQty(e.target.value)}
                    placeholder={`Less than ${lot.quantity}`}
                  />
                  <p className="text-xs text-[var(--csolve-text-muted)]">
                    Creates a child lot and records SPLIT events on both
                    timelines.
                  </p>
                </div>
                <DialogFooter>
                  <FrappeButtonSecondary
                    type="button"
                    onClick={() => setSplitOpen(false)}
                  >
                    Cancel
                  </FrappeButtonSecondary>
                  <FrappeButtonPrimary
                    type="button"
                    disabled={splitting}
                    onClick={() => void handleSplit()}
                  >
                    Split
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
