import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { PasswordResetToken } from '../database/entities/password-reset-token.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { User } from '../database/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/auth.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/forgot-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetRepo: Repository<PasswordResetToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .where('user.email = :email', { email: dto.email.toLowerCase() })
      .andWhere('user.isActive = true')
      .getOne();
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.toUserProfile(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    const stored = await this.refreshRepo.findOne({
      where: { token: refreshToken, isRevoked: false },
      relations: { user: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepo.findOne({
      where: { id: stored.userId, isActive: true },
      relations: { role: { permissions: true } },
    });
    if (!user) throw new UnauthorizedException('User inactive');

    stored.isRevoked = true;
    await this.refreshRepo.save(stored);

    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.toUserProfile(user), ...tokens };
  }

  async logout(refreshToken: string) {
    await this.refreshRepo.update({ token: refreshToken }, { isRevoked: true });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.findActiveUser(userId);
    return this.toUserProfile(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findActiveUser(userId);

    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase();
      if (email !== user.email) {
        const exists = await this.userRepo.findOne({ where: { email } });
        if (exists) {
          throw new ConflictException('Email already registered');
        }
        user.email = email;
      }
    }

    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName;
    }

    await this.userRepo.save(user);
    return this.me(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .andWhere('user.isActive = true')
      .getOne();

    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.save(user);

    await this.refreshRepo.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );

    return { success: true };
  }

  /**
   * Always returns a generic success message to avoid email enumeration.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepo.findOne({
      where: { email, isActive: true },
    });

    if (user) {
      // Invalidate unused prior tokens for this user
      await this.resetRepo
        .createQueryBuilder()
        .update(PasswordResetToken)
        .set({ usedAt: new Date() })
        .where('user_id = :userId', { userId: user.id })
        .andWhere('used_at IS NULL')
        .execute();

      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = this.hashResetToken(rawToken);
      const minutes =
        this.config.get<number>('mail.passwordResetExpiresMinutes') ?? 60;
      const expiresAt = new Date(Date.now() + minutes * 60_000);

      await this.resetRepo.save(
        this.resetRepo.create({
          userId: user.id,
          tokenHash,
          expiresAt,
          usedAt: null,
        }),
      );

      const frontendUrl =
        this.config.get<string>('mail.frontendUrl') ?? 'http://localhost:3000';
      const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
      await this.mail.sendPasswordReset(user.email, user.fullName, resetUrl);
    }

    return {
      success: true,
      message:
        'If an account exists for that email, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashResetToken(dto.token.trim());
    const record = await this.resetRepo.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: record.userId })
      .andWhere('user.isActive = true')
      .getOne();

    if (!user) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.save(user);

    record.usedAt = new Date();
    await this.resetRepo.save(record);

    // Invalidate any other unused tokens for this user
    await this.resetRepo
      .createQueryBuilder()
      .update(PasswordResetToken)
      .set({ usedAt: new Date() })
      .where('user_id = :userId', { userId: user.id })
      .andWhere('used_at IS NULL')
      .execute();

    await this.refreshRepo.update(
      { userId: user.id, isRevoked: false },
      { isRevoked: true },
    );

    return {
      success: true,
      message: 'Password updated. You can sign in with your new password.',
    };
  }

  private hashResetToken(rawToken: string) {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async findActiveUser(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId, isActive: true },
      relations: { role: { permissions: true } },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private toUserProfile(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
            permissions: user.role.permissions?.map((p) => p.code) ?? [],
          }
        : null,
    };
  }

  private async issueTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get('jwt.accessExpiresIn'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpiresIn'),
      }),
    ]);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId,
        token: refreshToken,
        expiresAt,
      }),
    );

    return { accessToken, refreshToken };
  }
}
