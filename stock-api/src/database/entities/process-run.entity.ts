import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { ProcessRunStatus } from '../../common/enums';
import { Location } from './location.entity';
import { Lot } from './lot.entity';
import { ProcessTemplate } from './process-template.entity';
import { QcResult } from './qc-result.entity';
import { RoastProfile } from './roast-profile.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('process_runs')
export class ProcessRun extends UuidBaseEntity {
  @Column({ name: 'run_number', type: 'varchar', length: 40 })
  runNumber: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @Column({ name: 'input_lot_id', type: 'uuid' })
  inputLotId: string;

  @Column({ name: 'output_lot_id', type: 'uuid', nullable: true })
  outputLotId: string | null;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({
    name: 'quantity_input',
    type: 'decimal',
    precision: 14,
    scale: 3,
  })
  quantityInput: string;

  @Column({
    name: 'quantity_output',
    type: 'decimal',
    precision: 14,
    scale: 3,
    nullable: true,
  })
  quantityOutput: string | null;

  @Column({
    name: 'quantity_reject',
    type: 'decimal',
    precision: 14,
    scale: 3,
    default: 0,
  })
  quantityReject: string;

  @Column({
    name: 'expected_yield_percent',
    type: 'decimal',
    precision: 6,
    scale: 2,
  })
  expectedYieldPercent: string;

  @Column({
    name: 'actual_yield_percent',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  actualYieldPercent: string | null;

  @Column({
    type: 'enum',
    enum: ProcessRunStatus,
    enumName: 'process_runs_status_enum',
    default: ProcessRunStatus.DRAFT,
  })
  status: ProcessRunStatus;

  @Column({ name: 'current_stage_index', type: 'int', default: 0 })
  currentStageIndex: number;

  /** Snapshot of template stages at create time */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  stages: string[];

  @Column({ name: 'stages_completed', type: 'jsonb', default: () => "'[]'" })
  stagesCompleted: string[];

  @Column({
    name: 'process_cost',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  processCost: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ name: 'roast_profile_id', type: 'uuid', nullable: true })
  roastProfileId: string | null;

  @ManyToOne(() => ProcessTemplate, (t) => t.runs)
  @JoinColumn({ name: 'template_id' })
  template: ProcessTemplate;

  @ManyToOne(() => Lot)
  @JoinColumn({ name: 'input_lot_id' })
  inputLot: Lot;

  @ManyToOne(() => Lot, { nullable: true })
  @JoinColumn({ name: 'output_lot_id' })
  outputLot: Lot | null;

  @ManyToOne(() => Location)
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @ManyToOne(() => RoastProfile, { nullable: true })
  @JoinColumn({ name: 'roast_profile_id' })
  roastProfile: RoastProfile | null;

  @OneToMany(() => QcResult, (qc) => qc.processRun)
  qcResults: QcResult[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
