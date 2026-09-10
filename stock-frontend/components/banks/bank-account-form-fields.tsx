"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BankAccountFormValues } from "@/lib/bank-accounts";

export function BankAccountFormFields({
  values,
  onChange,
  mode,
}: {
  values: BankAccountFormValues;
  onChange: (patch: Partial<BankAccountFormValues>) => void;
  mode: "create" | "edit";
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="bank-display-name">
          Display name <span className="text-[var(--frappe-red)]">*</span>
        </Label>
        <Input
          id="bank-display-name"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder='e.g. "Main Bank", "Cash"'
          required
          autoFocus
        />
        <p className="text-xs text-[var(--frappe-text-muted)]">
          Short label shown in dropdowns across purchases, sales, and expenses.
        </p>
      </div>
      {mode === "create" ? (
        <div className="grid gap-2">
          <Label htmlFor="bank-account-type">
            Account type <span className="text-[var(--frappe-red)]">*</span>
          </Label>
          <Select
            value={values.accountType}
            onValueChange={(v) =>
              onChange({ accountType: v as BankAccountFormValues["accountType"] })
            }
          >
            <SelectTrigger id="bank-account-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Cash till / petty cash</SelectItem>
              <SelectItem value="BANK">Bank account</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {values.accountType === "BANK" || mode === "edit" ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="bank-institution">Bank / provider</Label>
            <Input
              id="bank-institution"
              value={values.bankName}
              onChange={(e) => onChange({ bankName: e.target.value })}
              placeholder="Commercial Bank of Ethiopia"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bank-holder">Account holder name</Label>
            <Input
              id="bank-holder"
              value={values.accountHolderName}
              onChange={(e) => onChange({ accountHolderName: e.target.value })}
              placeholder="Noble Store PLC"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bank-number">Account number</Label>
            <Input
              id="bank-number"
              value={values.accountNumber}
              onChange={(e) => onChange({ accountNumber: e.target.value })}
              placeholder="1000123456789"
            />
          </div>
        </>
      ) : null}
      {mode === "create" ? (
        <div className="grid gap-2">
          <Label htmlFor="bank-opening-balance">Opening balance</Label>
          <Input
            id="bank-opening-balance"
            type="number"
            step="any"
            min="0"
            value={values.balance}
            onChange={(e) => onChange({ balance: e.target.value })}
            placeholder="0"
          />
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <Label>Account type</Label>
            <p className="text-sm text-[var(--frappe-text-muted)]">
              {values.accountType === "CASH"
                ? "Cash till / petty cash"
                : "Bank account"}
            </p>
          </div>
          <div className="flex items-center gap-2">
          <Switch
            id="bank-active"
            checked={values.isActive}
            onCheckedChange={(checked) => onChange({ isActive: checked })}
          />
          <Label htmlFor="bank-active">Active</Label>
        </div>
        </>
      )}
    </div>
  );
}
