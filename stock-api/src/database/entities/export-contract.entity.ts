import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import {
  ExportContractStatus,
  Incoterm,
} from '../../common/enums';
import { Customer } from './customer.entity';
import { ExportAllocation } from './export-allocation.entity';
import { Location } from './location.entity';
import { Sale } from './sale.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

export type ExportDocCheckItem = {
  key: string;
  label: string;
  done: boolean;
};

export type ExportPackingLine = {
  lotId: string;
  lotCode: string;
  quantityKg: number;
  bags?: number;
  grade?: string | null;
};

@Entity('export_contracts')
export class ExportContract extends UuidBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'contract_number', type: 'varchar', length: 40 })
  contractNumber: string;

  @Column({ name: 'buyer_name', type: 'varchar', length: 200 })
  buyerName: string;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({
    name: 'volume_kg',
    type: 'decimal',
    precision: 14,
    scale: 3,
  })
  volumeKg: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  grade: string | null;

  @Column({
    name: 'price_per_kg',
    type: 'decimal',
    precision: 14,
    scale: 4,
  })
  pricePerKg: string;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'USD' })
  currencyCode: string;

  @Column({
    type: 'enum',
    enum: Incoterm,
    enumName: 'export_contracts_incoterm_enum',
    default: Incoterm.FOB,
  })
  incoterm: Incoterm;

  @Column({ name: 'window_start', type: 'date', nullable: true })
  windowStart: string | null;

  @Column({ name: 'window_end', type: 'date', nullable: true })
  windowEnd: string | null;

  @Column({
    type: 'enum',
    enum: ExportContractStatus,
    enumName: 'export_contracts_status_enum',
    default: ExportContractStatus.DRAFT,
  })
  status: ExportContractStatus;

  @Column({
    name: 'allocated_kg',
    type: 'decimal',
    precision: 14,
    scale: 3,
    default: 0,
  })
  allocatedKg: string;

  @Column({
    name: 'shipped_kg',
    type: 'decimal',
    precision: 14,
    scale: 3,
    default: 0,
  })
  shippedKg: string;

  @Column({ name: 'staging_location_id', type: 'uuid', nullable: true })
  stagingLocationId: string | null;

  @Column({ name: 'sale_id', type: 'uuid', nullable: true })
  saleId: string | null;

  @Column({ name: 'bank_account_id', type: 'uuid', nullable: true })
  bankAccountId: string | null;

  /** Snapshot packing list at ship time. */
  @Column({ name: 'packing_list', type: 'jsonb', default: () => "'[]'" })
  packingList: ExportPackingLine[];

  @Column({ name: 'doc_checklist', type: 'jsonb', default: () => "'[]'" })
  docChecklist: ExportDocCheckItem[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt: Date | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => Location, { nullable: true })
  @JoinColumn({ name: 'staging_location_id' })
  stagingLocation: Location | null;

  @ManyToOne(() => Sale, { nullable: true })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @OneToMany(() => ExportAllocation, (a) => a.contract)
  allocations: ExportAllocation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
