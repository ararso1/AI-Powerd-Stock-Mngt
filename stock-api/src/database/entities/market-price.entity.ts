import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UuidBaseEntity } from './uuid-base.entity';

/** ICE Arabica (KC) or Robusta (RC) daily settlement / close. */
@Entity('market_prices')
@Unique(['symbol', 'priceDate'])
@Index(['symbol', 'priceDate'])
export class MarketPrice extends UuidBaseEntity {
  /** KC | RC */
  @Column({ type: 'varchar', length: 8 })
  symbol: string;

  @Column({ name: 'price_date', type: 'date' })
  priceDate: string;

  /**
   * Native exchange quote:
   * - KC: US cents per pound
   * - RC: USD per metric ton
   */
  @Column({
    name: 'native_price',
    type: 'decimal',
    precision: 18,
    scale: 6,
  })
  nativePrice: string;

  /** CENTS_PER_LB | USD_PER_MT */
  @Column({ name: 'native_unit', type: 'varchar', length: 32 })
  nativeUnit: string;

  @Column({
    name: 'usd_per_kg',
    type: 'decimal',
    precision: 18,
    scale: 6,
  })
  usdPerKg: string;

  @Column({
    name: 'open_price',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  openPrice: string | null;

  @Column({
    name: 'high_price',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  highPrice: string | null;

  @Column({
    name: 'low_price',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  lowPrice: string | null;

  @Column({
    name: 'close_price',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  closePrice: string | null;

  @Column({ type: 'varchar', length: 64, default: 'yahoo' })
  source: string;

  @Column({ name: 'currency_code', type: 'varchar', length: 8, default: 'USD' })
  currencyCode: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
