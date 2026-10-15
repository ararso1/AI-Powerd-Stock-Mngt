import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { EmploymentStatus } from '../common/enums';
import {
  applyIlikeSearch,
  paginatedQueryBuilder,
} from '../common/utils/query.util';
import { User } from '../database/entities/user.entity';
import { UserLocation } from '../database/entities/user-location.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UserListQueryDto } from './dto/user-list-query.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserLocation)
    private readonly userLocationRepo: Repository<UserLocation>,
  ) {}

  async findAll(query: UserListQueryDto) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.userLocations', 'userLocations')
      .leftJoinAndSelect('userLocations.location', 'location')
      .distinct(true)
      .orderBy('user.created_at', 'DESC');

    if (query.roleId) {
      qb.andWhere('user.role_id = :roleId', { roleId: query.roleId });
    }
    if (query.isActive === 'true') {
      qb.andWhere('user.is_active = true');
    } else if (query.isActive === 'false') {
      qb.andWhere('user.is_active = false');
    }
    applyIlikeSearch(qb, query.search, [
      'user.email',
      'user.full_name',
      'user.department',
      'user.designation',
      'user.employee_code',
      'user.phone',
    ]);

    const page = await paginatedQueryBuilder(qb, query.page, query.limit);
    return {
      ...page,
      data: page.data.map((u) => this.serialize(u)),
    };
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: {
        role: { permissions: true },
        userLocations: { location: true },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.serialize(user);
  }

  async create(dto: CreateUserDto) {
    const exists = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException('Email already registered');
    await this.assertUniqueEmployeeCode(dto.employeeCode);

    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      fullName: dto.fullName,
      roleId: dto.roleId ?? null,
      passwordHash: await bcrypt.hash(dto.password, 10),
      phone: dto.phone?.trim() || null,
      employeeCode: dto.employeeCode?.trim() || null,
      department: dto.department?.trim() || null,
      designation: dto.designation?.trim() || null,
      salary:
        dto.salary !== undefined && dto.salary !== null
          ? dto.salary.toFixed(2)
          : null,
      salaryCurrency: (dto.salaryCurrency ?? 'ETB').toUpperCase(),
      hiredAt: dto.hiredAt ?? null,
      employmentType: dto.employmentType ?? null,
      employmentStatus: dto.employmentStatus ?? EmploymentStatus.ACTIVE,
      notes: dto.notes?.trim() || null,
    });
    const saved = await this.userRepo.save(user);
    if (dto.locationIds !== undefined) {
      await this.setLocations(saved.id, dto.locationIds);
    }
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.email) user.email = dto.email.toLowerCase();
    if (dto.fullName) user.fullName = dto.fullName;
    if (dto.roleId !== undefined) user.roleId = dto.roleId;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.phone !== undefined) user.phone = dto.phone?.trim() || null;
    if (dto.employeeCode !== undefined) {
      await this.assertUniqueEmployeeCode(dto.employeeCode, id);
      user.employeeCode = dto.employeeCode?.trim() || null;
    }
    if (dto.department !== undefined) {
      user.department = dto.department?.trim() || null;
    }
    if (dto.designation !== undefined) {
      user.designation = dto.designation?.trim() || null;
    }
    if (dto.salary !== undefined) {
      user.salary =
        dto.salary === null ? null : Number(dto.salary).toFixed(2);
    }
    if (dto.salaryCurrency !== undefined) {
      user.salaryCurrency = dto.salaryCurrency
        ? dto.salaryCurrency.toUpperCase()
        : null;
    }
    if (dto.hiredAt !== undefined) user.hiredAt = dto.hiredAt;
    if (dto.employmentType !== undefined) {
      user.employmentType = dto.employmentType;
    }
    if (dto.employmentStatus !== undefined) {
      user.employmentStatus = dto.employmentStatus;
      // Keep login access aligned with employment lifecycle
      if (dto.employmentStatus === EmploymentStatus.TERMINATED) {
        user.isActive = false;
      }
    }
    if (dto.notes !== undefined) user.notes = dto.notes?.trim() || null;

    await this.userRepo.save(user);
    if (dto.locationIds !== undefined) {
      await this.setLocations(id, dto.locationIds);
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    user.employmentStatus = EmploymentStatus.TERMINATED;
    await this.userRepo.save(user);
    return this.findOne(id);
  }

  private async assertUniqueEmployeeCode(
    code: string | null | undefined,
    excludeUserId?: string,
  ) {
    const trimmed = code?.trim();
    if (!trimmed) return;
    const existing = await this.userRepo.findOne({
      where: { employeeCode: trimmed },
    });
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('Employee code already in use');
    }
  }

  /** Empty list clears warehouse scope (company-wide). */
  private async setLocations(userId: string, locationIds: string[]) {
    await this.userLocationRepo.delete({ userId });
    const unique = [...new Set(locationIds.filter(Boolean))];
    if (unique.length === 0) return;
    await this.userLocationRepo.save(
      unique.map((locationId) =>
        this.userLocationRepo.create({ userId, locationId }),
      ),
    );
  }

  private serialize(user: User) {
    const locations = (user.userLocations ?? [])
      .map((ul) => ul.location)
      .filter(Boolean)
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        type: loc.type,
      }));
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      roleId: user.roleId,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
            permissions: user.role.permissions?.map((p) =>
              typeof p === 'string' ? p : p.code,
            ),
          }
        : null,
      phone: user.phone,
      employeeCode: user.employeeCode,
      department: user.department,
      designation: user.designation,
      salary: user.salary,
      salaryCurrency: user.salaryCurrency,
      hiredAt: user.hiredAt,
      employmentType: user.employmentType,
      employmentStatus: user.employmentStatus,
      notes: user.notes,
      locationIds: locations.map((l) => l.id),
      locations,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
