import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('password_reset_tokens')
export class PasswordResetToken extends UuidBaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  /** SHA-256 of the raw token emailed to the user. */
  @Column({ name: 'token_hash', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
