"use client";

import type { ExportDoniyaLabel } from "@/lib/types";
import { cn } from "@/lib/utils";

export type DoniyaLabelDraft = {
  businessName: string;
  location: string;
  coffeeName: string;
  origin: string;
  netWeight: string;
  certificateNumber: string;
  icoNumber: string;
  productionDate: string;
  expiryDate: string;
  destination: string;
};

export const EMPTY_DONIYA_LABEL: DoniyaLabelDraft = {
  businessName: "Efnan Business PLC",
  location: "Dire Dawa, Ethiopia",
  coffeeName: "Harar Coffee",
  origin: "Produce of Ethiopia",
  netWeight: "50 kg",
  certificateNumber: "0011",
  icoNumber: "010/0462/0011",
  productionDate: "",
  expiryDate: "",
  destination: "Jiddah, Saudi Arabia",
};

export function monthYearNow(offsetYears = 0): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + offsetYears);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${month}/${date.getFullYear()}`;
}

function line(value: string | undefined | null, fallback: string) {
  const text = value?.trim();
  return text || fallback;
}

export function DoniyaLabelPreview({
  label,
  className,
}: {
  label: Partial<ExportDoniyaLabel | DoniyaLabelDraft>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[280px] select-none overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/doniya-sack.jpg"
        alt="Doniya sack template"
        className="block h-auto w-full"
      />
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center px-[18%] text-center font-sans text-[#1a1a1a]"
        style={{
          paddingTop: "24%",
          paddingBottom: "20%",
          textShadow: "0 1px 0 rgba(255,255,255,0.35)",
        }}
      >
        <p className="text-[11px] font-bold uppercase leading-tight tracking-wide sm:text-xs">
          {line(label.businessName, "Business name")}
        </p>
        <p className="mt-0.5 text-[9px] leading-snug text-[#2a2a2a] sm:text-[10px]">
          {line(label.location, "Location")}
        </p>

        <p className="mt-[6%] text-[13px] font-semibold leading-tight sm:text-sm">
          {line(label.coffeeName, "Coffee name")}
        </p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.04em] text-[#1f5c2e] sm:text-[11px]">
          {line(label.origin, "Origin")}
        </p>

        <p className="mt-[5%] text-[11px] font-bold uppercase tracking-wide sm:text-xs">
          Net weight: {line(label.netWeight, "—")}
        </p>

        <div className="mt-auto w-full space-y-0.5 pt-1 text-[9px] leading-snug sm:text-[10px]">
          <p>
            Cert. No.{" "}
            <span className="font-semibold">
              {line(label.certificateNumber, "—")}
            </span>
          </p>
          <p>
            ICO No.{" "}
            <span className="font-semibold">{line(label.icoNumber, "—")}</span>
          </p>
          <p>
            Prod. {line(label.productionDate, "—")} · Exp.{" "}
            {line(label.expiryDate, "—")}
          </p>
          <p className="font-medium">
            Dest. {line(label.destination, "—")}
          </p>
        </div>
      </div>
    </div>
  );
}
