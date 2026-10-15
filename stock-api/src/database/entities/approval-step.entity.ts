import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { ApprovalStepStatus } from '../../common/enums';
import { ApprovalRequest } from './approval-request.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('approval_steps')
export class ApprovalStep extends UuidBaseEntity {
  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @ManyToOne(() => ApprovalRequest, (req) => req.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request: ApprovalRequest;

  /** Role that must approve this step (e.g. Head Storekeeper, Admin). */
  @Column({ name: 'required_role_name', type: 'varchar', length: 100 })
  requiredRoleName: string;

  /** Display / permission hint used for notifications. */
  @Column({
    name: 'required_permission',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  requiredPermission: string | null;

  @Column({ name: 'step_order', type: 'int', default: 1 })
  stepOrder: number;

  @Column({
    type: 'enum',
    enum: ApprovalStepStatus,
    enumName: 'approval_steps_status_enum',
    default: ApprovalStepStatus.PENDING,
  })
  status: ApprovalStepStatus;

  @Column({ name: 'decided_by_id', type: 'uuid', nullable: true })
  decidedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'decided_by_id' })
  decidedBy: User | null;

  @Column({ type: 'text', nullable: true, default: null })
  comment: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
