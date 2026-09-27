"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeButtonPrimary,
  FrappeFilterBar,
  FrappeListToolbar,
} from "@/components/frappe";
import { ListSearchField } from "@/components/shared/list-search-field";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ProcessReportPanel } from "@/components/process-runs/process-overview";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { buildProcessRunsListPath } from "@/lib/list-query";
import { errorMessage, formatDate, formatQty } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import {
  PROCESS_STAGE_OPTIONS,
  PROCESS_STATUS_OPTIONS,
  PROCESS_WORKFLOW_OPTIONS,
  currentProcessStage,
  processStageLabel,
  processStatusClass,
  processStatusLabel,
  processWorkflowLabel,
  type ProcessOverview,
} from "@/lib/process-runs";
import type { ProcessRun, ProcessRunStatus } from "@/lib/types";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

const ALL = "__all__";

export default function ProcessRunsPage() {
  const { user } = useAuth();
  const canDelete = hasPermission(user, "process.write");
  const [tab, setTab] = useState("runs");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProcessRunStatus | "">("");
  const [stage, setStage] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [locationId, setLocationId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data: locations } = useLocations();

  const { rows, meta, setPage, setLimit, loading, reload } =
    usePaginatedList<ProcessRun>(
      (page, limit) =>
        buildProcessRunsListPath(
          {
            search: debouncedSearch || undefined,
            status: status || undefined,
            stage: stage || undefined,
            workflow: workflow || undefined,
            locationId: locationId || undefined,
            from: from || undefined,
            to: to || undefined,
          },
          page,
          limit
        ),
      [debouncedSearch, status, stage, workflow, locationId, from, to]
    );

  const summaryQuery = new URLSearchParams();
  if (workflow) summaryQuery.set("workflow", workflow);
  if (locationId) summaryQuery.set("locationId", locationId);
  if (from) summaryQuery.set("from", from);
  if (to) summaryQuery.set("to", to);
  const summaryPath = `/process-runs/summary${
    summaryQuery.size ? `?${summaryQuery.toString()}` : ""
  }`;
  const { data: overview, loading: overviewLoading, reload: reloadOverview } =
    useFetch(() => api<ProcessOverview>(summaryPath), [summaryPath]);

  return (
    <AppShell
      title="Processing"
      subtitle="Track coffee from cleaning through roast and ground into the sales store."
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Processing" },
      ]}
      actions={
        <PermissionGate permission="process.write">
          <FrappeButtonPrimary asChild>
            <Link href="/process-runs/new">
              <PlusIcon className="size-3.5" />
              New run
            </Link>
          </FrappeButtonPrimary>
        </PermissionGate>
      }
    >
      <PermissionGate permission="process.read">
        <FrappeFilterBar className="items-end">
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search run, template, lot…"
          />
          <FilterSelect
            label="Stage"
            value={stage}
            onChange={setStage}
            allLabel="All stages"
            options={PROCESS_STAGE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as ProcessRunStatus | "")}
            allLabel="All statuses"
            options={PROCESS_STATUS_OPTIONS}
          />
          <FilterSelect
            label="Workflow"
            value={workflow}
            onChange={setWorkflow}
            allLabel="All workflows"
            options={PROCESS_WORKFLOW_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <FilterSelect
            label="Location"
            value={locationId}
            onChange={setLocationId}
            allLabel="All locations"
            options={(locations ?? []).map((location) => ({
              value: location.id,
              label: location.name,
            }))}
          />
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
        </FrappeFilterBar>

        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="report">Summary report</TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="mt-2">
            <FrappeListToolbar>
              <span className="text-[var(--frappe-text-muted)]">
                {meta.total} run{meta.total === 1 ? "" : "s"}
              </span>
            </FrappeListToolbar>
            {loading ? (
              <PageLoading />
            ) : (
              <DataCardTable
                rows={rows}
                emptyTitle="No process runs"
                emptyDescription="Create a run and choose Local market or Export."
                pagination={{
                  meta,
                  onPageChange: setPage,
                  onLimitChange: setLimit,
                  disabled: loading,
                }}
                columns={[
                  {
                    key: "run",
                    header: "Run",
                    cell: (r) => (
                      <Link
                        href={`/process-runs/${r.id}`}
                        className="font-medium text-[var(--frappe-primary)] hover:underline"
                      >
                        {r.runNumber}
                      </Link>
                    ),
                  },
                  {
                    key: "workflow",
                    header: "Workflow",
                    cell: (r) =>
                      r.workflow
                        ? processWorkflowLabel(r.workflow)
                        : (r.template?.name ?? "—"),
                  },
                  {
                    key: "stage",
                    header: "Stage",
                    cell: (r) => {
                      const current = currentProcessStage(r);
                      if (current) return processStageLabel(current);
                      if (r.status === "COMPLETED") return "Finished";
                      return "—";
                    },
                  },
                  {
                    key: "input",
                    header: "Input lot",
                    cell: (r) =>
                      r.inputLot ? (
                        <Link
                          href={`/lots/${r.inputLotId}`}
                          className="text-[var(--frappe-primary)] hover:underline"
                        >
                          {r.inputLot.code}
                        </Link>
                      ) : (
                        "—"
                      ),
                  },
                  {
                    key: "qty",
                    header: "Input kg",
                    cell: (r) => formatQty(r.quantityInput),
                  },
                  {
                    key: "yield",
                    header: "Yield %",
                    cell: (r) =>
                      r.actualYieldPercent
                        ? `${formatQty(r.actualYieldPercent)}%`
                        : `~${formatQty(r.expectedYieldPercent)}%`,
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (r) => (
                      <Badge className={processStatusClass(r.status)}>
                        {processStatusLabel(r.status)}
                      </Badge>
                    ),
                  },
                  {
                    key: "date",
                    header: "Created",
                    cell: (r) => formatDate(r.createdAt),
                  },
                  ...(canDelete
                    ? [
                        {
                          key: "delete",
                          header: "",
                          className: "w-12",
                          cell: (r: ProcessRun) => (
                            <DeleteRunButton
                              run={r}
                              onDeleted={() => {
                                reload();
                                void reloadOverview();
                              }}
                            />
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </TabsContent>

          <TabsContent value="report" className="mt-2">
            {overviewLoading ? (
              <PageLoading />
            ) : overview ? (
              <ProcessReportPanel
                overview={overview}
                onSelectStage={(next) => {
                  setStage(next);
                  setPage(1);
                  setTab("runs");
                }}
              />
            ) : (
              <p className="text-sm text-[var(--frappe-text-muted)]">
                Summary report is unavailable.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </PermissionGate>
    </AppShell>
  );
}

function DeleteRunButton({
  run,
  onDeleted,
}: {
  run: ProcessRun;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await api(`/process-runs/${run.id}`, { method: "DELETE" });
      toast.success(`${run.runNumber} deleted`);
      setOpen(false);
      onDeleted();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4" />
        <span className="sr-only">Delete {run.runNumber}</span>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {run.runNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              Coffee taken for this run goes back to stock. Lots this run
              created are removed when nothing has been sold from them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep run</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm text-[var(--frappe-text-muted)]">{label}</Label>
      <Select
        value={value || ALL}
        onValueChange={(next) => onChange(next === ALL ? "" : next)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
