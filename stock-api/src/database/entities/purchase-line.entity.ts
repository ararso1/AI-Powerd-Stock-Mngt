import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Item } from './item.entity';
import { Lot } from './lot.entity';
import { Purchase } from './purchase.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('purchase_lines')
export class PurchaseLine extends UuidBaseEntity {
  @Column({ name: 'purchase_id' })
  purchaseId: string;

  @Column({ name: 'item_id' })
  itemId: string;

  /** Coffee lot receiving this line (required for COF-* items). */
  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  quantity: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 14, scale: 2 })
  unitPrice: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  lineTotal: string;

  @ManyToOne(() => Purchase, (purchase) => purchase.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;

  @ManyToOne(() => Item, { eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Lot, { nullable: true, eager: true })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot | null;
}
