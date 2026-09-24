import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { SupplierType } from '../../common/enums';
import { Purchase } from './purchase.entity';
import { SupplierBankAccount } from './supplier-bank-account.entity';
import { SupplierDocument } from './supplier-document.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('suppliers')
export class Supplier extends UuidBaseEntity {
  @Column({ length: 150 })
  name: string;

  @Column({
    name: 'supplier_type',
    type: 'enum',
    enum: SupplierType,
    enumName: 'suppliers_supplier_type_enum',
    default: SupplierType.SUPPLIER,
  })
  supplierType: SupplierType;

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
  region: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  zone: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  woreda: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  kebele: string | null;

  @Column({
    name: 'organization_name',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  organizationName: string | null;

  @Column({ name: 'tin_number', type: 'varchar', length: 40, nullable: true })
  tinNumber: string | null;

  @Column({
    name: 'license_number',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  licenseNumber: string | null;

  @Column({ name: 'license_expiry', type: 'date', nullable: true })
  licenseExpiry: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => Purchase, (purchase) => purchase.supplier)
  purchases: Purchase[];

  @OneToMany(() => SupplierDocument, (doc) => doc.supplier)
  documents: SupplierDocument[];

  @OneToMany(() => SupplierBankAccount, (acct) => acct.supplier)
  bankAccounts: SupplierBankAccount[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
