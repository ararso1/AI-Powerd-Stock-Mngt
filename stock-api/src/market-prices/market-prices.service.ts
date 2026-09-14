import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CoffeeForm,
  ExportContractStatus,
  LotStatus,
} from '../common/enums';
import { ExportContract } from '../database/entities/export-contract.entity';
import { Lot } from '../database/entities/lot.entity';
import { MarketFxRate } from '../database/entities/market-fx-rate.entity';
import { MarketGradeBasis } from '../database/entities/market-grade-basis.entity';
import { MarketPrice } from '../database/entities/market-price.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
import { MarketFeedService } from './market-feed.service';
import {
  pctChange,
  priceUnitsFromUsdPerKg,
  roundN,
} from './market-units.util';
import { randomUUID } from 'crypto';

const DEFAULT_BASIS: Array<{
  grade: string;
  coffeeType: string;
  differentialUsdPerKg: number;
  note: string;
}> = [
  { grade: 'G1', coffeeType: 'ARABICA', differentialUsdPerKg: 0.55, note: 'Grade 1 premium vs KC' },
  { grade: 'G2', coffeeType: 'ARABICA', differentialUsdPerKg: 0.25, note: 'Grade 2 vs KC' },
  { grade: 'G3', coffeeType: 'ARABICA', differentialUsdPerKg: 0.05, note: 'Grade 3 vs KC' },
  { grade: 'G4', coffeeType: 'ARABICA', differentialUsdPerKg: -0.15, note: 'Grade 4 discount' },
  { grade: 'G5', coffeeType: 'ARABICA', differentialUsdPerKg: -0.35, note: 'Grade 5 discount' },
  { grade: 'UG', coffeeType: 'ARABICA', differentialUsdPerKg: -0.55, note: 'Ungraded discount' },
  { grade: 'G1', coffeeType: 'ROBUSTA', differentialUsdPerKg: 0.2, note: 'Robusta G1 vs RC' },
  { grade: 'G2', coffeeType: 'ROBUSTA', differentialUsdPerKg: 0.05, note: 'Robusta G2 vs RC' },
  { grade: 'G3', coffeeType: 'ROBUSTA', differentialUsdPerKg: -0.1, note: 'Robusta G3 vs RC' },
];

@Injectable()
export class MarketPricesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketPricesService.name);
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private syncing = false;

  constructor(
    private readonly config: ConfigService,
    private readonly feed: MarketFeedService,
    @InjectRepository(MarketPrice)
    private readonly priceRepo: Repository<MarketPrice>,
    @InjectRepository(MarketFxRate)
    private readonly fxRepo: Repository<MarketFxRate>,
    @InjectRepository(MarketGradeBasis)
    private readonly basisRepo: Repository<MarketGradeBasis>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
    @InjectRepository(StockLevel)
    private readonly stockRepo: Repository<StockLevel>,
    @InjectRepository(ExportContract)
    private readonly exportRepo: Repository<ExportContract>,
  ) {}

  onModuleInit() {
    void this.ensureGradeBasis();
    void this.syncPrices().catch((e) =>
      this.logger.warn(`Initial market sync failed: ${(e as Error).message}`),
    );
    const interval =
      this.config.get<number>('market.syncIntervalMs') ?? 6 * 60 * 60 * 1000;
    this.syncTimer = setInterval(() => {
      void this.syncPrices().catch((e) =>
        this.logger.warn(`Scheduled market sync failed: ${(e as Error).message}`),
      );
    }, interval);
  }

  onModuleDestroy() {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  async ensureGradeBasis() {
    for (const row of DEFAULT_BASIS) {
      await this.basisRepo
        .createQueryBuilder()
        .insert()
        .into(MarketGradeBasis)
        .values({
          id: randomUUID(),
          grade: row.grade,
          coffeeType: row.coffeeType,
          differentialUsdPerKg: row.differentialUsdPerKg.toFixed(6),
          note: row.note,
          isActive: true,
        })
        .orIgnore()
        .execute();
    }
  }

  async syncPrices() {
    if (this.syncing) return { skipped: true };
    this.syncing = true;
    try {
      let bars = await this.feed.fetchAll();
      const allowDemo =
        this.config.get<boolean>('market.allowDemoFallback') !== false;
      const hasRc = bars.some((b) => b.symbol === 'RC');
      if (!hasRc && allowDemo) {
        const kc = bars.filter((b) => b.symbol === 'KC');
        if (kc.length) {
          bars = [...bars, ...this.feed.buildRobustaProxyFromKc(kc)];
          this.logger.log('RC feed missing — stored KC-ratio proxy series');
        }
      }

      let upserted = 0;
      for (const bar of bars) {
        const usdPerKg = this.feed.toUsdPerKg(bar.nativePrice, bar.nativeUnit);
        const existing = await this.priceRepo.findOne({
          where: { symbol: bar.symbol, priceDate: bar.priceDate },
        });
        if (existing) {
          existing.nativePrice = bar.nativePrice.toFixed(6);
          existing.nativeUnit = bar.nativeUnit;
          existing.usdPerKg = usdPerKg.toFixed(6);
          existing.openPrice =
            bar.open != null ? Number(bar.open).toFixed(6) : null;
          existing.highPrice =
            bar.high != null ? Number(bar.high).toFixed(6) : null;
          existing.lowPrice =
            bar.low != null ? Number(bar.low).toFixed(6) : null;
          existing.closePrice =
            bar.close != null ? Number(bar.close).toFixed(6) : null;
          existing.source = bar.source;
          await this.priceRepo.save(existing);
        } else {
          await this.priceRepo.save(
            this.priceRepo.create({
              id: randomUUID(),
              symbol: bar.symbol,
              priceDate: bar.priceDate,
              nativePrice: bar.nativePrice.toFixed(6),
              nativeUnit: bar.nativeUnit,
              usdPerKg: usdPerKg.toFixed(6),
              openPrice:
                bar.open != null ? Number(bar.open).toFixed(6) : null,
              highPrice:
                bar.high != null ? Number(bar.high).toFixed(6) : null,
              lowPrice: bar.low != null ? Number(bar.low).toFixed(6) : null,
              closePrice:
                bar.close != null ? Number(bar.close).toFixed(6) : null,
              source: bar.source,
              currencyCode: 'USD',
            }),
          );
        }
        upserted += 1;
      }

      const fx = await this.feed.fetchUsdEtb();
      const fxExisting = await this.fxRepo.findOne({
        where: {
          baseCurrency: 'USD',
          quoteCurrency: 'ETB',
          rateDate: fx.rateDate,
        },
      });
      if (fxExisting) {
        fxExisting.rate = fx.rate.toFixed(6);
        fxExisting.source = fx.source;
        await this.fxRepo.save(fxExisting);
      } else {
        await this.fxRepo.save(
          this.fxRepo.create({
            id: randomUUID(),
            baseCurrency: 'USD',
            quoteCurrency: 'ETB',
            rateDate: fx.rateDate,
            rate: fx.rate.toFixed(6),
            source: fx.source,
          }),
        );
      }

      this.logger.log(`Market sync upserted ${upserted} bars · FX ${fx.rate}`);
      return { upserted, fxRate: fx.rate, fxSource: fx.source };
    } finally {
      this.syncing = false;
    }
  }

  async getUsdEtb(): Promise<{ rate: number; rateDate: string; source: string }> {
    const latest = await this.fxRepo.find({
      where: { baseCurrency: 'USD', quoteCurrency: 'ETB' },
      order: { rateDate: 'DESC' },
      take: 1,
    });
    if (latest[0]) {
      return {
        rate: parseFloat(latest[0].rate),
        rateDate: latest[0].rateDate,
        source: latest[0].source,
      };
    }
    const fx = await this.feed.fetchUsdEtb();
    return { rate: fx.rate, rateDate: fx.rateDate, source: fx.source };
  }

  private async latestFor(symbol: string) {
    return this.priceRepo.find({
      where: { symbol },
      order: { priceDate: 'DESC' },
      take: 1,
    }).then((r) => r[0] ?? null);
  }

  private async priceOnOrBefore(symbol: string, date: string) {
    return this.priceRepo
      .createQueryBuilder('p')
      .where('p.symbol = :symbol', { symbol })
      .andWhere('p.price_date <= :date', { date })
      .orderBy('p.price_date', 'DESC')
      .getOne();
  }

  async getCurrent() {
    const fx = await this.getUsdEtb();
    const symbols = ['KC', 'RC'] as const;
    type Card = {
      symbol: string;
      name: string;
      available: boolean;
      priceDate?: string;
      nativePrice?: number;
      nativeUnit?: string;
      source?: string;
      change7dPercent?: number | null;
      change30dPercent?: number | null;
      usdPerKg?: number;
      usdPerQuintal?: number;
      usdPerTon?: number;
      etbPerKg?: number;
      etbPerQuintal?: number;
      etbPerTon?: number;
      etbFx?: { rate: number; rateDate: string; source: string };
    };
    const cards: Card[] = [];
    for (const symbol of symbols) {
      const latest = await this.latestFor(symbol);
      if (!latest) {
        cards.push({
          symbol,
          name: symbol === 'KC' ? 'ICE Arabica (KC)' : 'ICE Robusta (RC)',
          available: false,
        });
        continue;
      }
      const d7 = new Date(latest.priceDate);
      d7.setDate(d7.getDate() - 7);
      const d30 = new Date(latest.priceDate);
      d30.setDate(d30.getDate() - 30);
      const prev7 = await this.priceOnOrBefore(
        symbol,
        d7.toISOString().slice(0, 10),
      );
      const prev30 = await this.priceOnOrBefore(
        symbol,
        d30.toISOString().slice(0, 10),
      );
      const usdPerKg = parseFloat(latest.usdPerKg);
      const units = priceUnitsFromUsdPerKg(usdPerKg, fx.rate);
      cards.push({
        symbol,
        name: symbol === 'KC' ? 'ICE Arabica (KC)' : 'ICE Robusta (RC)',
        available: true,
        priceDate: latest.priceDate,
        nativePrice: parseFloat(latest.nativePrice),
        nativeUnit: latest.nativeUnit,
        source: latest.source,
        change7dPercent: prev7
          ? pctChange(usdPerKg, parseFloat(prev7.usdPerKg))
          : null,
        change30dPercent: prev30
          ? pctChange(usdPerKg, parseFloat(prev30.usdPerKg))
          : null,
        ...units,
        etbFx: fx,
      });
    }
    return { asOf: new Date().toISOString(), fx, instruments: cards };
  }

  async getHistory(symbol: string, from?: string, to?: string) {
    const sym = symbol.toUpperCase();
    const qb = this.priceRepo
      .createQueryBuilder('p')
      .where('p.symbol = :sym', { sym })
      .orderBy('p.price_date', 'ASC');
    if (from) qb.andWhere('p.price_date >= :from', { from });
    if (to) qb.andWhere('p.price_date <= :to', { to });
    const rows = await qb.getMany();
    const fx = await this.getUsdEtb();
    return {
      symbol: sym,
      fx,
      series: rows.map((r) => {
        const usdPerKg = parseFloat(r.usdPerKg);
        const units = priceUnitsFromUsdPerKg(usdPerKg, fx.rate);
        return {
          date: r.priceDate,
          nativePrice: parseFloat(r.nativePrice),
          nativeUnit: r.nativeUnit,
          usdPerKg: units.usdPerKg,
          etbPerKg: units.etbPerKg,
          usdPerQuintal: units.usdPerQuintal,
          etbPerQuintal: units.etbPerQuintal,
          usdPerTon: units.usdPerTon,
          etbPerTon: units.etbPerTon,
          source: r.source,
        };
      }),
    };
  }

  async listGradeBasis() {
    return this.basisRepo.find({
      where: { isActive: true },
      order: { coffeeType: 'ASC', grade: 'ASC' },
    });
  }

  async pricedGrade(grade: string, coffeeType = 'ARABICA') {
    const type = coffeeType.toUpperCase();
    const symbol = type === 'ROBUSTA' ? 'RC' : 'KC';
    const latest = await this.latestFor(symbol);
    const fx = await this.getUsdEtb();
    if (!latest) {
      return { available: false, grade, coffeeType: type, symbol };
    }
    const basis = await this.basisRepo.findOne({
      where: { grade: grade.toUpperCase(), coffeeType: type, isActive: true },
    });
    const differential = basis ? parseFloat(basis.differentialUsdPerKg) : 0;
    const marketUsd = parseFloat(latest.usdPerKg);
    const gradeUsd = marketUsd + differential;
    const units = priceUnitsFromUsdPerKg(gradeUsd, fx.rate);
    return {
      available: true,
      grade: grade.toUpperCase(),
      coffeeType: type,
      symbol,
      marketUsdPerKg: roundN(marketUsd),
      differentialUsdPerKg: roundN(differential),
      priceDate: latest.priceDate,
      fx,
      ...units,
      suggestExportUsdPerKg: roundN(gradeUsd * 1.08),
      suggestLocalEtbPerKg: roundN(units.etbPerKg * 0.92),
    };
  }

  async inventoryValuation() {
    const fx = await this.getUsdEtb();
    const kc = await this.latestFor('KC');
    const rc = await this.latestFor('RC');
    const basis = await this.basisRepo.find({ where: { isActive: true } });
    const basisMap = new Map(
      basis.map((b) => [`${b.coffeeType}:${b.grade}`, parseFloat(b.differentialUsdPerKg)]),
    );

    const lots = await this.lotRepo.find({
      where: { status: LotStatus.ACTIVE, form: CoffeeForm.GREEN },
    });

    if (lots.length === 0) {
      return {
        fx,
        totalKg: 0,
        bookValueEtb: 0,
        marketValueUsd: 0,
        marketValueEtb: 0,
        gapEtb: 0,
        gapPercent: null,
        byGrade: [],
        benchmarks: {
          kc: kc
            ? { priceDate: kc.priceDate, usdPerKg: parseFloat(kc.usdPerKg) }
            : null,
          rc: rc
            ? { priceDate: rc.priceDate, usdPerKg: parseFloat(rc.usdPerKg) }
            : null,
        },
      };
    }

    let bookEtb = 0;
    let marketEtb = 0;
    let marketUsd = 0;
    let qty = 0;
    const byGrade: Record<
      string,
      { kg: number; bookEtb: number; marketEtb: number }
    > = {};

    const stocks = await this.stockRepo.find({
      where: { lotId: In(lots.map((l) => l.id).filter(Boolean)) },
      relations: { item: true },
    });
    const stockByLot = new Map<string, StockLevel[]>();
    for (const s of stocks) {
      if (!s.lotId) continue;
      const arr = stockByLot.get(s.lotId) ?? [];
      arr.push(s);
      stockByLot.set(s.lotId, arr);
    }

    for (const lot of lots) {
      const lotStocks = stockByLot.get(lot.id) ?? [];
      const lotQty =
        lotStocks.reduce((sum, s) => sum + parseFloat(s.quantity), 0) ||
        parseFloat(lot.quantity);
      if (lotQty <= 0) continue;
      const avgBook =
        lotStocks.length > 0
          ? lotStocks.reduce(
              (sum, s) =>
                sum + parseFloat(s.quantity) * parseFloat(s.purchasePrice),
              0,
            ) / lotQty
          : 0;
      bookEtb += lotQty * avgBook;
      qty += lotQty;

      const coffeeType = /robust/i.test(lot.variety ?? '')
        ? 'ROBUSTA'
        : 'ARABICA';
      const symbolPrice = coffeeType === 'ROBUSTA' ? rc : kc;
      const grade = (lot.grade ?? 'UG').toUpperCase();
      const diff =
        basisMap.get(`${coffeeType}:${grade}`) ??
        basisMap.get(`${coffeeType}:UG`) ??
        0;
      const mUsd = symbolPrice
        ? parseFloat(symbolPrice.usdPerKg) + diff
        : 0;
      const mEtb = mUsd * fx.rate;
      marketUsd += lotQty * mUsd;
      marketEtb += lotQty * mEtb;

      const key = `${coffeeType} ${grade}`;
      if (!byGrade[key]) byGrade[key] = { kg: 0, bookEtb: 0, marketEtb: 0 };
      byGrade[key].kg += lotQty;
      byGrade[key].bookEtb += lotQty * avgBook;
      byGrade[key].marketEtb += lotQty * mEtb;
    }

    return {
      fx,
      totalKg: roundN(qty, 3),
      bookValueEtb: roundN(bookEtb, 2),
      marketValueUsd: roundN(marketUsd, 2),
      marketValueEtb: roundN(marketEtb, 2),
      gapEtb: roundN(marketEtb - bookEtb, 2),
      gapPercent:
        bookEtb > 0 ? roundN(((marketEtb - bookEtb) / bookEtb) * 100, 1) : null,
      byGrade: Object.entries(byGrade).map(([grade, v]) => ({
        grade,
        kg: roundN(v.kg, 3),
        bookEtb: roundN(v.bookEtb, 2),
        marketEtb: roundN(v.marketEtb, 2),
      })),
      benchmarks: {
        kc: kc
          ? { priceDate: kc.priceDate, usdPerKg: parseFloat(kc.usdPerKg) }
          : null,
        rc: rc
          ? { priceDate: rc.priceDate, usdPerKg: parseFloat(rc.usdPerKg) }
          : null,
      },
    };
  }

  async exportGuidance() {
    const fx = await this.getUsdEtb();
    const open = await this.exportRepo.find({
      where: {
        status: In([
          ExportContractStatus.DRAFT,
          ExportContractStatus.ALLOCATED,
          ExportContractStatus.STAGED,
        ]),
      },
      take: 40,
      order: { createdAt: 'DESC' },
    });
    type Row = {
      contractId: string;
      contractNumber: string;
      grade: string | null;
      coffeeType: string;
      contractUsdPerKg: number;
      marketUsdPerKg: number;
      suggestedUsdPerKg: number;
      spreadPercent: number | null;
      currencyCode: string;
    };
    const rows: Row[] = [];
    for (const c of open) {
      const type = /robust/i.test(c.coffeeType ?? '') ? 'ROBUSTA' : 'ARABICA';
      const priced = await this.pricedGrade(c.grade ?? 'G1', type);
      if (!priced.available || !('usdPerKg' in priced)) continue;
      const contractUsd = parseFloat(c.pricePerKg ?? '0');
      const marketUsd = priced.usdPerKg;
      const spreadPct =
        marketUsd > 0
          ? roundN(((contractUsd - marketUsd) / marketUsd) * 100, 1)
          : null;
      rows.push({
        contractId: c.id,
        contractNumber: c.contractNumber,
        grade: c.grade,
        coffeeType: type,
        contractUsdPerKg: contractUsd,
        marketUsdPerKg: marketUsd,
        suggestedUsdPerKg: priced.suggestExportUsdPerKg,
        spreadPercent: spreadPct,
        currencyCode: c.currencyCode ?? 'USD',
      });
    }
    return { fx, contracts: rows };
  }

  /** Compact payload for Command Center widgets. */
  async getDashboardMarket() {
    const current = await this.getCurrent();
    const histKc = await this.getHistory('KC');
    const series = histKc.series.slice(-30).map((p) => ({
      date: p.date.slice(5),
      usdPerKg: roundN(p.usdPerKg, 3),
      etbPerKg: roundN(p.etbPerKg, 1),
    }));
    const valuation = await this.inventoryValuation();
    return {
      instruments: current.instruments,
      fx: current.fx,
      chart30d: series,
      valuation: {
        marketValueEtb: valuation.marketValueEtb,
        bookValueEtb: valuation.bookValueEtb,
        gapPercent: valuation.gapPercent,
      },
    };
  }

  /** Rule drafts for AI MARKET_ALERT insights. */
  async buildMarketInsightDrafts(): Promise<
    Array<{
      code: string;
      kind: string;
      severity: 'info' | 'warn' | 'critical';
      title: string;
      summary: string;
      href: string;
      payload: Record<string, unknown>;
    }>
  > {
    const drafts: Array<{
      code: string;
      kind: string;
      severity: 'info' | 'warn' | 'critical';
      title: string;
      summary: string;
      href: string;
      payload: Record<string, unknown>;
    }> = [];

    const current = await this.getCurrent();
    for (const inst of current.instruments) {
      if (!inst.available) continue;
      const ch7 = inst.change7dPercent;
      if (ch7 != null && Math.abs(ch7) >= 5) {
        drafts.push({
          code: `MARKET-MOVE-${inst.symbol}`,
          kind: 'MARKET_ALERT',
          severity: Math.abs(ch7) >= 10 ? 'critical' : 'warn',
          title: `${inst.name} moved ${ch7 > 0 ? '+' : ''}${ch7}% in 7 days`,
          summary: `Spot ≈ ${roundN(inst.usdPerKg ?? 0, 3)} USD/kg (${roundN(inst.etbPerKg ?? 0, 1)} ETB/kg). Review export offers and inventory hedges.`,
          href: '/market-prices',
          payload: {
            symbol: inst.symbol,
            change7dPercent: ch7,
            usdPerKg: inst.usdPerKg,
          },
        });
      }
    }

    const valuation = await this.inventoryValuation();
    if (
      valuation.gapPercent != null &&
      Math.abs(valuation.gapPercent) >= 12
    ) {
      drafts.push({
        code: 'MARKET-INV-GAP',
        kind: 'MARKET_ALERT',
        severity: valuation.gapPercent <= -12 ? 'warn' : 'info',
        title: `Green stock market value is ${valuation.gapPercent > 0 ? '+' : ''}${valuation.gapPercent}% vs book`,
        summary: `Book ${valuation.bookValueEtb.toLocaleString()} ETB · Market ${valuation.marketValueEtb.toLocaleString()} ETB on ${valuation.totalKg} kg green.`,
        href: '/market-prices',
        payload: valuation,
      });
    }

    const guidance = await this.exportGuidance();
    const underpriced = guidance.contracts.filter(
      (c) => c.spreadPercent != null && c.spreadPercent <= -8,
    );
    if (underpriced[0]) {
      const c = underpriced[0];
      drafts.push({
        code: `MARKET-EXPORT-${c.contractId}`,
        kind: 'MARKET_ALERT',
        severity: 'warn',
        title: `${c.contractNumber} is ${Math.abs(c.spreadPercent!)}% below ICE-linked grade price`,
        summary: `Contract ${c.contractUsdPerKg} USD/kg vs market ${c.marketUsdPerKg} USD/kg (suggest ${c.suggestedUsdPerKg}).`,
        href: `/exports/${c.contractId}`,
        payload: c,
      });
    }

    return drafts;
  }
}
