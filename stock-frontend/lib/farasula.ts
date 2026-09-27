/** Coffee purchases are priced by Farasula. Stock and lots stay in kilograms. */
export const KG_PER_FARASULA = 18;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function farasulaToKg(farasula: number): number {
  return roundTo(farasula * KG_PER_FARASULA, 3);
}

export function kgToFarasula(kg: number): number {
  return roundTo(kg / KG_PER_FARASULA, 3);
}

/** "10 Farasula = 180 kg" */
export function farasulaKgLabel(farasula: number): string | null {
  if (!Number.isFinite(farasula) || farasula < 0) return null;
  return `${formatFarasulaInput(farasula, 3)} Farasula = ${formatFarasulaInput(farasulaToKg(farasula), 3)} kg`;
}

export function formatFarasulaInput(value: number, decimals = 3): string {
  if (!Number.isFinite(value)) return "";
  return String(roundTo(value, decimals));
}

/**
 * Purchase lines are stored as kg and a per-kg price so stock stays in kilograms.
 * The amount is Farasula × price per Farasula, and the per-kg price is derived from that amount.
 */
export function toStoredPurchaseLine(
  farasula: number,
  pricePerFarasula: number
): { quantityKg: number; pricePerKg: number; amount: number } {
  const quantityKg = farasulaToKg(farasula);
  const amount = roundTo(farasula * pricePerFarasula, 2);
  const pricePerKg = quantityKg > 0 ? amount / quantityKg : 0;
  return { quantityKg, pricePerKg, amount };
}

/** Rebuild the Farasula quantity and price from a stored kg purchase line. */
export function fromStoredPurchaseLine(
  quantityKg: string | number,
  unitPrice: string | number,
  lineTotal?: string | number | null
): { farasula: number; pricePerFarasula: number; quantityKg: number } {
  const kg = typeof quantityKg === "number" ? quantityKg : parseFloat(quantityKg);
  const pricePerKg =
    typeof unitPrice === "number" ? unitPrice : parseFloat(String(unitPrice));
  const total =
    lineTotal != null && lineTotal !== ""
      ? typeof lineTotal === "number"
        ? lineTotal
        : parseFloat(String(lineTotal))
      : kg * pricePerKg;
  const farasula = Number.isFinite(kg) ? kg / KG_PER_FARASULA : 0;
  const pricePerFarasula =
    Number.isFinite(farasula) && farasula > 0
      ? total / farasula
      : Number.isFinite(pricePerKg)
        ? pricePerKg * KG_PER_FARASULA
        : 0;
  return {
    farasula: roundTo(farasula, 3),
    pricePerFarasula: roundTo(pricePerFarasula, 2),
    quantityKg: Number.isFinite(kg) ? kg : 0,
  };
}
