import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { CustomerType } from '../../common/enums';
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
    default: CustomerType.RETAIL,
  })
  customerType: CustomerType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Max open receivable (ETB). Null = no limit. */
  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  creditLimit: string | null;

  @OneToMany(() => Sale, (sale) => sale.customer)
  sales: Sale[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
