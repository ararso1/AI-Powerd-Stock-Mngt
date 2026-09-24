import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { SupplierDocumentKind } from '../../common/enums';
import { Supplier } from './supplier.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

@Entity('supplier_documents')
export class SupplierDocument extends UuidBaseEntity {
  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({
    type: 'enum',
    enum: SupplierDocumentKind,
    enumName: 'supplier_documents_kind_enum',
  })
  kind: SupplierDocumentKind;

  /** Display name (required for custom OTHER docs; defaults for ID/AGREEMENT). */
  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  /** Relative path under uploads/ (never expose raw filesystem to clients). */
  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey: string;

  @Column({ name: 'uploaded_by_id', type: 'uuid', nullable: true })
  uploadedById: string | null;

  @ManyToOne(() => Supplier, (s) => s.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
