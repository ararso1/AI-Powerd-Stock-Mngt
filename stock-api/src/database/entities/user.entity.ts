import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { EmploymentStatus, EmploymentType } from '../../common/enums';
import { Role } from './role.entity';
import { RefreshToken } from './refresh-token.entity';
import { UserLocation } from './user-location.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('users')
export class User extends UuidBaseEntity {
  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId: string | null;

  @ManyToOne(() => Role, (role) => role.users, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role: Role | null;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];

  /** When non-empty, user is scoped to these locations only. */
  @OneToMany(() => UserLocation, (ul) => ul.user)
  userLocations: UserLocation[];

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ name: 'employee_code', type: 'varchar', length: 40, nullable: true })
  employeeCode: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  designation: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  salary: string | null;

  @Column({
    name: 'salary_currency',
    type: 'varchar',
    length: 3,
    nullable: true,
    default: 'ETB',
  })
  salaryCurrency: string | null;

  @Column({ name: 'hired_at', type: 'date', nullable: true })
  hiredAt: string | null;

  @Column({
    name: 'employment_type',
    type: 'enum',
    enum: EmploymentType,
    enumName: 'users_employment_type_enum',
    nullable: true,
  })
  employmentType: EmploymentType | null;

  @Column({
    name: 'employment_status',
    type: 'enum',
    enum: EmploymentStatus,
    enumName: 'users_employment_status_enum',
    default: EmploymentStatus.ACTIVE,
  })
  employmentStatus: EmploymentStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
