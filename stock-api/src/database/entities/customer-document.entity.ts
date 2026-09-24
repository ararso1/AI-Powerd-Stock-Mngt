import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { CustomerDocumentKind } from '../../common/enums';
import { Customer } from './customer.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('customer_documents')
export class CustomerDocument extends UuidBaseEntity {
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({
    type: 'enum',
    enum: CustomerDocumentKind,
    enumName: 'customer_documents_kind_enum',
  })
  kind: CustomerDocumentKind;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey: string;

  @Column({ name: 'uploaded_by_id', type: 'uuid', nullable: true })
  uploadedById: string | null;

  @ManyToOne(() => Customer, (c) => c.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
