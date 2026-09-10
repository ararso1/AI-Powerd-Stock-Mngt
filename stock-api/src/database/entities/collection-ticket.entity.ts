import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentStatus, PaymentMethod } from '../../common/enums';
import { BankAccount } from './bank-account.entity';
import { Item } from './item.entity';
import { Location } from './location.entity';
import { Lot } from './lot.entity';
import { Purchase } from './purchase.entity';
import { Supplier } from './supplier.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('collection_tickets')
export class CollectionTicket extends UuidBaseEntity {
  @Column({ name: 'ticket_number', type: 'varchar', length: 40 })
  ticketNumber: string;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'lot_id', type: 'uuid' })
  lotId: string;

  @Column({ name: 'purchase_id', type: 'uuid', nullable: true })
  purchaseId: string | null;

  @Column({ name: 'weight_kg', type: 'decimal', precision: 14, scale: 3 })
  weightKg: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  grade: string | null;

  @Column({ name: 'price_per_kg', type: 'decimal', precision: 14, scale: 2 })
  pricePerKg: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2 })
  totalAmount: string;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'collection_tickets_payment_method_enum',
  })
  paymentMethod: PaymentMethod;

  @Column({ name: 'bank_account_id', type: 'uuid', nullable: true })
  bankAccountId: string | null;

  @Column({
    name: 'moisture_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  moisturePercent: string | null;

  @Column({ name: 'crop_year', type: 'varchar', length: 20, nullable: true })
  cropYear: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  woreda: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  kebele: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  variety: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    enumName: 'collection_tickets_status_enum',
    default: DocumentStatus.ACTIVE,
  })
  status: DocumentStatus;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => Location)
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Lot)
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @ManyToOne(() => Purchase, { nullable: true })
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase | null;

  @ManyToOne(() => BankAccount, { nullable: true })
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount: BankAccount | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
