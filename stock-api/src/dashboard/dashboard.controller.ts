import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { IsDateString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { canViewExport, canViewLocal } from './dashboard-access';
import { DashboardService } from './dashboard.service';

class DashboardQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @RequirePermissions('insights.read', 'dashboard.read')
  overview(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getOverview(query.from, query.to, user.sub);
  }

  /** Local market: purchase, inventory, cleaning, roast, sales store, and local sales. */
  @Get('local')
  @RequirePermissions('insights.read', 'dashboard.read')
  async local(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const access = await this.service.resolveAccess(user.sub);
    if (!canViewLocal(access)) {
      throw new ForbiddenException(
        'Your role does not have access to the local market dashboard',
      );
    }
    return this.service.getLocalOverview(query.from, query.to, user.sub);
  }

  /** Export / green coffee command center. */
  @Get('export')
  @RequirePermissions('insights.read', 'dashboard.read')
  async exportOverview(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const access = await this.service.resolveAccess(user.sub);
    if (!canViewExport(access)) {
      throw new ForbiddenException(
        'Your role does not have access to the export dashboard',
      );
    }
    return this.service.getExportOverview(query.from, query.to, user.sub);
  }
}
