import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { UuidBaseEntity } from './uuid-base.entity';

/** Seasonal cherry grade price list (ETB/kg). */
@Entity('cherry_prices')
@Index('UQ_cherry_prices_grade_season', ['grade', 'cropYear'], { unique: true })
export class CherryPrice extends UuidBaseEntity {
  @Column({ type: 'varchar', length: 80 })
  grade: string;

  @Column({ name: 'crop_year', type: 'varchar', length: 20 })
  cropYear: string;

  @Column({ name: 'price_per_kg', type: 'decimal', precision: 14, scale: 2 })
  pricePerKg: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
