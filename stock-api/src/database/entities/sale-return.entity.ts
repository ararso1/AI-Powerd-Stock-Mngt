import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethod } from '../../common/enums';
import { BankAccount } from './bank-account.entity';
import { Location } from './location.entity';
import { Sale } from './sale.entity';
import { SaleReturnLine } from './sale-return-line.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('sale_returns')
export class SaleReturn extends UuidBaseEntity {
  @Column({ name: 'return_number', type: 'varchar', length: 40 })
  returnNumber: string;

  @Column({ name: 'sale_id', type: 'uuid' })
  saleId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalAmount: string;

  @Column({ name: 'refund_method', type: 'varchar', length: 20 })
  refundMethod: PaymentMethod | string;

  @Column({ name: 'bank_account_id', type: 'uuid', nullable: true })
  bankAccountId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => Location)
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @ManyToOne(() => BankAccount, { nullable: true })
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount: BankAccount | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @OneToMany(() => SaleReturnLine, (line) => line.saleReturn, {
    cascade: true,
    eager: true,
  })
  lines: SaleReturnLine[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
