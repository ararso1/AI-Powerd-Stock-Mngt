export interface Currency {
  code: string;
  symbol: string;
}

export const DEFAULT_CURRENCY: Currency = {
  code: "ETB",
  symbol: "Br",
};

let currency: Currency = { ...DEFAULT_CURRENCY };
let revision = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function getCurrencyConfig(): Currency {
  return currency;
}

export function getCurrencyRevision(): number {
  return revision;
}

export function subscribeCurrency(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setCurrencyConfig(next: Currency): void {
  if (
    currency.code === next.code &&
    currency.symbol === next.symbol
  ) {
    return;
  }
  currency = { ...next };
  revision += 1;
  notify();
}

export function applyCurrencyFromResponse(
  data?: { currency?: Currency } | null
): void {
  if (data?.currency?.code && data.currency.symbol) {
    setCurrencyConfig(data.currency);
  }
}
