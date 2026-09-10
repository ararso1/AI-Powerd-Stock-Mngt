import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Lot } from './lot.entity';
import { ProcessRun } from './process-run.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('qc_results')
export class QcResult extends UuidBaseEntity {
  @Column({ name: 'process_run_id', type: 'uuid' })
  processRunId: string;

  @Column({ name: 'lot_id', type: 'uuid' })
  lotId: string;

  @Column({
    name: 'moisture_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  moisturePercent: string | null;

  @Column({ name: 'defect_count', type: 'int', nullable: true })
  defectCount: number | null;

  @Column({
    name: 'cupping_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  cuppingScore: string | null;

  @Column({ default: false })
  passed: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => ProcessRun, (run) => run.qcResults, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'process_run_id' })
  processRun: ProcessRun;

  @ManyToOne(() => Lot)
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
