"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeFilterBar,
  FrappeListToolbar,
  FrappeButtonPrimary,
  FrappeField,
  FrappeFormGrid,
  FrappeDocument,
  FrappeSection,
} from "@/components/frappe";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { buildListPath, type ListQueryParams } from "@/lib/list-query";
import { errorMessage } from "@/lib/format";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { toast } from "sonner";
import { PencilIcon, PlusIcon } from "lucide-react";

export interface MasterField {
  name: string;
  label: string;
  type?: "text" | "email" | "textarea" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
}

export function MasterDataPage<
  T extends { id: string; name: string; isActive?: boolean },
>({
  title,
  endpoint,
  readPermission,
  writePermission,
  fields,
  columns,
  emptyDescription,
  supportsActive = false,
  listParams,
  filterExtras,
}: {
  title: string;
  endpoint: string;
  readPermission: string;
  writePermission: string;
  fields: MasterField[];
  columns: { key: string; header: string; cell: (row: T) => React.ReactNode }[];
  emptyDescription?: string;
  supportsActive?: boolean;
  listParams?: ListQueryParams;
  filterExtras?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const listParamsKey = JSON.stringify(listParams ?? {});

  const { rows, meta, setPage, setLimit, loading, reload } = usePaginatedList<T>(
    (page, limit) =>
      buildListPath(endpoint, {
        params: {
          ...listParams,
          search: debouncedSearch || undefined,
        },
        page,
        limit,
      }),
    [endpoint, debouncedSearch, listParamsKey]
  );

  const tableColumns = [
    ...columns,
    {
      key: "actions",
      header: "",
      className: "w-20 text-right",
      cell: (row: T) => (
        <PermissionGate permission={writePermission}>
          <EditDialog
            title={title}
            endpoint={endpoint}
            fields={fields}
            row={row}
            supportsActive={supportsActive}
            onSuccess={reload}
          />
        </PermissionGate>
      ),
    },
  ];

  return (
    <AppShell
      title={title}
      subtitle={`Manage ${title.toLowerCase()}`}
      breadcrumbs={[
        { label: "Stock", href: "/dashboard" },
        { label: title },
      ]}
      actions={
        <PermissionGate permission={writePermission}>
          <CreateDialog
            title={title}
            endpoint={endpoint}
            fields={fields}
            onSuccess={reload}
          />
        </PermissionGate>
      }
    >
      <PermissionGate permission={readPermission}>
        <FrappeFilterBar>
          <ListSearchField
            value={search}
            onChange={setSearch}
            placeholder={`Search ${title.toLowerCase()}...`}
          />
          {filterExtras}
        </FrappeFilterBar>
        <FrappeListToolbar>
          <span className="text-[var(--frappe-text-muted)]">
            {meta.total} record{meta.total === 1 ? "" : "s"}
          </span>
        </FrappeListToolbar>
        {loading ? (
          <PageLoading />
        ) : (
          <DataCardTable
            rows={rows}
            emptyTitle="Nothing to show"
            emptyDescription={emptyDescription}
            pagination={{
              meta,
              onPageChange: setPage,
              onLimitChange: setLimit,
              disabled: loading,
            }}
            columns={tableColumns}
          />
        )}
      </PermissionGate>
    </AppShell>
  );
}

function MasterFieldsForm({
  fields,
  values,
  setValues,
  supportsActive,
  isEdit,
}: {
  fields: MasterField[];
  values: Record<string, string | boolean>;
  setValues: React.Dispatch<
    React.SetStateAction<Record<string, string | boolean>>
  >;
  supportsActive?: boolean;
  isEdit?: boolean;
}) {
  return (
    <FrappeFormGrid columns={1}>
      {fields.map((f) => (
        <FrappeField key={f.name} label={f.label} required={f.required}>
          {f.type === "textarea" ? (
            <Textarea
              id={f.name}
              value={(values[f.name] as string) ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.name]: e.target.value }))
              }
            />
          ) : f.type === "select" && f.options ? (
            <Select
              value={(values[f.name] as string) ?? ""}
              onValueChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${f.label}`} />
              </SelectTrigger>
              <SelectContent>
                {f.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={f.name}
              type={f.type === "email" ? "email" : "text"}
              required={f.required}
              value={(values[f.name] as string) ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.name]: e.target.value }))
              }
            />
          )}
        </FrappeField>
      ))}
      {supportsActive && isEdit ? (
        <div className="flex items-center gap-2">
          <Switch
            id="isActive"
            checked={values.isActive !== false}
            onCheckedChange={(checked) =>
              setValues((v) => ({ ...v, isActive: checked }))
            }
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
      ) : null}
    </FrappeFormGrid>
  );
}

function buildBody(
  fields: MasterField[],
  values: Record<string, string | boolean>,
  supportsActive: boolean,
  isEdit: boolean
) {
  const body: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (typeof v === "string" && v) body[f.name] = v;
  }
  if (supportsActive && isEdit) {
    body.isActive = values.isActive !== false;
  }
  return body;
}

function rowToValues<T extends { id: string; isActive?: boolean }>(
  row: T,
  fields: MasterField[]
) {
  const values: Record<string, string | boolean> = {};
  for (const f of fields) {
    const v = (row as Record<string, unknown>)[f.name];
    if (v != null) values[f.name] = String(v);
  }
  if ("isActive" in row) values.isActive = row.isActive !== false;
  return values;
}

function CreateDialog({
  title,
  endpoint,
  fields,
  onSuccess,
}: {
  title: string;
  endpoint: string;
  fields: MasterField[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(endpoint, {
        method: "POST",
        body: buildBody(fields, values, false, false),
      });
      toast.success("Created");
      setOpen(false);
      setValues({});
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
          New
        </FrappeButtonPrimary>
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-3">
          <DialogTitle className="text-base">New {title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="p-4">
            <FrappeDocument>
              <FrappeSection title="Details">
                <MasterFieldsForm
                  fields={fields}
                  values={values}
                  setValues={setValues}
                />
              </FrappeSection>
            </FrappeDocument>
          </div>
          <DialogFooter className="border-t border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-3">
            <Button
              type="button"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <FrappeButtonPrimary type="submit" disabled={saving}>
              Save
            </FrappeButtonPrimary>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog<T extends { id: string; name: string; isActive?: boolean }>({
  title,
  endpoint,
  fields,
  row,
  supportsActive,
  onSuccess,
}: {
  title: string;
  endpoint: string;
  fields: MasterField[];
  row: T;
  supportsActive?: boolean;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    rowToValues(row, fields)
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`${endpoint}/${row.id}`, {
        method: "PATCH",
        body: buildBody(fields, values, !!supportsActive, true),
      });
      toast.success("Updated");
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
        if (next) setValues(rowToValues(row, fields));
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8">
          <PencilIcon className="size-4" />
          <span className="sr-only">Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-3">
          <DialogTitle className="text-base">Edit {row.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="p-4">
            <FrappeDocument>
              <FrappeSection title="Details">
                <MasterFieldsForm
                  fields={fields}
                  values={values}
                  setValues={setValues}
                  supportsActive={supportsActive}
                  isEdit
                />
              </FrappeSection>
            </FrappeDocument>
          </div>
          <DialogFooter className="border-t border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-3">
            <Button
              type="button"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <FrappeButtonPrimary type="submit" disabled={saving}>
              Save
            </FrappeButtonPrimary>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
