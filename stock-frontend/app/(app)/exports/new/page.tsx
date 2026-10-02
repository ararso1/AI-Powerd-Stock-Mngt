"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckIcon,
  CircleIcon,
  FileTextIcon,
  PackageIcon,
  ShipIcon,
  WorkflowIcon,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PermissionGate } from "@/components/permission-gate";
import {
  FrappeButtonLink,
  FrappeButtonPrimary,
  FrappeButtonSecondary,
  FrappeField,
  FrappeFormGrid,
} from "@/components/frappe";
import { EntitySelectField } from "@/components/shared/entity-select-field";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import { api } from "@/lib/api";
import {
  EXPORT_READINESS_STEPS,
  REQUIRED_EXPORT_DOCUMENTS,
} from "@/lib/exports";
import { errorMessage, formatQty } from "@/lib/format";
import { buildCustomersListPath } from "@/lib/list-query";
import { COFFEE_GRADE_OPTIONS } from "@/lib/lots";
import type {
  Customer,
  ExportStoreLot,
  Incoterm,
  PaginatedResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const INCOTERMS: Incoterm[] = ["FOB", "CIF", "CFR", "EXW", "FCA", "DAP"];
const COFFEE_TYPES = [
  "Arabica washed",
  "Arabica natural",
  "Arabica honey",
  "Robusta",
];

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
      <div className="flex items-start gap-3 border-b border-[var(--frappe-border)] px-5 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--csolve-moss)]/10 text-[var(--csolve-moss)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--frappe-text)]">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-sm text-[var(--frappe-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export default function NewExportPage() {
  const router = useRouter();
  const search = useSearchParams();
  const queryLotId = search.get("lotId") ?? "";
  const queryQty = search.get("qty") ?? "";

  const { data: locations } = useLocations();
  const { data: storeLots, loading: lotsLoading } = useFetch(
    () => api<ExportStoreLot[]>("/exports/store"),
    []
  );
  const { data: customersPage } = useFetch(
    () =>
      api<PaginatedResponse<Customer>>(
        buildCustomersListPath({ market: "INTERNATIONAL" }, 1, 200)
      ),
    []
  );

  const availableLots = useMemo(
    () =>
      (storeLots ?? []).filter(
        (lot) => lot.status !== "SHIPPED" && parseFloat(lot.quantityKg) > 0
      ),
    [storeLots]
  );

  const [selectedLotId, setSelectedLotId] = useState(queryLotId);
  const selectedLot = availableLots.find((lot) => lot.lotId === selectedLotId)
    ?? (storeLots ?? []).find((lot) => lot.lotId === selectedLotId)
    ?? null;

  const [customerId, setCustomerId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerCountry, setBuyerCountry] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [volumeKg, setVolumeKg] = useState(queryQty || "");
  const [allocateKg, setAllocateKg] = useState(queryQty || "");
  const [grade, setGrade] = useState("");
  const [coffeeType, setCoffeeType] = useState("Arabica washed");
  const [origin, setOrigin] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [incoterm, setIncoterm] = useState<Incoterm>("FOB");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [destination, setDestination] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [shippingDate, setShippingDate] = useState("");
  const [expectedArrival, setExpectedArrival] = useState("");
  const [stagingLocationId, setStagingLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lotPrefillDone, setLotPrefillDone] = useState(false);

  const customers = customersPage?.data ?? [];
  const customerOptions = customers.map((c) => ({
    id: c.id,
    label: [c.name, c.country, c.organizationName, c.phone]
      .filter(Boolean)
      .join(" · "),
  }));
  const locationOptions = (locations ?? []).map((l) => ({
    id: l.id,
    label: `${l.name} (${l.type})`,
  }));
  const lotOptions = availableLots.map((lot) => ({
    id: lot.lotId,
    label: `${lot.lotCode} · ${lot.grade ?? "—"} · ${formatQty(lot.quantityKg)} kg${
      lot.locationName ? ` · ${lot.locationName}` : ""
    }`,
  }));

  useEffect(() => {
    if (!selectedLot || lotPrefillDone) return;
    setVolumeKg((prev) => prev || selectedLot.quantityKg);
    setAllocateKg((prev) => prev || selectedLot.quantityKg);
    if (selectedLot.grade) setGrade(selectedLot.grade);
    if (selectedLot.doniyaLabel?.destination) {
      setDestination(selectedLot.doniyaLabel.destination);
    }
    if (selectedLot.doniyaLabel?.origin) {
      setOrigin(selectedLot.doniyaLabel.origin);
    }
    if (selectedLot.locationName && !stagingLocationId) {
      const match = (locations ?? []).find(
        (l) => l.name === selectedLot.locationName
      );
      if (match) setStagingLocationId(match.id);
    }
    setLotPrefillDone(true);
  }, [selectedLot, lotPrefillDone, locations, stagingLocationId]);

  useEffect(() => {
    setLotPrefillDone(false);
  }, [selectedLotId]);

  function onCustomerChange(id: string) {
    setCustomerId(id);
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;
    if (!buyerName.trim()) setBuyerName(customer.name);
    if (!buyerCountry.trim() && customer.country) {
      setBuyerCountry(customer.country);
    }
    if (!destination.trim() && customer.destinationPort) {
      setDestination(customer.destinationPort);
    }
    if (customer.preferredIncoterm) {
      setIncoterm(customer.preferredIncoterm as Incoterm);
    }
    if (customer.preferredCurrency) {
      setCurrencyCode(customer.preferredCurrency);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!buyerName.trim()) {
      toast.error("Enter the buyer name");
      return;
    }
    const volume = parseFloat(volumeKg);
    const price = parseFloat(pricePerKg);
    if (!(volume > 0)) {
      toast.error("Enter a contract volume in kg");
      return;
    }
    if (!(price >= 0) || Number.isNaN(price)) {
      toast.error("Enter a valid price per kg");
      return;
    }
    if (!selectedLotId) {
      toast.error("Select an export-store lot to allocate");
      return;
    }
    const allocate = parseFloat(allocateKg || volumeKg);
    if (!(allocate > 0)) {
      toast.error("Enter the quantity to allocate from the lot");
      return;
    }
    if (selectedLot && allocate > parseFloat(selectedLot.quantityKg) + 1e-6) {
      toast.error(
        `Allocate at most ${formatQty(selectedLot.quantityKg)} kg from this lot`
      );
      return;
    }

    setSaving(true);
    try {
      const created = await api<{ id: string; contractNumber?: string }>(
        "/exports",
        {
          method: "POST",
          body: {
            buyerName: buyerName.trim(),
            buyerCountry: buyerCountry.trim() || undefined,
            customerId: customerId || undefined,
            orderNumber: orderNumber.trim() || undefined,
            volumeKg: volume,
            grade: grade.trim() || undefined,
            coffeeType: coffeeType.trim() || undefined,
            origin: origin.trim() || undefined,
            pricePerKg: price,
            currencyCode,
            incoterm,
            windowStart: windowStart || undefined,
            windowEnd: windowEnd || undefined,
            destination: destination.trim() || undefined,
            containerNumber: containerNumber.trim() || undefined,
            shippingDate: shippingDate || undefined,
            expectedArrival: expectedArrival || undefined,
            stagingLocationId: stagingLocationId || undefined,
            notes: notes.trim() || undefined,
          },
        }
      );

      await api(`/exports/store/${selectedLotId}/attach`, {
        method: "POST",
        body: {
          contractId: created.id,
          quantityKg: allocate,
        },
      });

      toast.success(
        created.contractNumber
          ? `${created.contractNumber} created and linked to the export lot`
          : "Contract created and linked to the export lot"
      );
      router.push(`/exports/lots/${selectedLotId}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const cancelHref = queryLotId
    ? `/exports/lots/${queryLotId}`
    : "/exports";

  return (
    <AppShell
      title="New export contract"
      subtitle="Link a buyer contract to export-store coffee, then continue documents, ECTA, and shipment on the lot."
      variant="form"
      breadcrumbs={[
        { label: "Operations", href: "/dashboard" },
        { label: "Exports", href: "/exports" },
        ...(queryLotId
          ? [
              {
                label: selectedLot?.lotCode ?? "Lot",
                href: `/exports/lots/${queryLotId}`,
              },
            ]
          : []),
        { label: "New contract" },
      ]}
      actions={<FrappeButtonLink href={cancelHref}>← Cancel</FrappeButtonLink>}
    >
      <PermissionGate permission="export.write">
        <form onSubmit={(event) => void handleSubmit(event)} className="mx-auto max-w-5xl space-y-5">
          <section className="overflow-hidden rounded-2xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
            <div className="border-b border-[var(--frappe-border)] bg-gradient-to-br from-[var(--csolve-moss)]/[0.08] to-transparent px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--frappe-text-muted)]">
                Export procedure
              </p>
              <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
                Creating the contract is step 2. Documents and ECTA stay on the
                export lot after you save.
              </p>
              <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {EXPORT_READINESS_STEPS.map((step, index) => {
                  const done = index === 0;
                  const current = step.key === "CONTRACT";
                  return (
                    <li
                      key={step.key}
                      className={cn(
                        "rounded-xl border px-3 py-2.5",
                        done && "border-emerald-500/35 bg-emerald-500/[0.08]",
                        current &&
                          "border-[var(--csolve-moss)] bg-[var(--csolve-moss)]/[0.08] ring-1 ring-[var(--csolve-moss)]/20",
                        !done &&
                          !current &&
                          "border-[var(--frappe-border)] opacity-70"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full",
                            done && "bg-emerald-600 text-white",
                            current &&
                              "bg-[var(--csolve-moss)] text-[var(--csolve-parchment)]",
                            !done &&
                              !current &&
                              "bg-[var(--frappe-border)] text-[var(--frappe-text-muted)]"
                          )}
                        >
                          {done ? (
                            <CheckIcon className="size-3" strokeWidth={2.5} />
                          ) : (
                            <CircleIcon className="size-2.5" />
                          )}
                        </span>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
                            Step {index + 1}
                          </p>
                          <p className="text-xs font-semibold">{step.label}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <Section
            icon={<PackageIcon className="size-4" />}
            title="Export lot allocation"
            description="Reserve coffee from an export-store lot. Required documents are completed on that lot after the contract is linked."
          >
            <FrappeFormGrid columns={2}>
              <EntitySelectField
                label="Export store lot"
                required
                value={selectedLotId}
                onValueChange={setSelectedLotId}
                options={lotOptions}
                listHref="/exports"
                listLabel="Export lots"
                emptyMessage={
                  lotsLoading
                    ? "Loading export lots…"
                    : "No export-store coffee available. Finish packaging first."
                }
                disabled={Boolean(queryLotId)}
                loading={lotsLoading}
              />
              <FrappeField label="Allocate kg" required>
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  value={allocateKg}
                  onChange={(e) => setAllocateKg(e.target.value)}
                  required
                />
              </FrappeField>
            </FrappeFormGrid>
            {selectedLot ? (
              <div className="mt-4 grid gap-2 rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-bg)]/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
                    Lot
                  </p>
                  <Link
                    href={`/exports/lots/${selectedLot.lotId}`}
                    className="text-sm font-semibold text-[var(--frappe-primary)] hover:underline"
                  >
                    {selectedLot.lotCode}
                  </Link>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
                    Available
                  </p>
                  <p className="text-sm font-semibold">
                    {formatQty(selectedLot.quantityKg)} kg
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
                    Grade
                  </p>
                  <p className="text-sm font-semibold">
                    {selectedLot.grade ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
                    Batch
                  </p>
                  <p className="text-sm font-semibold">
                    {selectedLot.runNumber ?? "—"}
                  </p>
                </div>
              </div>
            ) : null}
          </Section>

          <Section
            icon={<WorkflowIcon className="size-4" />}
            title="Buyer & commercial terms"
            description="Contract volume and price for the buyer. Grade and origin default from the selected lot when available."
          >
            <FrappeFormGrid columns={2}>
              <EntitySelectField
                label="Export customer (optional)"
                value={customerId}
                onValueChange={onCustomerChange}
                options={customerOptions}
                listHref="/customers?market=INTERNATIONAL"
                listLabel="Export customers"
                emptyMessage="Optional — create an international customer, or type the buyer name below."
                hint="International customers can fill buyer, country, destination, currency, and Incoterm."
              />
              <FrappeField label="Buyer name" required>
                <Input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Buyer / importer"
                  required
                />
              </FrappeField>
              <FrappeField label="Buyer country">
                <Input
                  value={buyerCountry}
                  onChange={(e) => setBuyerCountry(e.target.value)}
                  placeholder="e.g. Saudi Arabia"
                />
              </FrappeField>
              <FrappeField label="Export order #">
                <Input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Optional PO / order ref"
                />
              </FrappeField>
              <FrappeField label="Coffee type">
                <Select value={coffeeType} onValueChange={setCoffeeType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {COFFEE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FrappeField>
              <FrappeField label="Grade">
                <Select
                  value={grade || "__none__"}
                  onValueChange={(v) => setGrade(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    {COFFEE_GRADE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FrappeField>
              <FrappeField label="Origin">
                <Input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Region / zone"
                />
              </FrappeField>
              <FrappeField label="Contract volume (kg)" required>
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  value={volumeKg}
                  onChange={(e) => setVolumeKg(e.target.value)}
                  required
                />
              </FrappeField>
              <FrappeField label="Price / kg" required>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </FrappeField>
              <FrappeField label="Currency">
                <Input
                  value={currencyCode}
                  onChange={(e) =>
                    setCurrencyCode(e.target.value.toUpperCase())
                  }
                  maxLength={3}
                />
              </FrappeField>
              <FrappeField label="Incoterm">
                <Select
                  value={incoterm}
                  onValueChange={(v) => setIncoterm(v as Incoterm)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOTERMS.map((term) => (
                      <SelectItem key={term} value={term}>
                        {term}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FrappeField>
            </FrappeFormGrid>
          </Section>

          <Section
            icon={<ShipIcon className="size-4" />}
            title="Shipping window"
            description="Optional now — can be completed before staging and shipment."
          >
            <FrappeFormGrid columns={2}>
              <FrappeField label="Destination">
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Port / city"
                />
              </FrappeField>
              <FrappeField label="Container #">
                <Input
                  value={containerNumber}
                  onChange={(e) => setContainerNumber(e.target.value)}
                />
              </FrappeField>
              <FrappeField label="Ship window start">
                <Input
                  type="date"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                />
              </FrappeField>
              <FrappeField label="Ship window end">
                <Input
                  type="date"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                />
              </FrappeField>
              <FrappeField label="Shipping date">
                <Input
                  type="date"
                  value={shippingDate}
                  onChange={(e) => setShippingDate(e.target.value)}
                />
              </FrappeField>
              <FrappeField label="Expected arrival">
                <Input
                  type="date"
                  value={expectedArrival}
                  onChange={(e) => setExpectedArrival(e.target.value)}
                />
              </FrappeField>
              <EntitySelectField
                label="Staging location"
                value={stagingLocationId}
                onValueChange={setStagingLocationId}
                options={locationOptions}
                listHref="/locations"
                listLabel="Locations"
                emptyMessage="Optional staging warehouse."
              />
              <FrappeField label="Notes" fullWidth>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Contract notes"
                />
              </FrappeField>
            </FrappeFormGrid>
          </Section>

          <Section
            icon={<FileTextIcon className="size-4" />}
            title="Documents after save"
            description="These eight required documents are tracked on the export lot — upload a file or enter a certificate number there."
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {REQUIRED_EXPORT_DOCUMENTS.map((doc, index) => (
                <li
                  key={doc.key}
                  className="flex items-center gap-2 rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-bg)]/30 px-3 py-2 text-sm"
                >
                  <Badge variant="outline" className="tabular-nums">
                    {index + 1}
                  </Badge>
                  <span>{doc.label}</span>
                </li>
              ))}
            </ul>
          </Section>

          <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-5 py-4">
            <FrappeButtonSecondary asChild>
              <Link href={cancelHref}>Cancel</Link>
            </FrappeButtonSecondary>
            <FrappeButtonPrimary type="submit" disabled={saving || lotsLoading}>
              {saving
                ? "Creating…"
                : "Create contract & attach lot"}
            </FrappeButtonPrimary>
          </div>
        </form>
      </PermissionGate>
    </AppShell>
  );
}
