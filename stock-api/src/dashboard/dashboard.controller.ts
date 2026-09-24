import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { IsDateString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
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
  overview(@Query() query: DashboardQueryDto) {
    return this.service.getOverview(query.from, query.to);
  }

  /** Local roast / domestic market command center. */
  @Get('local')
  @RequirePermissions('insights.read', 'dashboard.read')
  local(@Query() query: DashboardQueryDto) {
    return this.service.getLocalOverview(query.from, query.to);
  }

  /** Export / green coffee command center. */
  @Get('export')
  @RequirePermissions('insights.read', 'dashboard.read')
  exportOverview(@Query() query: DashboardQueryDto) {
    return this.service.getExportOverview(query.from, query.to);
  }
}
