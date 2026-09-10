import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { ExportContract } from './export-contract.entity';
import { Lot } from './lot.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('export_allocations')
export class ExportAllocation extends UuidBaseEntity {
  @Column({ name: 'contract_id', type: 'uuid' })
  contractId: string;

  @Column({ name: 'lot_id', type: 'uuid' })
  lotId: string;

  @Column({
    name: 'quantity_kg',
    type: 'decimal',
    precision: 14,
    scale: 3,
  })
  quantityKg: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => ExportContract, (c) => c.allocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contract_id' })
  contract: ExportContract;

  @ManyToOne(() => Lot, { eager: true })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
