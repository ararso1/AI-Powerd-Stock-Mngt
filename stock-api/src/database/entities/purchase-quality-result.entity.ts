import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { Lot } from './lot.entity';
import { PurchaseLine } from './purchase-line.entity';
import { Purchase } from './purchase.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

/**
 * Ethiopian Coffee and Tea Authority (ECTA) lab / buyer quality results
 * linked to a purchase line and coffee lot.
 */
@Entity('purchase_quality_results')
export class PurchaseQualityResult extends UuidBaseEntity {
  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @Column({ name: 'purchase_line_id', type: 'uuid', unique: true })
  purchaseLineId: string;

  @Column({ name: 'lot_id', type: 'uuid' })
  lotId: string;

  @Column({ name: 'lab_name', type: 'varchar', length: 200, default: 'ECTA' })
  labName: string;

  @Column({ name: 'tested_at', type: 'date', nullable: true })
  testedAt: string | null;

  @Column({ name: 'certificate_number', type: 'varchar', length: 120, nullable: true })
  certificateNumber: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  grade: string | null;

  @Column({
    name: 'moisture_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  moisturePercent: string | null;

  @Column({ name: 'screen_size', type: 'varchar', length: 40, nullable: true })
  screenSize: string | null;

  @Column({
    name: 'cupping_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  cuppingScore: string | null;

  @Column({ name: 'defect_count', type: 'int', nullable: true })
  defectCount: number | null;

  @Column({ name: 'defect_level', type: 'varchar', length: 40, nullable: true })
  defectLevel: string | null;

  @Column({ type: 'boolean', nullable: true })
  passed: boolean | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Relative path under uploads/purchases/quality/ */
  @Column({ name: 'document_storage_key', type: 'varchar', length: 500, nullable: true })
  documentStorageKey: string | null;

  @Column({ name: 'document_original_name', type: 'varchar', length: 255, nullable: true })
  documentOriginalName: string | null;

  @Column({ name: 'document_mime_type', type: 'varchar', length: 120, nullable: true })
  documentMimeType: string | null;

  @Column({ name: 'document_size_bytes', type: 'int', nullable: true })
  documentSizeBytes: number | null;

  @Column({ name: 'recorded_by_id', type: 'uuid', nullable: true })
  recordedById: string | null;

  @ManyToOne(() => Purchase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;

  @ManyToOne(() => PurchaseLine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_line_id' })
  purchaseLine: PurchaseLine;

  @ManyToOne(() => Lot, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recorded_by_id' })
  recordedBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
