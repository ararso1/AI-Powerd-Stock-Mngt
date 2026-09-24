import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SupplierDocumentKind, SupplierType } from '../common/enums';
import { SupplierBankAccount } from '../database/entities/supplier-bank-account.entity';
import { SupplierDocument } from '../database/entities/supplier-document.entity';
import { Supplier } from '../database/entities/supplier.entity';
import {
  CreateSupplierDto,
  SupplierBankAccountDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'suppliers');

const IMAGE_OR_PDF = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const AGREEMENT_MIME = new Set(['application/pdf']);
const MAX_ID_BYTES = 5 * 1024 * 1024;
const MAX_AGREEMENT_BYTES = 10 * 1024 * 1024;
const MAX_OTHER_BYTES = 10 * 1024 * 1024;

const DEFAULT_TITLES: Record<SupplierDocumentKind, string> = {
  [SupplierDocumentKind.ID]: 'ID Document',
  [SupplierDocumentKind.AGREEMENT]: 'Agreement / Contract',
  [SupplierDocumentKind.BUSINESS_LICENSE]: 'Business License',
  [SupplierDocumentKind.OTHER]: 'Document',
};

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,
    @InjectRepository(SupplierDocument)
    private readonly docRepo: Repository<SupplierDocument>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
  }) {
    const qb = this.repo.createQueryBuilder('s').orderBy('s.name', 'ASC');

    if (!query.includeInactive) {
      qb.where('s.is_active = true');
    }

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      qb.andWhere(
        `(s.name ILIKE :search
          OR s.email ILIKE :search
          OR s.phone ILIKE :search
          OR s.contact_person ILIKE :search
          OR s.organization_name ILIKE :search
          OR s.tin_number ILIKE :search)`,
        { search },
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()
      .then(([data, total]) => ({
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      }));
  }

  async findOne(id: string) {
    const s = await this.repo.findOne({
      where: { id },
      relations: { documents: true, bankAccounts: true },
    });
    if (!s) throw new NotFoundException('Supplier not found');
    if (s.documents?.length) {
      s.documents.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    if (s.bankAccounts?.length) {
      s.bankAccounts.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return this.serialize(s);
  }

  async create(dto: CreateSupplierDto) {
    const saved = await this.dataSource.transaction(async (manager) => {
      const supplier = await manager.save(
        Supplier,
        manager.create(Supplier, {
          name: dto.name.trim(),
          supplierType: dto.supplierType ?? SupplierType.SUPPLIER,
          contactPerson: dto.contactPerson?.trim() || null,
          phone: dto.phone?.trim() || null,
          alternatePhone: dto.alternatePhone?.trim() || null,
          email: dto.email?.trim() || null,
          address: dto.address?.trim() || null,
          region: dto.region?.trim() || null,
          zone: dto.zone?.trim() || null,
          woreda: dto.woreda?.trim() || null,
          kebele: dto.kebele?.trim() || null,
          organizationName: dto.organizationName?.trim() || null,
          tinNumber: dto.tinNumber?.trim() || null,
          licenseNumber: dto.licenseNumber?.trim() || null,
          licenseExpiry: dto.licenseExpiry || null,
          notes: dto.notes?.trim() || null,
      }),
    );
      await this.replaceBankAccounts(manager, supplier.id, dto.bankAccounts);
      return supplier;
    });
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.dataSource.transaction(async (manager) => {
      const s = await manager.findOne(Supplier, { where: { id } });
      if (!s) throw new NotFoundException('Supplier not found');

      const assign = <K extends keyof Supplier>(
        key: K,
        value: Supplier[K] | undefined | null,
        trim = false,
      ) => {
        if (value === undefined) return;
        if (value === null) {
          s[key] = null as Supplier[K];
          return;
        }
        if (trim && typeof value === 'string') {
          s[key] = (value.trim() || null) as Supplier[K];
          return;
        }
        s[key] = value;
      };

      assign('name', dto.name as never, true);
      if (dto.supplierType !== undefined) s.supplierType = dto.supplierType;
      assign('contactPerson', dto.contactPerson as never, true);
      assign('phone', dto.phone as never, true);
      assign('alternatePhone', dto.alternatePhone as never, true);
      assign('email', dto.email as never, true);
      assign('address', dto.address as never, true);
      assign('region', dto.region as never, true);
      assign('zone', dto.zone as never, true);
      assign('woreda', dto.woreda as never, true);
      assign('kebele', dto.kebele as never, true);
      assign('organizationName', dto.organizationName as never, true);
      assign('tinNumber', dto.tinNumber as never, true);
      assign('licenseNumber', dto.licenseNumber as never, true);
      if (dto.licenseExpiry !== undefined) {
        s.licenseExpiry = dto.licenseExpiry || null;
      }
      assign('notes', dto.notes as never, true);
    if (dto.isActive !== undefined) s.isActive = dto.isActive;

      await manager.save(s);

      if (dto.bankAccounts !== undefined) {
        await this.replaceBankAccounts(manager, id, dto.bankAccounts);
      }
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Supplier not found');
    s.isActive = false;
    await this.repo.save(s);
    return { id: s.id, deleted: true };
  }

  async uploadDocument(
    supplierId: string,
    kind: SupplierDocumentKind,
    file: UploadedFile | undefined,
    userId: string | null,
    titleInput?: string | null,
  ) {
    await this.ensureSupplier(supplierId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }

    this.assertFileAllowed(kind, file);

    let title = (titleInput ?? '').trim();
    if (kind === SupplierDocumentKind.OTHER) {
      if (!title) {
        throw new BadRequestException('Document name is required');
      }
    } else if (!title) {
      title = DEFAULT_TITLES[kind];
    }
    title = title.slice(0, 200);

    const ext = this.safeExt(file.originalname, file.mimetype);
    const storageKey = path
      .join(supplierId, `${kind.toLowerCase()}-${randomUUID()}${ext}`)
      .replace(/\\/g, '/');
    const absDir = path.join(UPLOAD_ROOT, supplierId);
    mkdirSync(absDir, { recursive: true });
    const absPath = path.join(UPLOAD_ROOT, storageKey);
    writeFileSync(absPath, file.buffer);

    // Dedicated kinds: one active file each (replace previous).
    if (
      kind === SupplierDocumentKind.ID ||
      kind === SupplierDocumentKind.AGREEMENT ||
      kind === SupplierDocumentKind.BUSINESS_LICENSE
    ) {
      const existing = await this.docRepo.find({
        where: { supplierId, kind },
      });
      for (const old of existing) {
        this.deleteStoredFile(old.storageKey);
        await this.docRepo.remove(old);
      }
    }

    const doc = await this.docRepo.save(
      this.docRepo.create({
        supplierId,
        kind,
        title,
        originalName: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
        uploadedById: userId,
      }),
    );

    return this.serializeDocument(doc);
  }

  async listDocuments(supplierId: string) {
    await this.ensureSupplier(supplierId);
    const docs = await this.docRepo.find({
      where: { supplierId },
      order: { createdAt: 'DESC' },
    });
    return docs.map((d) => this.serializeDocument(d));
  }

  async downloadDocument(supplierId: string, documentId: string) {
    const doc = await this.docRepo.findOne({
      where: { id: documentId, supplierId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    const abs = path.join(UPLOAD_ROOT, doc.storageKey);
    if (!existsSync(abs)) {
      throw new NotFoundException('File missing on disk');
    }
    const stream = createReadStream(abs);
    return {
      file: new StreamableFile(stream),
      mimeType: doc.mimeType,
      originalName: doc.originalName,
    };
  }

  async deleteDocument(supplierId: string, documentId: string) {
    const doc = await this.docRepo.findOne({
      where: { id: documentId, supplierId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    this.deleteStoredFile(doc.storageKey);
    await this.docRepo.remove(doc);
    return { id: documentId, deleted: true };
  }

  private async replaceBankAccounts(
    manager: EntityManager,
    supplierId: string,
    accounts: SupplierBankAccountDto[] | undefined,
  ) {
    await manager.delete(SupplierBankAccount, { supplierId });
    const rows = (accounts ?? [])
      .map((a, index) => ({
        bankName: a.bankName?.trim() ?? '',
        accountHolderName: a.accountHolderName?.trim() ?? '',
        accountNumber: a.accountNumber?.trim() ?? '',
        sortOrder: index,
      }))
      .filter((a) => a.bankName && a.accountHolderName && a.accountNumber);
    if (!rows.length) return;
    await manager.save(
      SupplierBankAccount,
      rows.map((row) =>
        manager.create(SupplierBankAccount, { ...row, supplierId }),
      ),
    );
  }

  private async ensureSupplier(id: string) {
    const exists = await this.repo.exists({ where: { id } });
    if (!exists) throw new NotFoundException('Supplier not found');
  }

  private assertFileAllowed(kind: SupplierDocumentKind, file: UploadedFile) {
    if (kind === SupplierDocumentKind.AGREEMENT) {
      if (!AGREEMENT_MIME.has(file.mimetype)) {
        throw new BadRequestException('Agreement must be a PDF');
      }
      if (file.size > MAX_AGREEMENT_BYTES) {
        throw new BadRequestException('Agreement PDF must be 10MB or smaller');
      }
      return;
    }
    if (!IMAGE_OR_PDF.has(file.mimetype)) {
      throw new BadRequestException(
        'Document must be JPEG, PNG, WebP, or PDF',
      );
    }
    const max =
      kind === SupplierDocumentKind.ID ||
      kind === SupplierDocumentKind.BUSINESS_LICENSE
        ? MAX_ID_BYTES
        : MAX_OTHER_BYTES;
    if (file.size > max) {
      throw new BadRequestException(
        kind === SupplierDocumentKind.ID
          ? 'ID document must be 5MB or smaller'
          : kind === SupplierDocumentKind.BUSINESS_LICENSE
            ? 'Business license must be 5MB or smaller'
            : 'Document must be 10MB or smaller',
      );
    }
  }

  private safeExt(originalName: string, mime: string) {
    const fromName = path.extname(originalName || '').toLowerCase();
    if (fromName && /^\.(pdf|jpe?g|png|webp)$/.test(fromName)) return fromName;
    if (mime === 'application/pdf') return '.pdf';
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    return '';
  }

  private deleteStoredFile(storageKey: string) {
    const abs = path.join(UPLOAD_ROOT, storageKey);
    if (existsSync(abs)) {
      try {
        unlinkSync(abs);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  private serializeDocument(doc: SupplierDocument) {
    return {
      id: doc.id,
      supplierId: doc.supplierId,
      kind: doc.kind,
      title: doc.title,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      uploadedById: doc.uploadedById,
      createdAt: doc.createdAt,
      downloadPath: `/suppliers/${doc.supplierId}/documents/${doc.id}/download`,
    };
  }

  private serializeBankAccount(a: SupplierBankAccount) {
    return {
      id: a.id,
      supplierId: a.supplierId,
      bankName: a.bankName,
      accountHolderName: a.accountHolderName,
      accountNumber: a.accountNumber,
      sortOrder: a.sortOrder,
    };
  }

  private serialize(s: Supplier) {
    return {
      ...s,
      bankAccounts: (s.bankAccounts ?? []).map((a) =>
        this.serializeBankAccount(a),
      ),
      documents: (s.documents ?? []).map((d) => this.serializeDocument(d)),
    };
  }
}
