import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Item } from './item.entity';
import { Lot } from './lot.entity';
import { SaleLine } from './sale-line.entity';
import { SaleReturn } from './sale-return.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('sale_return_lines')
export class SaleReturnLine extends UuidBaseEntity {
  @Column({ name: 'sale_return_id', type: 'uuid' })
  saleReturnId: string;

  @Column({ name: 'sale_line_id', type: 'uuid', nullable: true })
  saleLineId: string | null;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  quantity: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 14, scale: 2 })
  unitPrice: string;

  @Column({ name: 'line_total', type: 'decimal', precision: 14, scale: 2 })
  lineTotal: string;

  @ManyToOne(() => SaleReturn, (r) => r.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_return_id' })
  saleReturn: SaleReturn;

  @ManyToOne(() => SaleLine, { nullable: true })
  @JoinColumn({ name: 'sale_line_id' })
  saleLine: SaleLine | null;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Lot, { nullable: true })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot | null;
}
