import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ROLE_NAMES } from '../database/constants/permissions';
import { UserLocation } from '../database/entities/user-location.entity';
import { User } from '../database/entities/user.entity';

@Injectable()
export class UserLocationAccessService {
  constructor(
    @InjectRepository(UserLocation)
    private readonly userLocationRepo: Repository<UserLocation>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getScopedLocationIds(userId: string): Promise<string[] | null> {
    const rows = await this.userLocationRepo.find({ where: { userId } });
    if (rows.length === 0) return null;
    return rows.map((r) => r.locationId);
  }

  async assertCanUseLocation(userId: string | undefined, locationId: string) {
    if (!userId) return;
    const scoped = await this.getScopedLocationIds(userId);
    if (!scoped) return;
    if (!scoped.includes(locationId)) {
      throw new ForbiddenException(
        'You are not authorized to use this warehouse/location',
      );
    }
  }

  async filterLocationIds(
    userId: string | undefined,
    requested?: string | null,
  ): Promise<string[] | undefined> {
    if (!userId) return requested ? [requested] : undefined;
    const scoped = await this.getScopedLocationIds(userId);
    if (!scoped) {
      return requested ? [requested] : undefined;
    }
    if (requested) {
      if (!scoped.includes(requested)) {
        throw new ForbiddenException(
          'You are not authorized to view this warehouse/location',
        );
      }
      return [requested];
    }
    return scoped;
  }

  async assignLocations(userId: string, locationIds: string[]) {
    if (!locationIds.length) {
      throw new BadRequestException('At least one location is required');
    }
    await this.userLocationRepo.delete({ userId });
    const rows = locationIds.map((locationId) =>
      this.userLocationRepo.create({ userId, locationId }),
    );
    return this.userLocationRepo.save(rows);
  }

  async getUserRoleName(userId: string): Promise<string | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });
    return user?.role?.name ?? null;
  }

  isAdminRole(roleName: string | null | undefined): boolean {
    return roleName === ROLE_NAMES.ADMIN;
  }

  async findActiveUsersByRoleNames(roleNames: string[]): Promise<User[]> {
    if (roleNames.length === 0) return [];
    return this.userRepo
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.role', 'role')
      .where('user.is_active = true')
      .andWhere('role.name IN (:...roleNames)', { roleNames })
      .getMany();
  }

  async findActiveUsersByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return this.userRepo.find({
      where: { id: In(ids), isActive: true },
      relations: { role: true },
    });
  }
}
