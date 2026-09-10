import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AiFeedbackDecision } from '../../common/enums';
import { AiInsight } from './ai-insight.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('ai_feedback')
export class AiFeedback extends UuidBaseEntity {
  @Index()
  @Column({ name: 'insight_id', type: 'uuid' })
  insightId: string;

  @ManyToOne(() => AiInsight, (i) => i.feedback, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'insight_id' })
  insight: AiInsight;

  @Column({
    type: 'enum',
    enum: AiFeedbackDecision,
    enumName: 'ai_feedback_decision_enum',
  })
  decision: AiFeedbackDecision;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
