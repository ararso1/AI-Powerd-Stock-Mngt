"use client";

import { useState } from "react";
import { FrappeButtonSecondary, FrappeButtonPrimary } from "@/components/frappe";
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
import { errorMessage } from "@/lib/format";
import { needsBankAccount } from "@/lib/document-utils";
import {
  bankAccountSelectOptions,
  bankAccountsUrl,
  bankAccountTypeForPayment,
} from "@/lib/bank-accounts";
import type { BankAccount, PaymentMethod, Sale, SaleReturn } from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { toast } from "sonner";

export function SaleReturnDialog({
  sale,
  onDone,
}: {
  sale: Sale;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>(
    sale.paymentMethod === "CREDIT" ? "CREDIT" : "CASH"
  );
  const [bankAccountId, setBankAccountId] = useState(sale.bankAccountId ?? "");
  const firstLine = sale.lines?.[0];
  const [qty, setQty] = useState(firstLine?.quantity ?? "1");

  const accountType = bankAccountTypeForPayment(refundMethod);
  const { data: banks } = useFetch(
    () =>
      needsBankAccount(refundMethod)
        ? api<{ data: BankAccount[] }>(bankAccountsUrl(accountType)).then(
            (r) => r.data ?? []
          )
        : Promise.resolve([] as BankAccount[]),
    [refundMethod, accountType]
  );

  async function submit() {
    if (!firstLine) {
      toast.error("Sale has no lines to return");
      return;
    }
    const quantity = parseFloat(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (needsBankAccount(refundMethod) && !bankAccountId) {
      toast.error("Select refund account");
      return;
    }
    setBusy(true);
    try {
      await api<SaleReturn>(`/sales/${sale.id}/returns`, {
        method: "POST",
        body: {
          refundMethod,
          bankAccountId: bankAccountId || undefined,
          lines: [
            {
              saleLineId: firstLine.id,
              itemId: firstLine.itemId,
              lotId: firstLine.lotId ?? undefined,
              quantity,
              unitPrice: parseFloat(firstLine.unitPrice),
            },
          ],
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

  return (
    <>
      <FrappeButtonSecondary type="button" onClick={() => setOpen(true)}>
        Sales return
      </FrappeButtonSecondary>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sales return</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-xs text-[var(--frappe-text-muted)]">
              Returns stock to the sale location and refunds cash/bank or reduces
              credit.
            </p>
            <div className="grid gap-1.5">
              <Label>Quantity ({firstLine?.item?.description ?? "line 1"})</Label>
              <Input
                type="number"
                min={0.001}
                step="0.001"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Refund method</Label>
              <Select
                value={refundMethod}
                onValueChange={(v) => setRefundMethod(v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="CREDIT">Credit note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsBankAccount(refundMethod) ? (
              <div className="grid gap-1.5">
                <Label>Refund account</Label>
                <Select
                  value={bankAccountId || undefined}
                  onValueChange={setBankAccountId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccountSelectOptions(banks ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
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
