import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginatedRepositoryFind } from '../common/utils/query.util';
import { Supplier } from '../database/entities/supplier.entity';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,
  ) {}

  findAll(query: { page?: number; limit?: number; search?: string }) {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.is_active = true')
      .orderBy('s.name', 'ASC');

    if (query.search?.trim()) {
      qb.andWhere(
        '(s.name ILIKE :search OR s.email ILIKE :search OR s.phone ILIKE :search)',
        { search: `%${query.search.trim()}%` },
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
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Supplier not found');
    return s;
  }

  create(dto: CreateSupplierDto) {
    return this.repo.save(
      this.repo.create({
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
        creditLimit:
          dto.creditLimit !== undefined ? dto.creditLimit.toFixed(2) : null,
      }),
    );
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const s = await this.findOne(id);
    if (dto.name !== undefined) s.name = dto.name;
    if (dto.phone !== undefined) s.phone = dto.phone ?? null;
    if (dto.email !== undefined) s.email = dto.email ?? null;
    if (dto.address !== undefined) s.address = dto.address ?? null;
    if (dto.isActive !== undefined) s.isActive = dto.isActive;
    if (dto.creditLimit !== undefined) {
      s.creditLimit =
        dto.creditLimit === null ? null : Number(dto.creditLimit).toFixed(2);
    }
    return this.repo.save(s);
  }

  async remove(id: string) {
    const s = await this.findOne(id);
    s.isActive = false;
    return this.repo.save(s);
  }
}
