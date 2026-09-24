import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { Supplier } from './supplier.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('supplier_bank_accounts')
export class SupplierBankAccount extends UuidBaseEntity {
  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 120 })
  bankName: string;

  @Column({ name: 'account_holder_name', type: 'varchar', length: 150 })
  accountHolderName: string;

  @Column({ name: 'account_number', type: 'varchar', length: 80 })
  accountNumber: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Supplier, (s) => s.bankAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
