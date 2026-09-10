"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FrappeButtonPrimary,
  FrappeButtonSecondary,
  FrappeDocument,
  FrappeField,
  FrappeFormGrid,
  FrappeSection,
} from "@/components/frappe";
import { QuickSupplierDialog } from "@/components/suppliers/quick-supplier-dialog";
import { QuickLocationDialog } from "@/components/locations/quick-location-dialog";
import { Input } from "@/components/ui/input";
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
import {
  bankAccountTypeForPayment,
  bankAccountsUrl,
  formatBankAccountLabel,
  resolveBankAccountId,
  showsPaymentAccountPicker,
} from "@/lib/bank-accounts";
import { errorMessage, formatMoney } from "@/lib/format";
import { fetchSuppliers } from "@/lib/party-fetch";
import type {
  BankAccount,
  CherryPrice,
  CollectionTicket,
  Location,
  PaymentMethod,
  Supplier,
} from "@/lib/types";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { useAutoPaymentAccount } from "@/hooks/use-payment-bank-account";
import { toast } from "sonner";

export function CollectionForm() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [grade, setGrade] = useState("Cherry A");
  const [cropYear, setCropYear] = useState("2025/26");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [moisture, setMoisture] = useState("");
  const [region, setRegion] = useState("Yirgacheffe");
  const [woreda, setWoreda] = useState("");
  const [kebele, setKebele] = useState("");
  const [variety, setVariety] = useState("Heirloom");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    data: suppliers,
    reload: reloadSuppliers,
    setData: setSuppliers,
  } = useFetch(() => fetchSuppliers(), []);
  const {
    data: locations,
    reload: reloadLocations,
  } = useLocations();
  const [localLocations, setLocalLocations] = useState<Location[]>([]);

  useEffect(() => {
    if (locations) setLocalLocations(locations);
  }, [locations]);

  const { data: prices } = useFetch(
    () =>
      api<CherryPrice[]>(
        `/collections/prices?cropYear=${encodeURIComponent(cropYear)}`
      ),
    [cropYear]
  );

  const paymentAccountType = bankAccountTypeForPayment(paymentMethod);
  const { data: banks } = useFetch(
    () =>
      paymentAccountType
        ? apiList<BankAccount>(bankAccountsUrl(paymentAccountType))
        : Promise.resolve([]),
    [paymentAccountType]
  );

  useAutoPaymentAccount(
    paymentMethod,
    banks,
    bankAccountId,
    setBankAccountId
  );

  useEffect(() => {
    const match = (prices ?? []).find(
      (p) => p.grade.toLowerCase() === grade.toLowerCase()
    );
    if (match) setPricePerKg(match.pricePerKg);
  }, [grade, prices]);

  const total = useMemo(() => {
    const w = parseFloat(weightKg);
    const p = parseFloat(pricePerKg);
    if (!Number.isFinite(w) || !Number.isFinite(p)) return 0;
    return w * p;
  }, [weightKg, pricePerKg]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(weightKg);
    const p = parseFloat(pricePerKg);
    if (!supplierId) {
      toast.error("Select a farmer / supplier");
      return;
    }
    if (!locationId) {
      toast.error("Select a collection location");
      return;
    }
    if (!Number.isFinite(w) || w <= 0) {
      toast.error("Enter a valid weight");
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      toast.error("Enter a valid price/kg");
      return;
    }

    const resolvedBank = resolveBankAccountId(
      paymentMethod,
      banks,
      bankAccountId
    );
    if (
      (paymentMethod === "CASH" || paymentMethod === "BANK") &&
      !resolvedBank
    ) {
      toast.error(
        paymentMethod === "CASH"
          ? "No cash till found"
          : "Select a bank account"
      );
      return;
    }

    setSaving(true);
    try {
      const ticket = await api<CollectionTicket>("/collections", {
        method: "POST",
        body: {
          supplierId,
          locationId,
          weightKg: w,
          pricePerKg: p,
          paymentMethod,
          bankAccountId: resolvedBank,
          grade: grade.trim() || undefined,
          cropYear: cropYear.trim() || undefined,
          moisturePercent: moisture ? parseFloat(moisture) : undefined,
          region: region.trim() || undefined,
          woreda: woreda.trim() || undefined,
          kebele: kebele.trim() || undefined,
          variety: variety.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      });
      toast.success(`Collected — lot ${ticket.lot?.code ?? ticket.lotId}`);
      router.push(`/collections/${ticket.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap gap-2">
        <FrappeButtonSecondary type="button" onClick={() => router.back()}>
          Cancel
        </FrappeButtonSecondary>
        <FrappeButtonPrimary type="submit" disabled={saving} className="ml-auto">
          {saving ? "Saving…" : "Record collection"}
        </FrappeButtonPrimary>
      </div>

      <FrappeDocument>
        <FrappeSection
          title="Cherry intake"
          description="Creates lot + purchase + stock and records COLLECTED on the lot timeline"
        >
          <FrappeFormGrid columns={2}>
            <FrappeField label="Farmer / supplier" required>
              <div className="flex gap-2">
                <Select value={supplierId || undefined} onValueChange={setSupplierId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select farmer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers ?? []).map((s: Supplier) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <QuickSupplierDialog
                  onCreated={(s) => {
                    setSuppliers((prev) => [...(prev ?? []), s]);
                    setSupplierId(s.id);
                    void reloadSuppliers();
                  }}
                />
              </div>
            </FrappeField>

            <FrappeField label="Collection location" required>
              <div className="flex gap-2">
                <Select value={locationId || undefined} onValueChange={setLocationId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {(localLocations.length ? localLocations : locations ?? []).map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <QuickLocationDialog
                  onCreated={(loc) => {
                    setLocalLocations((prev) => [...prev, loc]);
                    setLocationId(loc.id);
                    void reloadLocations();
                  }}
                />
              </div>
            </FrappeField>

            <FrappeField label="Weight (kg)" required>
              <Input
                type="number"
                min={0.001}
                step="0.001"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
              />
            </FrappeField>

            <FrappeField label="Grade" hint="Uses price table when matched">
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(prices?.length
                    ? prices.map((p) => p.grade)
                    : ["Cherry A", "Cherry B", "Cherry C"]
                  ).map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FrappeField>

            <FrappeField label="Price / kg (ETB)" required>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                required
              />
            </FrappeField>

            <FrappeField label="Total">
              <Input value={formatMoney(total)} readOnly />
            </FrappeField>

            <FrappeField label="Payment method" required>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                </SelectContent>
              </Select>
            </FrappeField>

            {showsPaymentAccountPicker(paymentMethod, banks) ? (
              <FrappeField
                label={paymentMethod === "CASH" ? "Cash till" : "Bank account"}
                required
              >
                <Select
                  value={bankAccountId || undefined}
                  onValueChange={setBankAccountId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {(banks ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {formatBankAccountLabel(b)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FrappeField>
            ) : null}

            <FrappeField label="Crop year">
              <Input
                value={cropYear}
                onChange={(e) => setCropYear(e.target.value)}
              />
            </FrappeField>
            <FrappeField label="Moisture %">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={moisture}
                onChange={(e) => setMoisture(e.target.value)}
              />
            </FrappeField>
            <FrappeField label="Region">
              <Input value={region} onChange={(e) => setRegion(e.target.value)} />
            </FrappeField>
            <FrappeField label="Woreda">
              <Input value={woreda} onChange={(e) => setWoreda(e.target.value)} />
            </FrappeField>
            <FrappeField label="Kebele">
              <Input value={kebele} onChange={(e) => setKebele(e.target.value)} />
            </FrappeField>
            <FrappeField label="Variety">
              <Input
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
              />
            </FrappeField>
            <FrappeField label="Notes" fullWidth>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </FrappeField>
          </FrappeFormGrid>
        </FrappeSection>
      </FrappeDocument>
    </form>
  );
}
