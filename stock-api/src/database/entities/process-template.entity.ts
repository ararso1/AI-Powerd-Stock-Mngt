import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import {
  CoffeeForm,
  ProcessOperationType,
  PurchaseType,
} from '../../common/enums';
import { Item } from './item.entity';
import { ProcessRun } from './process-run.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('process_templates')
export class ProcessTemplate extends UuidBaseEntity {
  @Column({ type: 'varchar', length: 40, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({
    name: 'input_form',
    type: 'enum',
    enum: CoffeeForm,
    enumName: 'process_templates_input_form_enum',
  })
  inputForm: CoffeeForm;

  @Column({
    name: 'output_form',
    type: 'enum',
    enum: CoffeeForm,
    enumName: 'process_templates_output_form_enum',
  })
  outputForm: CoffeeForm;

  @Column({
    name: 'operation_type',
    type: 'enum',
    enum: ProcessOperationType,
    enumName: 'process_templates_operation_type_enum',
    default: ProcessOperationType.OTHER,
  })
  operationType: ProcessOperationType;

  /**
   * Local-market vs export intake workflow.
   * Null means a shared mill/roast/pack template.
   * Stages stay empty until that workflow's steps are defined.
   */
  @Column({
    type: 'enum',
    enum: PurchaseType,
    enumName: 'process_workflow_enum',
    nullable: true,
  })
  workflow: PurchaseType | null;

  /** When set, quantityOutput on complete is pack count; kg = packs × packSizeKg. */
  @Column({
    name: 'pack_size_kg',
    type: 'decimal',
    precision: 14,
    scale: 3,
    nullable: true,
  })
  packSizeKg: string | null;

  @Column({
    name: 'expected_yield_percent',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 100,
  })
  expectedYieldPercent: string;

  @Column({ name: 'requires_qc', default: true })
  requiresQc: boolean;

  /** Ordered stage labels, e.g. ["Pulping","Ferment","Wash","Dry"] */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  stages: string[];

  @Column({ name: 'input_item_id', type: 'uuid', nullable: true })
  inputItemId: string | null;

  @Column({ name: 'output_item_id', type: 'uuid', nullable: true })
  outputItemId: string | null;

  @Column({
    name: 'max_moisture_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  maxMoisturePercent: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => Item, { nullable: true })
  @JoinColumn({ name: 'input_item_id' })
  inputItem: Item | null;

  @ManyToOne(() => Item, { nullable: true })
  @JoinColumn({ name: 'output_item_id' })
  outputItem: Item | null;

  @OneToMany(() => ProcessRun, (run) => run.template)
  runs: ProcessRun[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
