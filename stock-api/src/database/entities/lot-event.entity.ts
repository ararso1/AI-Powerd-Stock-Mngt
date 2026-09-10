import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { LotEventType } from '../../common/enums';
import { Location } from './location.entity';
import { Lot } from './lot.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('lot_events')
@Index('IDX_lot_events_lot_created', ['lotId', 'createdAt'])
export class LotEvent extends UuidBaseEntity {
  @Column({ name: 'lot_id', type: 'uuid' })
  lotId: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: LotEventType,
    enumName: 'lot_events_event_type_enum',
  })
  eventType: LotEventType;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 3,
    nullable: true,
  })
  quantity: string | null;

  @Column({ name: 'from_location_id', type: 'uuid', nullable: true })
  fromLocationId: string | null;

  @Column({ name: 'to_location_id', type: 'uuid', nullable: true })
  toLocationId: string | null;

  @Column({ name: 'related_lot_id', type: 'uuid', nullable: true })
  relatedLotId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => Lot, (lot) => lot.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @ManyToOne(() => Location, { nullable: true })
  @JoinColumn({ name: 'from_location_id' })
  fromLocation: Location | null;

  @ManyToOne(() => Location, { nullable: true })
  @JoinColumn({ name: 'to_location_id' })
  toLocation: Location | null;

  @ManyToOne(() => Lot, { nullable: true })
  @JoinColumn({ name: 'related_lot_id' })
  relatedLot: Lot | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
