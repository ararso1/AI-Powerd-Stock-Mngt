import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import {
  AiInsightKind,
  AiInsightSeverity,
  AiInsightSource,
  AiInsightStatus,
} from '../../common/enums';
import { AiFeedback } from './ai-feedback.entity';
import { ExportContract } from './export-contract.entity';
import { Lot } from './lot.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('ai_insights')
export class AiInsight extends UuidBaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  code: string;

  @Column({
    type: 'enum',
    enum: AiInsightKind,
    enumName: 'ai_insights_kind_enum',
  })
  kind: AiInsightKind;

  @Column({
    type: 'enum',
    enum: AiInsightSeverity,
    enumName: 'ai_insights_severity_enum',
    default: AiInsightSeverity.INFO,
  })
  severity: AiInsightSeverity;

  @Column({
    type: 'enum',
    enum: AiInsightStatus,
    enumName: 'ai_insights_status_enum',
    default: AiInsightStatus.OPEN,
  })
  status: AiInsightStatus;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'varchar', length: 240, nullable: true })
  href: string | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.75,
  })
  confidence: string;

  /** Optional score (e.g. export readiness 0–100). */
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  score: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: AiInsightSource,
    enumName: 'ai_insights_source_enum',
    default: AiInsightSource.RULES,
  })
  source: AiInsightSource;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId: string | null;

  @ManyToOne(() => Lot, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot | null;

  @Column({ name: 'export_contract_id', type: 'uuid', nullable: true })
  exportContractId: string | null;

  @ManyToOne(() => ExportContract, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'export_contract_id' })
  exportContract: ExportContract | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @OneToMany(() => AiFeedback, (f) => f.insight)
  feedback: AiFeedback[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
