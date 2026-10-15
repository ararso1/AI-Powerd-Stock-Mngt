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
  ApprovalEntityType,
  ApprovalRequestStatus,
} from '../../common/enums';
import { User } from './user.entity';
import { ApprovalStep } from './approval-step.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('approval_requests')
export class ApprovalRequest extends UuidBaseEntity {
  @Column({
    name: 'entity_type',
    type: 'enum',
    enum: ApprovalEntityType,
    enumName: 'approval_requests_entity_type_enum',
  })
  entityType: ApprovalEntityType;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({
    type: 'enum',
    enum: ApprovalRequestStatus,
    enumName: 'approval_requests_status_enum',
    default: ApprovalRequestStatus.PENDING,
  })
  status: ApprovalRequestStatus;

  @Column({ name: 'initiated_by_id', type: 'uuid', nullable: true })
  initiatedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'initiated_by_id' })
  initiatedBy: User | null;

  @Column({ type: 'text', nullable: true, default: null })
  notes: string | null;

  /** Free-form audit / display metadata (totals, location name, etc.). */
  @Column({ type: 'jsonb', nullable: true, default: null })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => ApprovalStep, (step) => step.request, {
    cascade: true,
    eager: true,
  })
  steps: ApprovalStep[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;
}
