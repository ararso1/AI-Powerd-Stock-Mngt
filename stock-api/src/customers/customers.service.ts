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
import { Repository } from 'typeorm';
import { CustomerDocumentKind, CustomerType } from '../common/enums';
import { CreditsService } from '../credits/credits.service';
import { CustomerDocument } from '../database/entities/customer-document.entity';
import { Customer } from '../database/entities/customer.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'customers');
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const MAX_BYTES = 10 * 1024 * 1024;

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
    @InjectRepository(CustomerDocument)
    private readonly docRepo: Repository<CustomerDocument>,
    private readonly credits: CreditsService,
  ) {}

  findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
  }) {
    const qb = this.repo.createQueryBuilder('c').orderBy('c.name', 'ASC');

    if (!query.includeInactive) {
      qb.where('c.is_active = true');
    }

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      qb.andWhere(
        `(c.name ILIKE :search
          OR c.email ILIKE :search
          OR c.phone ILIKE :search
          OR c.contact_person ILIKE :search
          OR c.organization_name ILIKE :search
          OR c.tin_number ILIKE :search)`,
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
    const c = await this.repo.findOne({
      where: { id },
      relations: { documents: true },
    });
    if (!c) throw new NotFoundException('Customer not found');
    if (c.documents?.length) {
      c.documents.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return this.serialize(c);
  }

  async findProfile(id: string) {
    const customer = await this.findOne(id);
    const credit = await this.credits.customerCreditProfile(id);
    return { ...customer, credit };
  }

  create(dto: CreateCustomerDto) {
    return this.repo
      .save(
        this.repo.create({
          name: dto.name.trim(),
          customerType: dto.customerType ?? CustomerType.NORMAL,
          contactPerson: dto.contactPerson?.trim() || null,
          phone: dto.phone?.trim() || null,
          alternatePhone: dto.alternatePhone?.trim() || null,
          email: dto.email?.trim() || null,
          address: dto.address?.trim() || null,
          city: dto.city?.trim() || null,
          region: dto.region?.trim() || null,
          organizationName: dto.organizationName?.trim() || null,
          tinNumber: dto.tinNumber?.trim() || null,
          notes: dto.notes?.trim() || null,
          creditLimit:
            dto.creditLimit !== undefined ? dto.creditLimit.toFixed(2) : null,
        }),
      )
      .then((c) => this.findOne(c.id));
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Customer not found');

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Name is required');
      c.name = name;
    }
    if (dto.customerType !== undefined) c.customerType = dto.customerType;
    if (dto.contactPerson !== undefined) {
      c.contactPerson = dto.contactPerson?.trim() || null;
    }
    if (dto.phone !== undefined) c.phone = dto.phone?.trim() || null;
    if (dto.alternatePhone !== undefined) {
      c.alternatePhone = dto.alternatePhone?.trim() || null;
    }
    if (dto.email !== undefined) c.email = dto.email?.trim() || null;
    if (dto.address !== undefined) c.address = dto.address?.trim() || null;
    if (dto.city !== undefined) c.city = dto.city?.trim() || null;
    if (dto.region !== undefined) c.region = dto.region?.trim() || null;
    if (dto.organizationName !== undefined) {
      c.organizationName = dto.organizationName?.trim() || null;
    }
    if (dto.tinNumber !== undefined) {
      c.tinNumber = dto.tinNumber?.trim() || null;
    }
    if (dto.notes !== undefined) c.notes = dto.notes?.trim() || null;
    if (dto.isActive !== undefined) c.isActive = dto.isActive;
    if (dto.creditLimit !== undefined) {
      c.creditLimit =
        dto.creditLimit === null ? null : Number(dto.creditLimit).toFixed(2);
    }
    await this.repo.save(c);
    return this.findOne(id);
  }

  async remove(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Customer not found');
    c.isActive = false;
    await this.repo.save(c);
    return { id: c.id, deleted: true };
  }

  async uploadDocument(
    customerId: string,
    kind: CustomerDocumentKind,
    file: UploadedFile | undefined,
    userId: string | null,
    titleInput?: string | null,
  ) {
    const customer = await this.repo.findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    if (
      kind === CustomerDocumentKind.AGENT_AGREEMENT &&
      customer.customerType !== CustomerType.AGENT
    ) {
      throw new BadRequestException(
        'Agent agreement documents can only be uploaded for Agent customers',
      );
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Document must be JPEG, PNG, WebP, or PDF',
      );
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Document must be 10MB or smaller');
    }

    let title = (titleInput ?? '').trim();
    if (!title) {
      title =
        kind === CustomerDocumentKind.AGENT_AGREEMENT
          ? 'Agent Agreement'
          : 'Document';
    }
    title = title.slice(0, 200);

    const ext = this.safeExt(file.originalname, file.mimetype);
    const storageKey = path
      .join(customerId, `${kind.toLowerCase()}-${randomUUID()}${ext}`)
      .replace(/\\/g, '/');
    mkdirSync(path.join(UPLOAD_ROOT, customerId), { recursive: true });
    writeFileSync(path.join(UPLOAD_ROOT, storageKey), file.buffer);

    const doc = await this.docRepo.save(
      this.docRepo.create({
        customerId,
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

  async listDocuments(customerId: string) {
    await this.ensureCustomer(customerId);
    const docs = await this.docRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    return docs.map((d) => this.serializeDocument(d));
  }

  async downloadDocument(customerId: string, documentId: string) {
    const doc = await this.docRepo.findOne({
      where: { id: documentId, customerId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    const abs = path.join(UPLOAD_ROOT, doc.storageKey);
    if (!existsSync(abs)) {
      throw new NotFoundException('File missing on disk');
    }
    return {
      file: new StreamableFile(createReadStream(abs)),
      mimeType: doc.mimeType,
      originalName: doc.originalName,
    };
  }

  async deleteDocument(customerId: string, documentId: string) {
    const doc = await this.docRepo.findOne({
      where: { id: documentId, customerId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    const abs = path.join(UPLOAD_ROOT, doc.storageKey);
    if (existsSync(abs)) {
      try {
        unlinkSync(abs);
      } catch {
        /* ignore */
      }
    }
    await this.docRepo.remove(doc);
    return { id: documentId, deleted: true };
  }

  private async ensureCustomer(id: string) {
    const exists = await this.repo.exists({ where: { id } });
    if (!exists) throw new NotFoundException('Customer not found');
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

  private serializeDocument(doc: CustomerDocument) {
    return {
      id: doc.id,
      customerId: doc.customerId,
      kind: doc.kind,
      title: doc.title,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      uploadedById: doc.uploadedById,
      createdAt: doc.createdAt,
      downloadPath: `/customers/${doc.customerId}/documents/${doc.id}/download`,
    };
  }

  private serialize(c: Customer) {
    return {
      ...c,
      documents: (c.documents ?? []).map((d) => this.serializeDocument(d)),
    };
  }
}
