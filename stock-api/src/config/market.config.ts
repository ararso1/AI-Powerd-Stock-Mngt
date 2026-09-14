import { registerAs } from '@nestjs/config';

export default registerAs('market', () => ({
  /** Commodities-API key (optional). Enables ROBUSTA / continuous symbols. */
  commoditiesApiKey: process.env.COMMODITIES_API_KEY ?? '',
  commoditiesBaseUrl:
    process.env.COMMODITIES_API_BASE_URL ?? 'https://commodities-api.com/api',
  /** Yahoo chart symbols */
  yahooArabicaSymbol: process.env.MARKET_YAHOO_KC ?? 'KC=F',
  yahooRobustaSymbol: process.env.MARKET_YAHOO_RC ?? '',
  /** Sync interval ms (default 6h) */
  syncIntervalMs: Number(process.env.MARKET_SYNC_INTERVAL_MS ?? 6 * 60 * 60 * 1000),
  /** Allow demo/proxy RC when live Robusta feed is unavailable */
  allowDemoFallback: (process.env.MARKET_ALLOW_DEMO_FALLBACK ?? 'true') === 'true',
  /** Default USD→ETB if FX API fails */
  fallbackUsdEtb: Number(process.env.MARKET_FALLBACK_USD_ETB ?? 120),
}));
