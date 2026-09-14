import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import {
  DocumentStatus,
  PaymentMethod,
  ReceivingDisposition,
} from '../../common/enums';
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

  @Column({
    name: 'disposition',
    type: 'enum',
    enum: ReceivingDisposition,
    enumName: 'collection_tickets_disposition_enum',
    default: ReceivingDisposition.ACCEPTED,
  })
  disposition: ReceivingDisposition;

  @Column({
    name: 'accepted_weight_kg',
    type: 'decimal',
    precision: 14,
    scale: 3,
    nullable: true,
  })
  acceptedWeightKg: string | null;

  @Column({
    name: 'rejected_weight_kg',
    type: 'decimal',
    precision: 14,
    scale: 3,
    default: 0,
  })
  rejectedWeightKg: string;

  @Column({ name: 'reject_lot_id', type: 'uuid', nullable: true })
  rejectLotId: string | null;

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
  zone: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  woreda: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  kebele: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  variety: string | null;

  @Column({
    name: 'process_method',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  processMethod: string | null;

  @Column({ name: 'screen_size', type: 'varchar', length: 40, nullable: true })
  screenSize: string | null;

  @Column({
    name: 'cupping_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  cuppingScore: string | null;

  @Column({ name: 'defect_level', type: 'varchar', length: 40, nullable: true })
  defectLevel: string | null;

  @Column({ name: 'inspector_id', type: 'uuid', nullable: true })
  inspectorId: string | null;

  @Column({ name: 'inspected_at', type: 'timestamptz', nullable: true })
  inspectedAt: Date | null;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string | null;

  @Column({
    name: 'reject_percent',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  rejectPercent: string | null;

  @Column({
    name: 'reject_action',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  rejectAction: string | null;

  @Column({ name: 'reject_destination_id', type: 'uuid', nullable: true })
  rejectDestinationId: string | null;

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

  @ManyToOne(() => Lot, { nullable: true })
  @JoinColumn({ name: 'reject_lot_id' })
  rejectLot: Lot | null;

  @ManyToOne(() => Purchase, { nullable: true })
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase | null;

  @ManyToOne(() => BankAccount, { nullable: true })
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount: BankAccount | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'inspector_id' })
  inspector: User | null;

  @ManyToOne(() => Location, { nullable: true })
  @JoinColumn({ name: 'reject_destination_id' })
  rejectDestination: Location | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
