import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { CustomerType } from '../../common/enums';
import { CustomerDocument } from './customer-document.entity';
import { Sale } from './sale.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('customers')
export class Customer extends UuidBaseEntity {
  @Column({ length: 150 })
  name: string;

  @Column({
    name: 'customer_type',
    type: 'enum',
    enum: CustomerType,
    enumName: 'customers_customer_type_enum',
    default: CustomerType.NORMAL,
  })
  customerType: CustomerType;

  @Column({ name: 'contact_person', type: 'varchar', length: 120, nullable: true })
  contactPerson: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({
    name: 'alternate_phone',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  alternatePhone: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  region: string | null;

  @Column({
    name: 'organization_name',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  organizationName: string | null;

  @Column({ name: 'tin_number', type: 'varchar', length: 40, nullable: true })
  tinNumber: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Max open receivable (ETB). Null = no credit sales allowed until set. */
  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  creditLimit: string | null;

  /** Limit used as the base for repayment increases (10% / 5%). */
  @Column({
    name: 'credit_limit_base',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  creditLimitBase: string | null;

  @Column({
    name: 'last_limit_increase',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  lastLimitIncrease: string | null;

  @Column({
    name: 'last_limit_increase_percent',
    type: 'int',
    nullable: true,
  })
  lastLimitIncreasePercent: number | null;

  @Column({ name: 'last_repayment_days', type: 'int', nullable: true })
  lastRepaymentDays: number | null;

  @Column({
    name: 'last_repayment_risk',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  lastRepaymentRisk: string | null;

  @OneToMany(() => Sale, (sale) => sale.customer)
  sales: Sale[];

  @OneToMany(() => CustomerDocument, (doc) => doc.customer)
  documents: CustomerDocument[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
