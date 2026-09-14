import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  nativeToUsdPerKg,
  type NativeUnit,
} from './market-units.util';

export type FetchedBar = {
  symbol: 'KC' | 'RC';
  priceDate: string; // YYYY-MM-DD
  nativePrice: number;
  nativeUnit: NativeUnit;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  source: string;
};

@Injectable()
export class MarketFeedService {
  private readonly logger = new Logger(MarketFeedService.name);

  constructor(private readonly config: ConfigService) {}

  async fetchAll(): Promise<FetchedBar[]> {
    const out: FetchedBar[] = [];
    const kc = await this.fetchYahooArabica();
    if (kc.length) out.push(...kc);

    const commoditiesKey = this.config.get<string>('market.commoditiesApiKey') ?? '';
    if (commoditiesKey) {
      const fromApi = await this.fetchCommoditiesApi(commoditiesKey);
      // Prefer commodities RC; keep Yahoo KC unless commodities returned KC
      const apiRc = fromApi.filter((b) => b.symbol === 'RC');
      const apiKc = fromApi.filter((b) => b.symbol === 'KC');
      out.push(...apiRc);
      if (apiKc.length && !kc.length) out.push(...apiKc);
    } else {
      const yahooRc = this.config.get<string>('market.yahooRobustaSymbol') ?? '';
      if (yahooRc) {
        const rc = await this.fetchYahooGeneric(yahooRc, 'RC', 'USD_PER_MT');
        out.push(...rc);
      }
    }

    return out;
  }

  async fetchUsdEtb(): Promise<{ rate: number; source: string; rateDate: string }> {
    const today = new Date().toISOString().slice(0, 10);
    const fallback =
      this.config.get<number>('market.fallbackUsdEtb') ?? 120;
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
      const json = (await res.json()) as {
        result?: string;
        rates?: { ETB?: number };
        time_last_update_utc?: string;
      };
      const rate = Number(json.rates?.ETB);
      if (!rate || !Number.isFinite(rate)) throw new Error('ETB missing');
      return { rate, source: 'open.er-api.com', rateDate: today };
    } catch (e) {
      this.logger.warn(`USD/ETB fetch failed: ${(e as Error).message}`);
      return { rate: fallback, source: 'fallback', rateDate: today };
    }
  }

  private async fetchYahooArabica(): Promise<FetchedBar[]> {
    const symbol =
      this.config.get<string>('market.yahooArabicaSymbol') ?? 'KC=F';
    return this.fetchYahooGeneric(symbol, 'KC', 'CENTS_PER_LB');
  }

  private async fetchYahooGeneric(
    yahooSymbol: string,
    symbol: 'KC' | 'RC',
    unit: NativeUnit,
  ): Promise<FetchedBar[]> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=3mo`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CsolveMarketSync/1.0' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
      const json = (await res.json()) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: {
              quote?: Array<{
                open?: Array<number | null>;
                high?: Array<number | null>;
                low?: Array<number | null>;
                close?: Array<number | null>;
              }>;
            };
          }>;
        };
      };
      const result = json.chart?.result?.[0];
      const ts = result?.timestamp ?? [];
      const quote = result?.indicators?.quote?.[0];
      if (!ts.length || !quote?.close?.length) return [];

      const bars: FetchedBar[] = [];
      for (let i = 0; i < ts.length; i++) {
        const close = quote.close[i];
        if (close == null || !Number.isFinite(close)) continue;
        const d = new Date(ts[i] * 1000);
        const priceDate = d.toISOString().slice(0, 10);
        bars.push({
          symbol,
          priceDate,
          nativePrice: close,
          nativeUnit: unit,
          open: quote.open?.[i] ?? null,
          high: quote.high?.[i] ?? null,
          low: quote.low?.[i] ?? null,
          close,
          source: `yahoo:${yahooSymbol}`,
        });
      }
      return bars;
    } catch (e) {
      this.logger.warn(
        `Yahoo ${yahooSymbol} failed: ${(e as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Commodities-API timeseries.
   * KC continuous / contract symbols vary by plan; ROBUSTA is documented.
   * Rates are often inverted (1/price) for some commodities — we detect magnitude.
   */
  private async fetchCommoditiesApi(apiKey: string): Promise<FetchedBar[]> {
    const base =
      this.config.get<string>('market.commoditiesBaseUrl') ??
      'https://commodities-api.com/api';
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 90);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const symbols = ['ROBUSTA', 'COFFEE'];
    const out: FetchedBar[] = [];

    for (const sym of symbols) {
      try {
        const url = `${base}/timeseries?access_key=${encodeURIComponent(apiKey)}&start_date=${startStr}&end_date=${endStr}&base=USD&symbols=${sym}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          success?: boolean;
          rates?: Record<string, Record<string, number>>;
        };
        if (!json.success || !json.rates) continue;

        const mappedSymbol: 'KC' | 'RC' = sym === 'ROBUSTA' ? 'RC' : 'KC';
        const unit: NativeUnit =
          mappedSymbol === 'RC' ? 'USD_PER_MT' : 'CENTS_PER_LB';

        for (const [date, rates] of Object.entries(json.rates)) {
          const raw = Number(rates[sym]);
          if (!raw || !Number.isFinite(raw)) continue;
          // Commodities-API often returns units-per-USD (inverted). Invert if tiny.
          let native = raw < 0.01 ? 1 / raw : raw;
          // Arabica typically 100–400 cents/lb; if looks like USD/lb scale up.
          if (mappedSymbol === 'KC' && native < 50) native = native * 100;
          // Robusta typically 2000–6000 USD/MT
          if (mappedSymbol === 'RC' && native < 100) native = native * 1000;

          out.push({
            symbol: mappedSymbol,
            priceDate: date,
            nativePrice: native,
            nativeUnit: unit,
            close: native,
            source: `commodities-api:${sym}`,
          });
        }
      } catch (e) {
        this.logger.warn(
          `Commodities-API ${sym} failed: ${(e as Error).message}`,
        );
      }
    }
    return out;
  }

  /** Demo RC bars derived from KC when live Robusta feed unavailable. */
  buildRobustaProxyFromKc(
    kcBars: FetchedBar[],
    ratioUsdMtPerKcCents = 12.5,
  ): FetchedBar[] {
    return kcBars.map((b) => {
      const native = b.nativePrice * ratioUsdMtPerKcCents;
      return {
        symbol: 'RC' as const,
        priceDate: b.priceDate,
        nativePrice: native,
        nativeUnit: 'USD_PER_MT' as const,
        close: native,
        open: b.open != null ? b.open * ratioUsdMtPerKcCents : null,
        high: b.high != null ? b.high * ratioUsdMtPerKcCents : null,
        low: b.low != null ? b.low * ratioUsdMtPerKcCents : null,
        source: 'proxy:kc-ratio',
      };
    });
  }

  toUsdPerKg(native: number, unit: NativeUnit): number {
    return nativeToUsdPerKg(native, unit);
  }
}
