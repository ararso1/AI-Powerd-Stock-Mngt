import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  applyDateRangeToQb,
  applyIlikeSearch,
  paginatedQueryBuilder,
} from '../common/utils/query.util';
import {
  CoffeeForm,
  LotEventType,
  LotStatus,
} from '../common/enums';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { Location } from '../database/entities/location.entity';
import { Item } from '../database/entities/item.entity';
import {
  AppendLotEventDto,
  CreateLotDto,
  MergeLotsDto,
  SplitLotDto,
  UpdateLotDto,
} from './dto/lot.dto';
import { LotListQueryDto } from './dto/lot-list-query.dto';

const LOT_RELATIONS = {
  item: true,
  location: true,
  createdBy: true,
  parentLot: true,
} as const;

@Injectable()
export class LotsService {
  constructor(
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
    @InjectRepository(LotEvent)
    private readonly eventRepo: Repository<LotEvent>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findAll(query: LotListQueryDto) {
    const qb = this.lotRepo
      .createQueryBuilder('lot')
      .leftJoinAndSelect('lot.item', 'item')
      .leftJoinAndSelect('lot.location', 'location')
      .leftJoinAndSelect('lot.createdBy', 'createdBy')
      .orderBy('lot.created_at', 'DESC');

    if (query.locationId) {
      qb.andWhere('lot.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.form) {
      qb.andWhere('lot.form = :form', { form: query.form });
    }
    if (query.status) {
      qb.andWhere('lot.status = :status', { status: query.status });
    }
    if (query.cropYear) {
      qb.andWhere('lot.crop_year = :cropYear', { cropYear: query.cropYear });
    }
    if (query.grade) {
      qb.andWhere('lot.grade ILIKE :grade', { grade: `%${query.grade}%` });
    }
    applyDateRangeToQb(qb, 'lot.created_at', query.from, query.to);
    applyIlikeSearch(qb, query.search, [
      'lot.code',
      'lot.grade',
      'lot.region',
      'lot.variety',
      'item.description',
      'item.sku',
    ]);

    return paginatedQueryBuilder(qb, query.page, query.limit);
  }

  async findOne(id: string) {
    const lot = await this.lotRepo.findOne({
      where: { id },
      relations: LOT_RELATIONS,
    });
    if (!lot) throw new NotFoundException('Lot not found');
    return lot;
  }

  async timeline(id: string) {
    await this.findOne(id);
    return this.eventRepo.find({
      where: { lotId: id },
      relations: {
        createdBy: true,
        fromLocation: true,
        toLocation: true,
        relatedLot: true,
      },
      order: { createdAt: 'ASC' },
    });
  }

  async create(dto: CreateLotDto, userId?: string) {
    if (dto.locationId) await this.assertLocation(dto.locationId);
    if (dto.itemId) await this.assertItem(dto.itemId);

    const code = dto.code?.trim() || (await this.nextLotCode());
    await this.assertCodeUnique(code);

    const lotId = await this.dataSource.transaction(async (manager) => {
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);

      const lot = await lotRepo.save(
        lotRepo.create({
          code,
          itemId: dto.itemId ?? null,
          locationId: dto.locationId ?? null,
          form: dto.form ?? CoffeeForm.GREEN,
          grade: dto.grade ?? null,
          cropYear: dto.cropYear ?? null,
          variety: dto.variety ?? null,
          processMethod: dto.processMethod ?? null,
          region: dto.region ?? null,
          woreda: dto.woreda ?? null,
          kebele: dto.kebele ?? null,
          moisturePercent:
            dto.moisturePercent !== undefined
              ? dto.moisturePercent.toFixed(2)
              : null,
          quantity: dto.quantity.toFixed(3),
          status: LotStatus.ACTIVE,
          notes: dto.notes ?? null,
          createdById: userId ?? null,
        }),
      );

      await eventRepo.save(
        eventRepo.create({
          lotId: lot.id,
          eventType: LotEventType.CREATED,
          quantity: lot.quantity,
          toLocationId: lot.locationId,
          notes: dto.notes ?? 'Lot created',
          createdById: userId ?? null,
          metadata: { code: lot.code, form: lot.form },
        }),
      );

      return lot.id;
    });

    return this.findOne(lotId);
  }

  async update(id: string, dto: UpdateLotDto) {
    const lot = await this.findOne(id);
    if (lot.status === LotStatus.VOIDED) {
      throw new BadRequestException('Cannot update a voided lot');
    }
    if (dto.locationId) await this.assertLocation(dto.locationId);
    if (dto.itemId) await this.assertItem(dto.itemId);

    if (dto.itemId !== undefined) lot.itemId = dto.itemId;
    if (dto.locationId !== undefined) lot.locationId = dto.locationId;
    if (dto.form !== undefined) lot.form = dto.form;
    if (dto.status !== undefined) lot.status = dto.status;
    if (dto.grade !== undefined) lot.grade = dto.grade;
    if (dto.cropYear !== undefined) lot.cropYear = dto.cropYear;
    if (dto.variety !== undefined) lot.variety = dto.variety;
    if (dto.processMethod !== undefined) lot.processMethod = dto.processMethod;
    if (dto.region !== undefined) lot.region = dto.region;
    if (dto.woreda !== undefined) lot.woreda = dto.woreda;
    if (dto.kebele !== undefined) lot.kebele = dto.kebele;
    if (dto.moisturePercent !== undefined) {
      lot.moisturePercent =
        dto.moisturePercent === null
          ? null
          : Number(dto.moisturePercent).toFixed(2);
    }
    if (dto.notes !== undefined) lot.notes = dto.notes;

    await this.lotRepo.save(lot);
    return this.findOne(id);
  }

  async appendEvent(id: string, dto: AppendLotEventDto, userId?: string) {
    const lot = await this.findOne(id);
    if (lot.status === LotStatus.VOIDED) {
      throw new BadRequestException('Cannot append events to a voided lot');
    }
    if (dto.fromLocationId) await this.assertLocation(dto.fromLocationId);
    if (dto.toLocationId) await this.assertLocation(dto.toLocationId);

    const eventType = dto.eventType as LotEventType;

    await this.dataSource.transaction(async (manager) => {
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);

      if (eventType === LotEventType.QC_HELD) {
        lot.status = LotStatus.HOLD;
      }
      if (
        eventType === LotEventType.QC_RELEASED &&
        lot.status === LotStatus.HOLD
      ) {
        lot.status = LotStatus.ACTIVE;
      }
      if (dto.toLocationId) {
        lot.locationId = dto.toLocationId;
      }
      if (
        eventType === LotEventType.ROASTED &&
        lot.form !== CoffeeForm.ROASTED
      ) {
        lot.form = CoffeeForm.ROASTED;
      }
      if (eventType === LotEventType.PACKAGED) {
        lot.form = CoffeeForm.PACKAGED;
      }

      await lotRepo.save(lot);
      await eventRepo.save(
        eventRepo.create({
          lotId: lot.id,
          eventType,
          quantity:
            dto.quantity !== undefined ? dto.quantity.toFixed(3) : null,
          fromLocationId: dto.fromLocationId ?? null,
          toLocationId: dto.toLocationId ?? null,
          notes: dto.notes ?? null,
          createdById: userId ?? null,
        }),
      );
    });

    return this.findOne(id);
  }

  async split(id: string, dto: SplitLotDto, userId?: string) {
    const parent = await this.findOne(id);
    if (parent.status !== LotStatus.ACTIVE) {
      throw new BadRequestException('Only active lots can be split');
    }
    const parentQty = parseFloat(parent.quantity);
    if (dto.quantity >= parentQty) {
      throw new BadRequestException(
        'Split quantity must be less than the parent lot quantity',
      );
    }
    if (dto.locationId) await this.assertLocation(dto.locationId);

    const childCode = dto.newCode?.trim() || (await this.nextLotCode('SPL'));
    await this.assertCodeUnique(childCode);

    const childId = await this.dataSource.transaction(async (manager) => {
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);

      const remaining = (parentQty - dto.quantity).toFixed(3);
      parent.quantity = remaining;
      await lotRepo.save(parent);

      const child = await lotRepo.save(
        lotRepo.create({
          code: childCode,
          itemId: parent.itemId,
          locationId: dto.locationId ?? parent.locationId,
          form: parent.form,
          grade: parent.grade,
          cropYear: parent.cropYear,
          variety: parent.variety,
          processMethod: parent.processMethod,
          region: parent.region,
          woreda: parent.woreda,
          kebele: parent.kebele,
          moisturePercent: parent.moisturePercent,
          quantity: dto.quantity.toFixed(3),
          status: LotStatus.ACTIVE,
          parentLotId: parent.id,
          notes: dto.notes ?? `Split from ${parent.code}`,
          createdById: userId ?? null,
        }),
      );

      await eventRepo.save([
        eventRepo.create({
          lotId: parent.id,
          eventType: LotEventType.SPLIT,
          quantity: dto.quantity.toFixed(3),
          relatedLotId: child.id,
          notes: dto.notes ?? `Split ${dto.quantity} kg to ${child.code}`,
          createdById: userId ?? null,
          metadata: { childCode: child.code, remaining },
        }),
        eventRepo.create({
          lotId: child.id,
          eventType: LotEventType.CREATED,
          quantity: child.quantity,
          relatedLotId: parent.id,
          toLocationId: child.locationId,
          notes: `Created by split from ${parent.code}`,
          createdById: userId ?? null,
          metadata: { parentCode: parent.code },
        }),
      ]);

      return child.id;
    });

    return {
      parent: await this.findOne(id),
      child: await this.findOne(childId),
    };
  }

  async merge(targetId: string, dto: MergeLotsDto, userId?: string) {
    if (targetId === dto.sourceLotId) {
      throw new BadRequestException('Cannot merge a lot into itself');
    }
    const target = await this.findOne(targetId);
    const source = await this.findOne(dto.sourceLotId);

    if (target.status !== LotStatus.ACTIVE || source.status !== LotStatus.ACTIVE) {
      throw new BadRequestException('Only active lots can be merged');
    }
    if (target.form !== source.form) {
      throw new BadRequestException('Lots must share the same coffee form');
    }

    await this.dataSource.transaction(async (manager) => {
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);

      const mergedQty = (
        parseFloat(target.quantity) + parseFloat(source.quantity)
      ).toFixed(3);
      const sourceQty = source.quantity;

      target.quantity = mergedQty;
      await lotRepo.save(target);

      source.quantity = '0.000';
      source.status = LotStatus.VOIDED;
      source.notes = [
        source.notes,
        `Merged into ${target.code}`,
      ]
        .filter(Boolean)
        .join(' · ');
      await lotRepo.save(source);

      await eventRepo.save([
        eventRepo.create({
          lotId: target.id,
          eventType: LotEventType.MERGED,
          quantity: sourceQty,
          relatedLotId: source.id,
          notes: dto.notes ?? `Merged ${source.code} (+${sourceQty} kg)`,
          createdById: userId ?? null,
          metadata: { sourceCode: source.code, quantityAfter: mergedQty },
        }),
        eventRepo.create({
          lotId: source.id,
          eventType: LotEventType.VOIDED,
          quantity: sourceQty,
          relatedLotId: target.id,
          notes: dto.notes ?? `Merged into ${target.code}`,
          createdById: userId ?? null,
        }),
      ]);
    });

    return this.findOne(targetId);
  }

  async void(id: string, userId?: string) {
    const lot = await this.findOne(id);
    if (lot.status === LotStatus.VOIDED) {
      throw new BadRequestException('Lot is already voided');
    }

    await this.dataSource.transaction(async (manager) => {
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);
      lot.status = LotStatus.VOIDED;
      await lotRepo.save(lot);
      await eventRepo.save(
        eventRepo.create({
          lotId: lot.id,
          eventType: LotEventType.VOIDED,
          quantity: lot.quantity,
          notes: 'Lot voided',
          createdById: userId ?? null,
        }),
      );
    });

    return this.findOne(id);
  }

  private async nextLotCode(prefix = 'LOT'): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.lotRepo.count();
    return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async assertCodeUnique(code: string) {
    const existing = await this.lotRepo.findOne({ where: { code } });
    if (existing) {
      throw new BadRequestException(`Lot code ${code} already exists`);
    }
  }

  private async assertLocation(id: string) {
    const loc = await this.locationRepo.findOne({ where: { id } });
    if (!loc) throw new BadRequestException('Location not found');
  }

  private async assertItem(id: string) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new BadRequestException('Item not found');
  }
}
