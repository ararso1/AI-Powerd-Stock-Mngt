import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../database/entities/customer.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
  ) {}

  findAll(query: { page?: number; limit?: number; search?: string }) {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.is_active = true')
      .orderBy('c.name', 'ASC');

    if (query.search?.trim()) {
      qb.andWhere(
        '(c.name ILIKE :search OR c.email ILIKE :search OR c.phone ILIKE :search)',
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
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  create(dto: CreateCustomerDto) {
    return this.repo.save(
      this.repo.create({
        name: dto.name,
        customerType: dto.customerType,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
        creditLimit:
          dto.creditLimit !== undefined ? dto.creditLimit.toFixed(2) : null,
      }),
    );
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const c = await this.findOne(id);
    if (dto.name !== undefined) c.name = dto.name;
    if (dto.customerType !== undefined) c.customerType = dto.customerType;
    if (dto.phone !== undefined) c.phone = dto.phone ?? null;
    if (dto.email !== undefined) c.email = dto.email ?? null;
    if (dto.address !== undefined) c.address = dto.address ?? null;
    if (dto.isActive !== undefined) c.isActive = dto.isActive;
    if (dto.creditLimit !== undefined) {
      c.creditLimit =
        dto.creditLimit === null ? null : Number(dto.creditLimit).toFixed(2);
    }
    return this.repo.save(c);
  }

  async remove(id: string) {
    const c = await this.findOne(id);
    c.isActive = false;
    return this.repo.save(c);
  }
}
