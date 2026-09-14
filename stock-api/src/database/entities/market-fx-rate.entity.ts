import {
  Column,
  CreateDateColumn,
  Entity,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('market_fx_rates')
@Unique(['baseCurrency', 'quoteCurrency', 'rateDate'])
export class MarketFxRate extends UuidBaseEntity {
  @Column({ name: 'base_currency', type: 'varchar', length: 8, default: 'USD' })
  baseCurrency: string;

  @Column({ name: 'quote_currency', type: 'varchar', length: 8, default: 'ETB' })
  quoteCurrency: string;

  @Column({ name: 'rate_date', type: 'date' })
  rateDate: string;

  /** How many quote units per 1 base (e.g. ETB per 1 USD). */
  @Column({ type: 'decimal', precision: 18, scale: 6 })
  rate: string;

  @Column({ type: 'varchar', length: 64, default: 'open.er-api.com' })
  source: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
