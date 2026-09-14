import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import {
  StockMovementDirection,
  StockMovementSourceType,
} from '../../common/enums';
import { Item } from './item.entity';
import { Location } from './location.entity';
import { Lot } from './lot.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('stock_movements')
@Index(['movedAt'])
@Index(['locationId', 'movedAt'])
@Index(['itemId', 'lotId'])
@Index(['sourceType', 'movedAt'])
export class StockMovement extends UuidBaseEntity {
  @Column({ name: 'moved_at', type: 'timestamptz', default: () => 'now()' })
  movedAt: Date;

  @Column({
    type: 'enum',
    enum: StockMovementDirection,
    enumName: 'stock_movements_direction_enum',
  })
  direction: StockMovementDirection;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: StockMovementSourceType,
    enumName: 'stock_movements_source_type_enum',
    default: StockMovementSourceType.OTHER,
  })
  sourceType: StockMovementSourceType;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId: string | null;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  quantity: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  grade: string | null;

  @Column({ name: 'batch_code', type: 'varchar', length: 40, nullable: true })
  batchCode: string | null;

  @Column({ name: 'reference_type', type: 'varchar', length: 60, nullable: true })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Lot, { nullable: true })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot | null;

  @ManyToOne(() => Location)
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
