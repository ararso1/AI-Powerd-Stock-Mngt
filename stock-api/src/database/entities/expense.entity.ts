import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { BankAccount } from './bank-account.entity';
import { ExpenseCategory } from './expense-category.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('expenses')
export class Expense extends UuidBaseEntity {
  @Column({ name: 'category_id' })
  categoryId: string;

  @Column({ name: 'bank_account_id' })
  bankAccountId: string;

  /** CASH pays a cash till. BANK is a transfer from a bank account. */
  @Column({ name: 'payment_method', type: 'varchar', length: 10, default: 'BANK' })
  paymentMethod: string;

  @Column({
    name: 'receipt_original_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  receiptOriginalName: string | null;

  @Column({
    name: 'receipt_mime_type',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  receiptMimeType: string | null;

  @Column({
    name: 'receipt_storage_key',
    type: 'varchar',
    length: 400,
    nullable: true,
  })
  receiptStorageKey: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate: string;

  /** LOCAL or EXPORT coffee. Null means the expense is not tied to a market. */
  @Column({ name: 'coffee_market', type: 'varchar', length: 10, nullable: true })
  coffeeMarket: 'LOCAL' | 'EXPORT' | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => ExpenseCategory, (category) => category.expenses)
  @JoinColumn({ name: 'category_id' })
  category: ExpenseCategory;

  @ManyToOne(() => BankAccount)
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount: BankAccount;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
