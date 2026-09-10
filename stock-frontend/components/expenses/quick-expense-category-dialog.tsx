"use client";

import { useState } from "react";
import { FrappeButtonPrimary, FrappeButtonSecondary } from "@/components/frappe";
import { QuickCreateTrigger } from "@/components/shared/quick-create-trigger";
import {
  QuickCreateDialogShell,
  useQuickCreateDialog,
  bindQuickCreateTrigger,
} from "@/components/shared/quick-create-dialog-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { ExpenseCategory } from "@/lib/types";
import { toast } from "sonner";

export function QuickExpenseCategoryDialog({
  onCreated,
  trigger,
}: {
  onCreated: (category: ExpenseCategory) => void;
  trigger?: React.ReactNode;
}) {
  const { open, setOpen, onOpenChange } = useQuickCreateDialog();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  function openDialog() {
    setOpen(true);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }
    setSaving(true);
    try {
      const category = await api<ExpenseCategory>("/expenses/categories", {
        method: "POST",
        body: { name: name.trim() },
      });
      toast.success("Category created");
      setOpen(false);
      setName("");
      onCreated(category);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {bindQuickCreateTrigger(
        trigger,
        openDialog,
        <QuickCreateTrigger label="New category" onClick={openDialog} />
      )}
      <QuickCreateDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="New expense category"
        footer={
          <>
            <FrappeButtonSecondary type="button" onClick={() => setOpen(false)}>
              Cancel
            </FrappeButtonSecondary>
            <FrappeButtonPrimary type="button" disabled={saving} onClick={handleSubmit}>
              Create
            </FrappeButtonPrimary>
          </>
        }
      >
        <div className="grid gap-4 p-4">
          <div className="grid gap-2">
            <Label htmlFor="cat-name">
              Name <span className="text-[var(--frappe-red)]">*</span>
            </Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      </QuickCreateDialogShell>
    </>
  );
}
