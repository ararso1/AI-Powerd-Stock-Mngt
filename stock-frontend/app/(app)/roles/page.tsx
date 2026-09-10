"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { FrappeButtonPrimary, FrappeField, FrappeFilterBar } from "@/components/frappe";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { buildRolesListPath } from "@/lib/list-query";
import {
  normalizeRolePermissions,
  rolePermissionCodes,
  rolePermissionIdsFromRole,
} from "@/lib/role-permissions";
import type { Permission, Role } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";

function permissionModule(code: string): string {
  const dot = code.indexOf(".");
  return dot > 0 ? code.slice(0, dot) : code;
}

function groupPermissions(permissions: Permission[]) {
  const groups = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const groupKey = permissionModule(permission.code);
    const list = groups.get(groupKey) ?? [];
    list.push(permission);
    groups.set(groupKey, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([groupKey, items]) => ({
      groupKey,
      items: items.sort((a, b) => a.code.localeCompare(b.code)),
    }));
}

export default function RolesPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { rows, meta, setPage, setLimit, loading, reload } = usePaginatedList<Role>(
    (page, limit) =>
      buildRolesListPath(
        {
          from: from || undefined,
          to: to || undefined,
          search: debouncedSearch || undefined,
        },
        page,
        limit
      ),
    [from, to, debouncedSearch]
  );

  return (
    <AppShell
      title="Roles"
      actions={
        <PermissionGate permission="roles.write">
          <RoleDialog mode="create" onSuccess={reload} />
        </PermissionGate>
      }
    >
      <PermissionGate permission="roles.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search roles..."
          />
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
        </FrappeFilterBar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="No roles"
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
            }}
            columns={[
              { key: "name", header: "Name", cell: (r) => r.name },
              {
                key: "desc",
                header: "Description",
                cell: (r) => r.description ?? "—",
              },
              {
                key: "perms",
                header: "Permissions",
                cell: (r) => (
                  <div className="flex max-w-xl flex-wrap gap-1">
                    {normalizeRolePermissions(r.permissions)
                      .slice(0, 6)
                      .map((p) => (
                        <Badge
                          key={p.id ?? p.code}
                          variant="secondary"
                          className="text-xs"
                        >
                          {p.code}
                        </Badge>
                      ))}
                    {(r.permissions?.length ?? 0) > 6 ? (
                      <Badge variant="outline">
                        +{(r.permissions?.length ?? 0) - 6} more
                      </Badge>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "actions",
                header: "",
                className: "w-24 text-right",
                cell: (r) => (
                  <PermissionGate permission="roles.write">
                    <div className="flex justify-end gap-1">
                      <RoleDialog mode="edit" role={r} onSuccess={reload} />
                      <DeleteRoleButton role={r} onSuccess={reload} />
                    </div>
                  </PermissionGate>
                ),
              },
            ]}
          />
        )}
      </PermissionGate>
    </AppShell>
  );
}

function RoleDialog({
  mode,
  role,
  onSuccess,
}: {
  mode: "create" | "edit";
  role?: Role;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permSearch, setPermSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: catalog } = useFetch(
    () => api<Permission[]>("/permissions"),
    []
  );

  const filteredCatalog = useMemo(() => {
    const term = permSearch.trim().toLowerCase();
    const list = catalog ?? [];
    if (!term) return list;
    return list.filter(
      (p) =>
        p.code.toLowerCase().includes(term) ||
        (p.description?.toLowerCase().includes(term) ?? false)
    );
  }, [catalog, permSearch]);

  const permissionGroups = useMemo(
    () => groupPermissions(filteredCatalog),
    [filteredCatalog]
  );

  function syncFormState() {
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setPermSearch("");
    if (mode === "edit" && role && catalog?.length) {
      setSelectedIds(
        new Set(rolePermissionIdsFromRole(role.permissions, catalog))
      );
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      syncFormState();
    }
  }

  function togglePermission(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleModule(modulePermissions: Permission[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const permission of modulePermissions) {
        if (checked) next.add(permission.id);
        else next.delete(permission.id);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name,
        description: description || undefined,
        permissionIds: Array.from(selectedIds),
      };
      if (mode === "create") {
        await api("/roles", { method: "POST", body });
        toast.success("Role created");
      } else if (role) {
        await api(`/roles/${role.id}`, { method: "PATCH", body });
        toast.success("Role updated");
      }
      setOpen(false);
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = selectedIds.size;
  const totalCount = catalog?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <FrappeButtonPrimary type="button">
            <PlusIcon className="size-3.5" />
            Add role
          </FrappeButtonPrimary>
        ) : (
          <Button type="button" variant="ghost" size="icon" className="size-8">
            <PencilIcon className="size-4" />
            <span className="sr-only">Edit</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0 border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-5 py-4">
            <DialogTitle className="text-base font-semibold">
              {mode === "create" ? "New role" : `Edit ${role?.name}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--frappe-text-muted)]">
              {mode === "create"
                ? "Create a role and choose which permissions users with this role receive."
                : "Update the role name, description, or permission set. Saving replaces all assigned permissions."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FrappeField label="Name" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Warehouse Manager"
                  required
                />
              </FrappeField>
              <FrappeField label="Description">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional summary"
                />
              </FrappeField>
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--frappe-border)]">
              <div className="border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--frappe-text)]">
                      Permissions
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--frappe-text-muted)]">
                      {selectedCount} of {totalCount} selected
                    </p>
                  </div>
                  <div className="relative min-w-[180px] flex-1 sm:max-w-[240px]">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[var(--frappe-text-muted)]" />
                    <Input
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder="Search permissions…"
                      className="h-8 pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="max-h-[min(40vh,320px)] overflow-y-auto overscroll-contain">
                {permissionGroups.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-[var(--frappe-text-muted)]">
                    {catalog?.length
                      ? "No permissions match your search."
                      : "Loading permissions…"}
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--frappe-border)]">
                    {permissionGroups.map(({ groupKey, items }) => {
                      const moduleSelected = items.filter((p) =>
                        selectedIds.has(p.id)
                      ).length;
                      const moduleChecked =
                        moduleSelected === items.length && items.length > 0;
                      const moduleIndeterminate =
                        moduleSelected > 0 && moduleSelected < items.length;

                      return (
                        <div key={groupKey} className="px-4 py-3">
                          <label className="mb-2 flex cursor-pointer items-center gap-2">
                            <Checkbox
                              checked={
                                moduleIndeterminate
                                  ? "indeterminate"
                                  : moduleChecked
                              }
                              onCheckedChange={(checked) =>
                                toggleModule(items, checked === true)
                              }
                            />
                            <span className="text-xs font-semibold tracking-wide text-[var(--frappe-text-muted)] uppercase">
                              {groupKey}
                            </span>
                            <span className="text-xs text-[var(--frappe-text-muted)]">
                              ({moduleSelected}/{items.length})
                            </span>
                          </label>
                          <div className="space-y-2 pl-6">
                            {items.map((p) => (
                              <label
                                key={p.id}
                                className="flex cursor-pointer items-start gap-2 rounded-sm py-0.5 text-sm hover:bg-[var(--frappe-section-head)]/60"
                              >
                                <Checkbox
                                  checked={selectedIds.has(p.id)}
                                  onCheckedChange={() => togglePermission(p.id)}
                                />
                                <span className="min-w-0">
                                  <span className="font-mono text-xs text-[var(--frappe-text)]">
                                    {p.code}
                                  </span>
                                  {p.description ? (
                                    <span className="mt-0.5 block text-xs text-[var(--frappe-text-muted)]">
                                      {p.description}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {mode === "edit" && role?.permissions?.length ? (
              <p className="text-xs text-[var(--frappe-text-muted)]">
                Previously assigned:{" "}
                {rolePermissionCodes(role.permissions).join(", ")}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-0 shrink-0 gap-2 border-t border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-5 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <FrappeButtonPrimary type="submit" disabled={saving}>
              {saving
                ? mode === "create"
                  ? "Creating…"
                  : "Saving…"
                : mode === "create"
                  ? "Create role"
                  : "Save changes"}
            </FrappeButtonPrimary>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRoleButton({
  role,
  onSuccess,
}: {
  role: Role;
  onSuccess: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `Delete role "${role.name}"? Users assigned to this role may lose access.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api(`/roles/${role.id}`, { method: "DELETE" });
      toast.success("Role deleted");
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-destructive"
      disabled={deleting}
      onClick={handleDelete}
    >
      <Trash2Icon className="size-4" />
      <span className="sr-only">Delete</span>
    </Button>
  );
}
