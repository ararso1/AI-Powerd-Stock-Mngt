"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FrappeFilterBar } from "@/components/frappe";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLocations } from "@/hooks/use-locations";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { apiList } from "@/lib/list-response";
import { errorMessage, formatMoney } from "@/lib/format";
import { buildUsersListPath } from "@/lib/list-query";
import type {
  EmploymentStatus,
  EmploymentType,
  Role,
  UserAdmin,
} from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "CASUAL", label: "Casual" },
];

const EMPLOYMENT_STATUSES: { value: EmploymentStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "TERMINATED", label: "Terminated" },
];

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { rows, meta, setPage, setLimit, loading, reload } =
    usePaginatedList<UserAdmin>(
      (page, limit) =>
        buildUsersListPath(
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
      title="People & HR"
      subtitle="Manage staff login access, roles, warehouses, and basic HR records"
      actions={
        <PermissionGate permission="users.write">
          <UserDialog mode="create" onSuccess={reload} />
        </PermissionGate>
      }
    >
      <PermissionGate permission="users.read">
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search name, email, department, code…"
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
            emptyTitle="No people yet"
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
            }}
            columns={[
              {
                key: "name",
                header: "Employee",
                cell: (r) => (
                  <div>
                    <div className="font-medium">{r.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.employeeCode ? `${r.employeeCode} · ` : ""}
                      {r.email}
                    </div>
                  </div>
                ),
              },
              {
                key: "role",
                header: "Role / title",
                cell: (r) => (
                  <div>
                    <div>{r.role?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.designation || "—"}
                    </div>
                  </div>
                ),
              },
              {
                key: "dept",
                header: "Department",
                cell: (r) => r.department || "—",
              },
              {
                key: "warehouse",
                header: "Warehouse",
                cell: (r) =>
                  r.locations?.length
                    ? r.locations.map((l) => l.name).join(", ")
                    : "All locations",
              },
              {
                key: "salary",
                header: "Salary",
                cell: (r) =>
                  r.salary != null
                    ? `${r.salaryCurrency ?? "ETB"} ${formatMoney(r.salary)}`
                    : "—",
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => (
                  <Badge
                    variant={
                      r.employmentStatus === "TERMINATED" || r.isActive === false
                        ? "destructive"
                        : r.employmentStatus === "ON_LEAVE"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {r.employmentStatus ??
                      (r.isActive === false ? "Inactive" : "ACTIVE")}
                  </Badge>
                ),
              },
              {
                key: "actions",
                header: "",
                className: "w-24 text-right",
                cell: (r) => (
                  <PermissionGate permission="users.write">
                    <div className="flex justify-end gap-1">
                      <UserDialog mode="edit" user={r} onSuccess={reload} />
                      <DeleteUserButton user={r} onSuccess={reload} />
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

type FormState = {
  email: string;
  password: string;
  fullName: string;
  roleId: string;
  phone: string;
  employeeCode: string;
  department: string;
  designation: string;
  salary: string;
  salaryCurrency: string;
  hiredAt: string;
  employmentType: string;
  employmentStatus: EmploymentStatus;
  notes: string;
  locationIds: string[];
  isActive: boolean;
};

function emptyForm(user?: UserAdmin): FormState {
  return {
    email: user?.email ?? "",
    password: "",
    fullName: user?.fullName ?? "",
    roleId: user?.role?.id ?? user?.roleId ?? "",
    phone: user?.phone ?? "",
    employeeCode: user?.employeeCode ?? "",
    department: user?.department ?? "",
    designation: user?.designation ?? "",
    salary: user?.salary ?? "",
    salaryCurrency: user?.salaryCurrency ?? "ETB",
    hiredAt: user?.hiredAt?.slice(0, 10) ?? "",
    employmentType: user?.employmentType ?? "",
    employmentStatus: user?.employmentStatus ?? "ACTIVE",
    notes: user?.notes ?? "",
    locationIds: user?.locationIds ?? [],
    isActive: user?.isActive ?? true,
  };
}

function UserDialog({
  mode,
  user,
  onSuccess,
}: {
  mode: "create" | "edit";
  user?: UserAdmin;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(user));
  const [saving, setSaving] = useState(false);
  const { data: roles } = useFetch(() => apiList<Role>("/roles"), []);
  const { data: locations } = useLocations();

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleLocation(id: string) {
    setForm((prev) => {
      const has = prev.locationIds.includes(id);
      return {
        ...prev,
        locationIds: has
          ? prev.locationIds.filter((x) => x !== id)
          : [...prev.locationIds, id],
      };
    });
  }

  function buildBody(includePassword: boolean) {
    const body: Record<string, unknown> = {
      fullName: form.fullName.trim(),
      roleId: form.roleId || undefined,
      phone: form.phone.trim() || null,
      employeeCode: form.employeeCode.trim() || null,
      department: form.department.trim() || null,
      designation: form.designation.trim() || null,
      salary: form.salary.trim() === "" ? null : Number(form.salary),
      salaryCurrency: form.salaryCurrency.trim() || "ETB",
      hiredAt: form.hiredAt || null,
      employmentType: form.employmentType || null,
      employmentStatus: form.employmentStatus,
      notes: form.notes.trim() || null,
      locationIds: form.locationIds,
    };
    if (mode === "create") {
      body.email = form.email.trim();
      body.password = form.password;
    } else {
      body.isActive = form.isActive;
      if (includePassword && form.password) body.password = form.password;
    }
    return body;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === "create") {
        await api("/users", { method: "POST", body: buildBody(true) });
        toast.success("Employee created");
      } else if (user) {
        await api(`/users/${user.id}`, {
          method: "PATCH",
          body: buildBody(true),
        });
        toast.success("Employee updated");
      }
      setOpen(false);
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setForm(emptyForm(user));
      }}
    >
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm">
            <PlusIcon />
            Add person
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="icon" className="size-8">
            <PencilIcon className="size-4" />
            <span className="sr-only">Edit</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "New employee" : `Edit ${user?.fullName}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Account
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label>Full name</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  required={mode === "create"}
                  disabled={mode === "edit"}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>
                  {mode === "create" ? "Password" : "New password (optional)"}
                </Label>
                <PasswordInput
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder={
                    mode === "create"
                      ? "At least 6 characters"
                      : "Leave blank to keep current"
                  }
                  required={mode === "create"}
                  minLength={mode === "create" ? 6 : undefined}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>System role</Label>
                <Select
                  value={form.roleId}
                  onValueChange={(v) => setField("roleId", v)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {(roles ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              HR profile
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Employee code</Label>
                <Input
                  value={form.employeeCode}
                  onChange={(e) => setField("employeeCode", e.target.value)}
                  placeholder="e.g. EMP-0042"
                />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="+251…"
                />
              </div>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setField("department", e.target.value)}
                  placeholder="Operations, Sales, Warehouse…"
                />
              </div>
              <div className="grid gap-2">
                <Label>Designation</Label>
                <Input
                  value={form.designation}
                  onChange={(e) => setField("designation", e.target.value)}
                  placeholder="Head Storekeeper, Team lead…"
                />
              </div>
              <div className="grid gap-2">
                <Label>Employment type</Label>
                <Select
                  value={form.employmentType || "__none__"}
                  onValueChange={(v) =>
                    setField("employmentType", v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    {EMPLOYMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Employment status</Label>
                <Select
                  value={form.employmentStatus}
                  onValueChange={(v) =>
                    setField("employmentStatus", v as EmploymentStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Hire date</Label>
                <Input
                  type="date"
                  value={form.hiredAt}
                  onChange={(e) => setField("hiredAt", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Salary ({form.salaryCurrency || "ETB"})</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.salary}
                  onChange={(e) => setField("salary", e.target.value)}
                  placeholder="Monthly / base"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Assigned warehouse(s)</Label>
              <p className="text-xs text-muted-foreground">
                Leave unchecked for company-wide access. Checked warehouses
                limit operations for this person.
              </p>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                {(locations ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No locations available
                  </p>
                ) : (
                  (locations ?? []).map((loc) => (
                    <label
                      key={loc.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="size-4 rounded border"
                        checked={form.locationIds.includes(loc.id)}
                        onChange={() => toggleLocation(loc.id)}
                      />
                      <span>{loc.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
                placeholder="Internal HR notes…"
              />
            </div>

            {mode === "edit" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  checked={form.isActive}
                  onChange={(e) => setField("isActive", e.target.checked)}
                />
                Can log in to the system
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserButton({
  user,
  onSuccess,
}: {
  user: UserAdmin;
  onSuccess: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `Deactivate "${user.fullName}" (${user.email})? They will no longer be able to log in.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api(`/users/${user.id}`, { method: "DELETE" });
      toast.success("Employee deactivated");
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
      <span className="sr-only">Deactivate</span>
    </Button>
  );
}
