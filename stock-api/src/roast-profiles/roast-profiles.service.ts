import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  applyIlikeSearch,
  paginatedQueryBuilder,
} from '../common/utils/query.util';
import { RoastProfile } from '../database/entities/roast-profile.entity';
import {
  CreateRoastProfileDto,
  RoastProfileListQueryDto,
  UpdateRoastProfileDto,
} from './dto/roast-profile.dto';

@Injectable()
export class RoastProfilesService {
  constructor(
    @InjectRepository(RoastProfile)
    private readonly repo: Repository<RoastProfile>,
  ) {}

  findAll(query: RoastProfileListQueryDto) {
    const qb = this.repo
      .createQueryBuilder('profile')
      .orderBy('profile.name', 'ASC');
    applyIlikeSearch(qb, query.search, [
      'profile.code',
      'profile.name',
      'profile.roast_level',
    ]);
    return paginatedQueryBuilder(qb, query.page, query.limit);
  }

  async findOne(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Roast profile not found');
    return row;
  }

  async create(dto: CreateRoastProfileDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.repo.findOne({ where: { code } });
    if (existing) throw new ConflictException(`Profile ${code} already exists`);
    return this.repo.save(
      this.repo.create({
        code,
        name: dto.name.trim(),
        roastLevel: dto.roastLevel?.trim() || null,
        targetAgtron: dto.targetAgtron ?? null,
        durationMinutes: dto.durationMinutes ?? null,
        blendNotes: dto.blendNotes?.trim() || null,
        shelfLifeDays: dto.shelfLifeDays ?? 90,
        notes: dto.notes?.trim() || null,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async update(id: string, dto: UpdateRoastProfileDto) {
    const row = await this.findOne(id);
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.roastLevel !== undefined) {
      row.roastLevel = dto.roastLevel?.trim() || null;
    }
    if (dto.targetAgtron !== undefined) row.targetAgtron = dto.targetAgtron;
    if (dto.durationMinutes !== undefined) {
      row.durationMinutes = dto.durationMinutes;
    }
    if (dto.blendNotes !== undefined) {
      row.blendNotes = dto.blendNotes?.trim() || null;
    }
    if (dto.shelfLifeDays !== undefined) {
      row.shelfLifeDays = dto.shelfLifeDays;
    }
    if (dto.notes !== undefined) row.notes = dto.notes?.trim() || null;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return this.repo.save(row);
  }
}
