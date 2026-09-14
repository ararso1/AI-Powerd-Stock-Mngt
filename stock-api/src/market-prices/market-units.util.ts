/** ICE Arabica KC is quoted in US cents per pound. */
const LB_TO_KG = 0.45359237;

export type NativeUnit = 'CENTS_PER_LB' | 'USD_PER_MT';

export function centsPerLbToUsdPerKg(centsPerLb: number): number {
  const usdPerLb = centsPerLb / 100;
  return usdPerLb / LB_TO_KG;
}

export function usdPerMtToUsdPerKg(usdPerMt: number): number {
  return usdPerMt / 1000;
}

export function nativeToUsdPerKg(native: number, unit: NativeUnit): number {
  if (unit === 'CENTS_PER_LB') return centsPerLbToUsdPerKg(native);
  return usdPerMtToUsdPerKg(native);
}

export function priceUnitsFromUsdPerKg(
  usdPerKg: number,
  usdToEtb: number,
): {
  usdPerKg: number;
  usdPerQuintal: number;
  usdPerTon: number;
  etbPerKg: number;
  etbPerQuintal: number;
  etbPerTon: number;
} {
  const usdPerQuintal = usdPerKg * 100; // app quintal = 100 kg
  const usdPerTon = usdPerKg * 1000;
  return {
    usdPerKg,
    usdPerQuintal,
    usdPerTon,
    etbPerKg: usdPerKg * usdToEtb,
    etbPerQuintal: usdPerQuintal * usdToEtb,
    etbPerTon: usdPerTon * usdToEtb,
  };
}

export function roundN(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return roundN(((current - previous) / previous) * 100, 2);
}
