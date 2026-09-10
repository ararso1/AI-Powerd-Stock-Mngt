"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeButtonPrimary,
  FrappeFilterBar,
  FrappeField,
  FrappeFormGrid,
} from "@/components/frappe";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { buildRoastProfilesListPath } from "@/lib/list-query";
import { errorMessage } from "@/lib/format";
import type { RoastProfile } from "@/lib/types";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

export default function RoastProfilesPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { rows, meta, setPage, setLimit, loading, reload } =
    usePaginatedList<RoastProfile>(
      (page, limit) =>
        buildRoastProfilesListPath(
          { search: debouncedSearch || undefined },
          page,
          limit
        ),
      [debouncedSearch]
    );

  return (
    <AppShell
      title="Roast profiles"
      subtitle="Curves and shelf life for local roast batches"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Roast profiles" },
      ]}
      actions={
        <PermissionGate permission="process.write">
          <CreateProfileDialog onSuccess={reload} />
        </PermissionGate>
      }
    >
      <PermissionGate permission="process.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search profiles…"
          />
        </FrappeFilterBar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="No roast profiles"
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={[
              { key: "code", header: "Code", cell: (r) => r.code },
              { key: "name", header: "Name", cell: (r) => r.name },
              {
                key: "level",
                header: "Level",
                cell: (r) => r.roastLevel ?? "—",
              },
              {
                key: "agtron",
                header: "Agtron",
                cell: (r) => r.targetAgtron ?? "—",
              },
              {
                key: "duration",
                header: "Minutes",
                cell: (r) => r.durationMinutes ?? "—",
              },
              {
                key: "shelf",
                header: "Shelf days",
                cell: (r) => r.shelfLifeDays ?? "—",
              },
              {
                key: "blend",
                header: "Blend notes",
                cell: (r) => r.blendNotes ?? "—",
              },
            ]}
          />
        )}
      </PermissionGate>
    </AppShell>
  );
}

function CreateProfileDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [roastLevel, setRoastLevel] = useState("Medium");
  const [shelfLifeDays, setShelfLifeDays] = useState("90");
  const [blendNotes, setBlendNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/roast-profiles", {
        method: "POST",
        body: {
          code: code.trim(),
          name: name.trim(),
          roastLevel: roastLevel.trim() || undefined,
          shelfLifeDays: parseInt(shelfLifeDays, 10) || 90,
          blendNotes: blendNotes.trim() || undefined,
        },
      });
      toast.success("Profile created");
      setOpen(false);
      setCode("");
      setName("");
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <FrappeButtonPrimary type="button">
          <PlusIcon className="size-3.5" />
          New profile
        </FrappeButtonPrimary>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New roast profile</DialogTitle>
          </DialogHeader>
          <FrappeFormGrid columns={2} className="py-4">
            <FrappeField label="Code" required>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </FrappeField>
            <FrappeField label="Name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </FrappeField>
            <FrappeField label="Roast level">
              <Input
                value={roastLevel}
                onChange={(e) => setRoastLevel(e.target.value)}
              />
            </FrappeField>
            <FrappeField label="Shelf life (days)">
              <Input
                type="number"
                value={shelfLifeDays}
                onChange={(e) => setShelfLifeDays(e.target.value)}
              />
            </FrappeField>
            <FrappeField label="Blend notes" fullWidth>
              <Input
                value={blendNotes}
                onChange={(e) => setBlendNotes(e.target.value)}
              />
            </FrappeField>
          </FrappeFormGrid>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <FrappeButtonPrimary type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </FrappeButtonPrimary>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
