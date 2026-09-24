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
import { EntityManager, Repository } from 'typeorm';
import { LotEventType, LotQcPhase } from '../common/enums';
import { LotEvent } from '../database/entities/lot-event.entity';
import { Lot } from '../database/entities/lot.entity';
import { PurchaseLine } from '../database/entities/purchase-line.entity';
import { PurchaseQualityResult } from '../database/entities/purchase-quality-result.entity';
import { Purchase } from '../database/entities/purchase.entity';
import {
  PurchaseLineQualityDto,
  UpsertPurchaseQualityDto,
} from './dto/purchase.dto';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'purchases', 'quality');
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
export class PurchaseQualityService {
  constructor(
    @InjectRepository(PurchaseQualityResult)
    private readonly qualityRepo: Repository<PurchaseQualityResult>,
    @InjectRepository(PurchaseLine)
    private readonly lineRepo: Repository<PurchaseLine>,
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
  ) {}

  async listForPurchase(purchaseId: string) {
    await this.ensurePurchase(purchaseId);
    const rows = await this.qualityRepo.find({
      where: { purchaseId },
      relations: { lot: true, purchaseLine: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async upsertForLine(
    purchaseId: string,
    lineId: string,
    dto: UpsertPurchaseQualityDto,
    userId?: string | null,
    file?: UploadedFile,
  ) {
    const line = await this.lineRepo.findOne({
      where: { id: lineId, purchaseId },
      relations: { lot: true },
    });
    if (!line) throw new NotFoundException('Purchase line not found');
    if (!line.lotId) {
      throw new BadRequestException(
        'ECTA quality results require a coffee lot on the purchase line',
      );
    }

    let row = await this.qualityRepo.findOne({
      where: { purchaseLineId: lineId },
    });
    if (!row) {
      row = this.qualityRepo.create({
        purchaseId,
        purchaseLineId: lineId,
        lotId: line.lotId,
        labName: 'ECTA',
      });
    }

    this.applyManualFields(row, dto);
    row.recordedById = userId ?? row.recordedById ?? null;

    if (file) {
      this.assertFile(file);
      if (row.documentStorageKey) {
        this.tryUnlink(row.documentStorageKey);
      }
      const ext = this.safeExt(file.originalname, file.mimetype);
      const storageKey = path
        .join(purchaseId, `${lineId}-${randomUUID()}${ext}`)
        .replace(/\\/g, '/');
      mkdirSync(path.join(UPLOAD_ROOT, purchaseId), { recursive: true });
      writeFileSync(path.join(UPLOAD_ROOT, storageKey), file.buffer);
      row.documentStorageKey = storageKey;
      row.documentOriginalName = file.originalname.slice(0, 255);
      row.documentMimeType = file.mimetype;
      row.documentSizeBytes = file.size;
    }

    const saved = await this.qualityRepo.save(row);
    await this.syncLotFromQuality(saved);
    return this.serialize(saved);
  }

  async saveInlineQuality(
    manager: EntityManager,
    purchaseId: string,
    line: PurchaseLine,
    quality: PurchaseLineQualityDto | undefined,
    userId?: string | null,
  ) {
    if (!quality || !line.lotId) return;
    const hasData = Object.values(quality).some(
      (v) => v !== undefined && v !== null && v !== '',
    );
    if (!hasData) return;

    const repo = manager.getRepository(PurchaseQualityResult);
    let row = await repo.findOne({ where: { purchaseLineId: line.id } });
    if (!row) {
      row = repo.create({
        purchaseId,
        purchaseLineId: line.id,
        lotId: line.lotId,
        labName: 'ECTA',
      });
    }
    this.applyManualFields(row, quality);
    row.recordedById = userId ?? null;
    const saved = await repo.save(row);
    await this.syncLotFromQuality(saved, manager);
  }

  async downloadDocument(purchaseId: string, qualityId: string) {
    const row = await this.qualityRepo.findOne({
      where: { id: qualityId, purchaseId },
    });
    if (!row?.documentStorageKey) {
      throw new NotFoundException('Quality document not found');
    }
    const abs = path.join(UPLOAD_ROOT, row.documentStorageKey);
    if (!existsSync(abs)) throw new NotFoundException('File missing on disk');
    return {
      file: new StreamableFile(createReadStream(abs)),
      mimeType: row.documentMimeType ?? 'application/octet-stream',
      originalName: row.documentOriginalName ?? 'ecta-result.pdf',
    };
  }

  async deleteDocument(purchaseId: string, qualityId: string) {
    const row = await this.qualityRepo.findOne({
      where: { id: qualityId, purchaseId },
    });
    if (!row) throw new NotFoundException('Quality result not found');
    if (row.documentStorageKey) {
      this.tryUnlink(row.documentStorageKey);
    }
    row.documentStorageKey = null;
    row.documentOriginalName = null;
    row.documentMimeType = null;
    row.documentSizeBytes = null;
    await this.qualityRepo.save(row);
    return { id: qualityId, documentDeleted: true };
  }

  private applyManualFields(
    row: PurchaseQualityResult,
    dto: PurchaseLineQualityDto,
  ) {
    if (dto.labName !== undefined) {
      row.labName = dto.labName.trim() || 'ECTA';
    }
    if (dto.testedAt !== undefined) row.testedAt = dto.testedAt || null;
    if (dto.certificateNumber !== undefined) {
      row.certificateNumber = dto.certificateNumber?.trim() || null;
    }
    if (dto.grade !== undefined) row.grade = dto.grade?.trim() || null;
    if (dto.moisturePercent !== undefined) {
      row.moisturePercent =
        dto.moisturePercent === null || dto.moisturePercent === undefined
          ? null
          : Number(dto.moisturePercent).toFixed(2);
    }
    if (dto.screenSize !== undefined) {
      row.screenSize = dto.screenSize?.trim() || null;
    }
    if (dto.cuppingScore !== undefined) {
      row.cuppingScore =
        dto.cuppingScore === null || dto.cuppingScore === undefined
          ? null
          : Number(dto.cuppingScore).toFixed(2);
    }
    if (dto.defectCount !== undefined) {
      row.defectCount = dto.defectCount ?? null;
    }
    if (dto.defectLevel !== undefined) {
      row.defectLevel = dto.defectLevel?.trim() || null;
    }
    if (dto.passed !== undefined) row.passed = dto.passed ?? null;
    if (dto.notes !== undefined) row.notes = dto.notes?.trim() || null;
  }

  private async syncLotFromQuality(
    row: PurchaseQualityResult,
    manager?: EntityManager,
  ) {
    const lotRepo = manager
      ? manager.getRepository(Lot)
      : this.lotRepo;
    const eventRepo = manager
      ? manager.getRepository(LotEvent)
      : null;
    const lot = await lotRepo.findOne({ where: { id: row.lotId } });
    if (!lot) return;

    if (row.grade) lot.grade = row.grade;
    if (row.moisturePercent) lot.moisturePercent = row.moisturePercent;
    if (row.screenSize) lot.screenSize = row.screenSize;
    if (row.cuppingScore) lot.cuppingScore = row.cuppingScore;
    if (row.defectCount != null) lot.defectCount = row.defectCount;
    if (row.defectLevel) lot.defectLevel = row.defectLevel;
    if (lot.qcPhase === LotQcPhase.RECEIVED) {
      lot.qcPhase = LotQcPhase.SAMPLE_TESTED;
    }
    lot.inspectedAt = new Date();
    await lotRepo.save(lot);

    if (eventRepo) {
      await eventRepo.save(
        eventRepo.create({
          lotId: lot.id,
          eventType: LotEventType.SAMPLE_TESTED,
          quantity: null,
          notes: `ECTA / purchase quality recorded (${row.labName})`,
          createdById: row.recordedById,
          metadata: {
            purchaseId: row.purchaseId,
            purchaseLineId: row.purchaseLineId,
            qualityResultId: row.id,
            passed: row.passed,
          },
        }),
      );
    }
  }

  private async ensurePurchase(id: string) {
    const exists = await this.purchaseRepo.exists({ where: { id } });
    if (!exists) throw new NotFoundException('Purchase not found');
  }

  private assertFile(file: UploadedFile) {
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

  private tryUnlink(storageKey: string) {
    const abs = path.join(UPLOAD_ROOT, storageKey);
    if (existsSync(abs)) {
      try {
        unlinkSync(abs);
      } catch {
        /* ignore */
      }
    }
  }

  serialize(row: PurchaseQualityResult) {
    return {
      id: row.id,
      purchaseId: row.purchaseId,
      purchaseLineId: row.purchaseLineId,
      lotId: row.lotId,
      labName: row.labName,
      testedAt: row.testedAt,
      certificateNumber: row.certificateNumber,
      grade: row.grade,
      moisturePercent: row.moisturePercent,
      screenSize: row.screenSize,
      cuppingScore: row.cuppingScore,
      defectCount: row.defectCount,
      defectLevel: row.defectLevel,
      passed: row.passed,
      notes: row.notes,
      documentOriginalName: row.documentOriginalName,
      documentMimeType: row.documentMimeType,
      documentSizeBytes: row.documentSizeBytes,
      hasDocument: Boolean(row.documentStorageKey),
      downloadPath: row.documentStorageKey
        ? `/purchases/${row.purchaseId}/quality/${row.id}/document`
        : null,
      recordedById: row.recordedById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lot: row.lot
        ? { id: row.lot.id, code: row.lot.code, grade: row.lot.grade }
        : undefined,
    };
  }
}
