"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
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
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { apiList } from "@/lib/list-response";
import { errorMessage } from "@/lib/format";
import { buildUsersListPath } from "@/lib/list-query";
import type { Role, UserAdmin } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { rows, meta, setPage, setLimit, loading, reload } = usePaginatedList<UserAdmin>(
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
      title="Users"
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
            placeholder="Search users..."
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
            emptyTitle="No users"
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
            }}
            columns={[
              { key: "name", header: "Name", cell: (r) => r.fullName },
              { key: "email", header: "Email", cell: (r) => r.email },
              {
                key: "role",
                header: "Role",
                cell: (r) => r.role?.name ?? "—",
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
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [roleId, setRoleId] = useState(user?.role?.id ?? "");
  const [saving, setSaving] = useState(false);
  const { data: roles } = useFetch(() => apiList<Role>("/roles"), []);

  function resetForm() {
    setEmail(user?.email ?? "");
    setPassword("");
    setFullName(user?.fullName ?? "");
    setRoleId(user?.role?.id ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === "create") {
        await api("/users", {
          method: "POST",
          body: { email, password, fullName, roleId },
        });
        toast.success("User created");
      } else if (user) {
        const body: Record<string, string> = { fullName, roleId };
        if (password) body.password = password;
        await api(`/users/${user.id}`, { method: "PATCH", body });
        toast.success("User updated");
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
        if (next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm">
            <PlusIcon />
            Add user
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="icon" className="size-8">
            <PencilIcon className="size-4" />
            <span className="sr-only">Edit</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "New user" : `Edit ${user?.fullName}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            {mode === "create" ? (
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={email} disabled />
              </div>
            )}
            <div className="grid gap-2">
              <Label>
                {mode === "create" ? "Password" : "New password (optional)"}
              </Label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "create"
                    ? "At least 8 characters"
                    : "Leave blank to keep current"
                }
                required={mode === "create"}
                minLength={mode === "create" ? 8 : undefined}
              />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={roleId} onValueChange={setRoleId} required>
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
    if (!confirm(`Delete user "${user.fullName}" (${user.email})?`)) return;
    setDeleting(true);
    try {
      await api(`/users/${user.id}`, { method: "DELETE" });
      toast.success("User deleted");
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
