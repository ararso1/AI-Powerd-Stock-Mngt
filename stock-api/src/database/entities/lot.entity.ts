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
import { CoffeeForm, LotStatus } from '../../common/enums';
import { Item } from './item.entity';
import { Location } from './location.entity';
import { LotEvent } from './lot-event.entity';
import { RoastProfile } from './roast-profile.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('lots')
export class Lot extends UuidBaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId: string | null;

  @Column({
    type: 'enum',
    enum: CoffeeForm,
    enumName: 'lots_form_enum',
    default: CoffeeForm.GREEN,
  })
  form: CoffeeForm;

  @Column({ type: 'varchar', length: 80, nullable: true })
  grade: string | null;

  @Column({ name: 'crop_year', type: 'varchar', length: 20, nullable: true })
  cropYear: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  variety: string | null;

  @Column({
    name: 'process_method',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  processMethod: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  woreda: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  kebele: string | null;

  @Column({ name: 'moisture_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  moisturePercent: string | null;

  @Column({ name: 'roast_date', type: 'date', nullable: true })
  roastDate: string | null;

  @Column({ name: 'best_before', type: 'date', nullable: true })
  bestBefore: string | null;

  @Column({ name: 'roast_profile_id', type: 'uuid', nullable: true })
  roastProfileId: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 3, default: 0 })
  quantity: string;

  @Column({
    type: 'enum',
    enum: LotStatus,
    enumName: 'lots_status_enum',
    default: LotStatus.ACTIVE,
  })
  status: LotStatus;

  @Column({ name: 'parent_lot_id', type: 'uuid', nullable: true })
  parentLotId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => Item, { nullable: true })
  @JoinColumn({ name: 'item_id' })
  item: Item | null;

  @ManyToOne(() => Location, { nullable: true })
  @JoinColumn({ name: 'location_id' })
  location: Location | null;

  @ManyToOne(() => Lot, { nullable: true })
  @JoinColumn({ name: 'parent_lot_id' })
  parentLot: Lot | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @ManyToOne(() => RoastProfile, { nullable: true })
  @JoinColumn({ name: 'roast_profile_id' })
  roastProfile: RoastProfile | null;

  @OneToMany(() => LotEvent, (event) => event.lot)
  events: LotEvent[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
