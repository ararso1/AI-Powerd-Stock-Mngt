"use client";

import { useEffect, useMemo, useState } from "react";
import { FrappeButtonSecondary, FrappeButtonPrimary } from "@/components/frappe";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { formatBankAccountLabel, bankAccountsUrl } from "@/lib/bank-accounts";
import { errorMessage, formatMoney, formatQty } from "@/lib/format";
import type { BankAccount, Sale, SaleLine, SaleReturn } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { toast } from "sonner";

type RefundMethod = "CASH" | "BANK";

type DraftLine = {
  selected: boolean;
  quantity: string;
};

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function returnedQty(sale: Sale, lineId: string | undefined) {
  if (!lineId) return 0;
  let total = 0;
  for (const row of sale.returns ?? []) {
    if (row.status && row.status !== "ACTIVE") continue;
    for (const line of row.lines ?? []) {
      if (line.saleLineId === lineId) total += parseFloat(line.quantity) || 0;
    }
  }
  return total;
}

function remainingQty(sale: Sale, line: SaleLine) {
  const sold = parseFloat(line.quantity) || 0;
  return round3(Math.max(0, sold - returnedQty(sale, line.id)));
}

function lineLabel(line: SaleLine) {
  return line.item?.description || line.item?.sku || "Item";
}

export function SaleReturnDialog({
  sale,
  onDone,
}: {
  sale: Sale;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [refundDate, setRefundDate] = useState(todayInput);
  const [drafts, setDrafts] = useState<Record<string, DraftLine>>({});

  const lines = sale.lines ?? [];
  const accountType = refundMethod === "BANK" ? "BANK" : "CASH";
  const { data: accounts } = useFetch(
    () =>
      open
        ? apiList<BankAccount>(bankAccountsUrl(accountType))
        : Promise.resolve([] as BankAccount[]),
    [open, accountType]
  );

  const selected = useMemo(() => {
    return lines.flatMap((line) => {
      if (!line.id) return [];
      const draft = drafts[line.id];
      if (!draft?.selected) return [];
      const remaining = remainingQty(sale, line);
      const quantity = parseFloat(draft.quantity);
      const unitPrice = parseFloat(line.unitPrice) || 0;
      return [
        {
          line,
          remaining,
          quantity,
          amount:
            Number.isFinite(quantity) && quantity > 0
              ? round2(quantity * unitPrice)
              : 0,
        },
      ];
    });
  }, [drafts, lines, sale]);

  const returnTotal = round2(selected.reduce((sum, row) => sum + row.amount, 0));
  const collected = Math.max(0, parseFloat(sale.paidAmount ?? "0") || 0);
  const cashRefund = round2(Math.min(returnTotal, collected));
  const creditReduction = round2(Math.max(0, returnTotal - cashRefund));

  useEffect(() => {
    if (refundMethod !== "CASH" || cashRefund <= 0) return;
    const list = accounts ?? [];
    if (list.length === 1 && !bankAccountId) setBankAccountId(list[0].id);
  }, [accounts, bankAccountId, cashRefund, refundMethod]);

  function openDialog() {
    const next: Record<string, DraftLine> = {};
    for (const line of lines) {
      if (!line.id) continue;
      next[line.id] = { selected: false, quantity: "" };
    }
    const method: RefundMethod =
      sale.paymentMethod === "BANK" || sale.paymentMethod === "PARTIAL"
        ? "BANK"
        : "CASH";
    setDrafts(next);
    setRefundMethod(method);
    setBankAccountId(
      method === "BANK" ? (sale.bankAccountId ?? "") : ""
    );
    setRefundDate(todayInput());
    setOpen(true);
  }

  function updateDraft(lineId: string, patch: Partial<DraftLine>) {
    setDrafts((current) => ({
      ...current,
      [lineId]: {
        selected: current[lineId]?.selected ?? false,
        quantity: current[lineId]?.quantity ?? "",
        ...patch,
      },
    }));
  }

  async function submit() {
    const chosen = selected.filter((row) => row.quantity > 0);
    if (!chosen.length) {
      toast.error("Select at least one item and enter the quantity to return");
      return;
    }
    for (const row of chosen) {
      if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
        toast.error(`Enter a quantity for ${lineLabel(row.line)}`);
        return;
      }
      if (row.quantity - row.remaining > 0.0005) {
        toast.error(
          `${lineLabel(row.line)} can return up to ${formatQty(row.remaining)}`
        );
        return;
      }
    }
    if (!refundDate) {
      toast.error("Enter the refund date");
      return;
    }
    if (cashRefund > 0 && refundMethod === "BANK" && !bankAccountId) {
      toast.error("Select the bank for the transfer");
      return;
    }
    if (
      cashRefund > 0 &&
      refundMethod === "CASH" &&
      (accounts ?? []).length > 1 &&
      !bankAccountId
    ) {
      toast.error("Select the cash account for the refund");
      return;
    }

    setBusy(true);
    try {
      await api<SaleReturn>(`/sales/${sale.id}/returns`, {
        method: "POST",
        body: {
          refundMethod,
          refundDate,
          bankAccountId:
            cashRefund > 0 && bankAccountId ? bankAccountId : undefined,
          lines: chosen.map((row) => ({
            saleLineId: row.line.id,
            itemId: row.line.itemId,
            lotId: row.line.lotId ?? undefined,
            quantity: row.quantity,
            unitPrice: parseFloat(row.line.unitPrice) || 0,
          })),
        },
      });
      toast.success("Sale return posted — stock restored");
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sale.status === "VOIDED" || sale.channel === "EXPORT") return null;

  const accountList = accounts ?? [];
  const showBank = cashRefund > 0 && refundMethod === "BANK";
  const showCashAccount = cashRefund > 0 && refundMethod === "CASH" && accountList.length > 1;
  const singleCash =
    cashRefund > 0 && refundMethod === "CASH" && accountList.length === 1
      ? accountList[0]
      : null;

  return (
    <>
      <FrappeButtonSecondary type="button" onClick={openDialog}>
        Sales return
      </FrappeButtonSecondary>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sales return</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <p className="text-xs text-[var(--frappe-text-muted)]">
              Choose the items from this sale, then record how much comes back
              and how the refund is paid. Returned quantity goes back into
              stock at the sale location.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--frappe-border)] text-left text-xs text-[var(--frappe-text-muted)]">
                    <th className="py-2 pr-2 font-medium">Return</th>
                    <th className="py-2 pr-2 font-medium">Item</th>
                    <th className="py-2 pr-2 text-right font-medium">Sold</th>
                    <th className="py-2 pr-2 text-right font-medium">Left</th>
                    <th className="py-2 pr-2 font-medium">Qty</th>
                    <th className="py-2 pr-2 text-right font-medium">Rate</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const lineId = line.id ?? `line-${index}`;
                    const remaining = remainingQty(sale, line);
                    const draft = drafts[line.id ?? ""] ?? {
                      selected: false,
                      quantity: "",
                    };
                    const quantity = parseFloat(draft.quantity);
                    const amount =
                      draft.selected && Number.isFinite(quantity) && quantity > 0
                        ? round2(quantity * (parseFloat(line.unitPrice) || 0))
                        : 0;
                    const disabled = remaining <= 0 || !line.id;
                    return (
                      <tr
                        key={lineId}
                        className="border-b border-[var(--frappe-border)] last:border-0"
                      >
                        <td className="py-2 pr-2">
                          <Checkbox
                            checked={draft.selected && !disabled}
                            disabled={disabled}
                            onCheckedChange={(checked) => {
                              if (!line.id) return;
                              updateDraft(line.id, {
                                selected: checked === true,
                                quantity:
                                  checked === true
                                    ? String(remaining)
                                    : "",
                              });
                            }}
                            aria-label={`Return ${lineLabel(line)}`}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <div>{lineLabel(line)}</div>
                          <div className="text-xs text-[var(--frappe-text-muted)]">
                            {line.item?.sku ?? "—"}
                          </div>
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {formatQty(line.quantity)}
                          {line.item?.unit ? ` ${line.item.unit}` : ""}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {formatQty(remaining)}
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            step="0.001"
                            disabled={disabled || !draft.selected}
                            value={draft.quantity}
                            onChange={(event) => {
                              if (!line.id) return;
                              updateDraft(line.id, {
                                quantity: event.target.value,
                              });
                            }}
                            className="h-8 w-24"
                          />
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {formatMoney(line.unitPrice)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatMoney(amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Refund date</Label>
                <Input
                  type="date"
                  value={refundDate}
                  max={todayInput()}
                  onChange={(event) => setRefundDate(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Refund method</Label>
                <Select
                  value={refundMethod}
                  onValueChange={(value) => {
                    const method = value as RefundMethod;
                    setRefundMethod(method);
                    setBankAccountId(
                      method === "BANK" ? (sale.bankAccountId ?? "") : ""
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {showBank ? (
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Bank</Label>
                  <Select
                    value={bankAccountId || undefined}
                    onValueChange={setBankAccountId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountList.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {formatBankAccountLabel(account)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {showCashAccount ? (
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Cash account</Label>
                  <Select
                    value={bankAccountId || undefined}
                    onValueChange={setBankAccountId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select cash account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountList.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {formatBankAccountLabel(account)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {singleCash ? (
                <p className="text-xs text-[var(--frappe-text-muted)] sm:col-span-2">
                  Cash refund is paid from {formatBankAccountLabel(singleCash)}.
                </p>
              ) : null}
            </div>

            <div className="grid gap-1 rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[var(--frappe-text-muted)]">Return total</span>
                <span className="tabular-nums font-medium">
                  {formatMoney(returnTotal)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--frappe-text-muted)]">
                  {refundMethod === "BANK" ? "Bank refund" : "Cash refund"}
                </span>
                <span className="tabular-nums">{formatMoney(cashRefund)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--frappe-text-muted)]">
                  Outstanding reduced
                </span>
                <span className="tabular-nums">
                  {formatMoney(creditReduction)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <FrappeButtonSecondary type="button" onClick={() => setOpen(false)}>
              Cancel
            </FrappeButtonSecondary>
            <FrappeButtonPrimary
              type="button"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? "Posting…" : "Post return"}
            </FrappeButtonPrimary>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
