"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFetch } from "@/hooks/use-fetch";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorMessage, formatDate } from "@/lib/format";
import { hasAnyPermission } from "@/lib/permissions";
import type { ApprovalRequest } from "@/lib/types";
import { toast } from "sonner";

function entityHref(req: ApprovalRequest): string | null {
  switch (req.entityType) {
    case "PURCHASE":
      return `/purchases/${req.entityId}`;
    case "SALE":
      return `/sales/${req.entityId}`;
    case "PROCESS_RUN":
      return `/process-runs/${req.entityId}`;
    default:
      return null;
  }
}

function entityLabel(req: ApprovalRequest): string {
  const meta = req.metadata ?? {};
  const ref =
    (meta.reference as string) ||
    (meta.invoiceNumber as string) ||
    (meta.runNumber as string) ||
    req.entityId.slice(0, 8);
  switch (req.entityType) {
    case "PURCHASE":
      return `Purchase ${ref}`;
    case "SALE":
      return `Sale ${ref}`;
    case "PROCESS_RUN":
      return `Process ${ref}`;
    default:
      return ref;
  }
}

function statusBadge(status: string) {
  const variant =
    status === "APPROVED"
      ? "default"
      : status === "REJECTED"
        ? "destructive"
        : status === "PENDING"
          ? "secondary"
          : "outline";
  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>;
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const canDecide = hasAnyPermission(user, [
    "approvals.decide",
    "purchase.approve",
    "sales.approve",
    "process.approve",
  ]);

  const {
    data: pending,
    loading: pendingLoading,
    reload: reloadPending,
  } = useFetch(
    () => api<{ data: ApprovalRequest[] }>("/approvals/pending"),
    []
  );
  const {
    data: mine,
    loading: mineLoading,
    reload: reloadMine,
  } = useFetch(
    () => api<{ data: ApprovalRequest[] }>("/approvals/mine"),
    []
  );

  const [decisionTarget, setDecisionTarget] = useState<{
    id: string;
    decision: "approve" | "reject";
  } | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(() => {
    reloadPending();
    reloadMine();
  }, [reloadPending, reloadMine]);

  async function submitDecision() {
    if (!decisionTarget) return;
    setSubmitting(true);
    try {
      await api(`/approvals/${decisionTarget.id}/decide`, {
        method: "POST",
        body: {
          decision: decisionTarget.decision,
          comment: comment.trim() || undefined,
        },
      });
      toast.success(
        decisionTarget.decision === "approve"
          ? "Approved successfully"
          : "Rejected"
      );
      setDecisionTarget(null);
      setComment("");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function renderList(rows: ApprovalRequest[] | undefined, empty: string) {
    if (!rows?.length) {
      return (
        <p className="text-sm text-muted-foreground py-8 text-center">{empty}</p>
      );
    }
    return (
      <ul className="divide-y rounded-md border">
        {rows.map((req) => {
          const href = entityHref(req);
          const pendingSteps = (req.steps ?? []).filter(
            (s) => s.status === "PENDING"
          );
          return (
            <li key={req.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {href ? (
                      <Link
                        href={href}
                        className="font-medium hover:underline"
                      >
                        {entityLabel(req)}
                      </Link>
                    ) : (
                      <span className="font-medium">{entityLabel(req)}</span>
                    )}
                    {statusBadge(req.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Initiated by {req.initiatedBy?.fullName ?? "—"} ·{" "}
                    {formatDate(req.createdAt)}
                  </p>
                </div>
                {canDecide && req.status === "PENDING" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setDecisionTarget({ id: req.id, decision: "approve" })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        setDecisionTarget({ id: req.id, decision: "reject" })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {(req.steps ?? []).map((step) => (
                  <Badge
                    key={step.id}
                    variant={
                      step.status === "APPROVED"
                        ? "default"
                        : step.status === "REJECTED"
                          ? "destructive"
                          : "outline"
                    }
                    className="font-normal"
                  >
                    {step.requiredRoleName}: {step.status.replace(/_/g, " ")}
                    {step.decidedBy
                      ? ` (${step.decidedBy.fullName})`
                      : ""}
                  </Badge>
                ))}
              </div>
              {pendingSteps.length > 0 && req.status === "PENDING" ? (
                <p className="text-xs text-muted-foreground">
                  Waiting on:{" "}
                  {pendingSteps.map((s) => s.requiredRoleName).join(", ")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <PermissionGate
      permissions={[
        "approvals.read",
        "approvals.decide",
        "purchase.approve",
        "sales.approve",
        "process.approve",
      ]}
    >
      <AppShell
        title="Approvals"
        subtitle="Review pending purchases, sales, and cleaning process runs. Stock changes only after required approvals."
      >
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending for me</TabsTrigger>
            <TabsTrigger value="mine">My submissions</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            {pendingLoading ? (
              <PageLoading />
            ) : (
              renderList(
                pending?.data,
                "No approvals waiting for your role."
              )
            )}
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            {mineLoading ? (
              <PageLoading />
            ) : (
              renderList(mine?.data, "You have not submitted any requests.")
            )}
          </TabsContent>
        </Tabs>

        <AlertDialog
          open={!!decisionTarget}
          onOpenChange={(open) => {
            if (!open) {
              setDecisionTarget(null);
              setComment("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {decisionTarget?.decision === "approve"
                  ? "Approve this request?"
                  : "Reject this request?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {decisionTarget?.decision === "approve"
                  ? "Your approval will be recorded. Stock posts only when every required role has approved."
                  : "Rejection stops the workflow. Stock will not change."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              placeholder="Optional comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <Button
                variant={
                  decisionTarget?.decision === "reject"
                    ? "destructive"
                    : "default"
                }
                disabled={submitting}
                onClick={submitDecision}
              >
                {submitting
                  ? "Saving…"
                  : decisionTarget?.decision === "approve"
                    ? "Approve"
                    : "Reject"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AppShell>
    </PermissionGate>
  );
}
