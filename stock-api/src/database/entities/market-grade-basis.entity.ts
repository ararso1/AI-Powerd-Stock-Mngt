import {
  Column,
  CreateDateColumn,
  Entity,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UuidBaseEntity } from './uuid-base.entity';

/**
 * Grade differential vs ICE benchmark (USD/kg added to market usd/kg).
 * coffeeType: ARABICA uses KC, ROBUSTA uses RC.
 */
@Entity('market_grade_basis')
@Unique(['grade', 'coffeeType'])
export class MarketGradeBasis extends UuidBaseEntity {
  @Column({ type: 'varchar', length: 32 })
  grade: string;

  @Column({ name: 'coffee_type', type: 'varchar', length: 16 })
  coffeeType: string;

  /** Added to ICE usd/kg (can be negative). */
  @Column({
    name: 'differential_usd_per_kg',
    type: 'decimal',
    precision: 14,
    scale: 6,
    default: 0,
  })
  differentialUsdPerKg: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
