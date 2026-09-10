import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('roast_profiles')
export class RoastProfile extends UuidBaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** e.g. Light, Medium, City, Full City, Dark */
  @Column({ name: 'roast_level', type: 'varchar', length: 40, nullable: true })
  roastLevel: string | null;

  @Column({ name: 'target_agtron', type: 'int', nullable: true })
  targetAgtron: number | null;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number | null;

  /** Free-text blend guidance (lot ratios). */
  @Column({ name: 'blend_notes', type: 'text', nullable: true })
  blendNotes: string | null;

  /** Days from roast date until best-before. */
  @Column({ name: 'shelf_life_days', type: 'int', default: 90 })
  shelfLifeDays: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
