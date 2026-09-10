import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AiService } from './ai.service';
import {
  AiFeedbackDto,
  AiInsightListQueryDto,
  AiRefreshDto,
} from './dto/ai.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiController {
  constructor(private readonly service: AiService) {}

  @Get('summary')
  @RequirePermissions('insights.read', 'dashboard.read', 'ai.read')
  summary() {
    return this.service.summary();
  }

  @Get('trends')
  @RequirePermissions('insights.read', 'dashboard.read', 'ai.read')
  trends() {
    return this.service.getStockTrends();
  }

  @Get('insights')
  @RequirePermissions('insights.read', 'dashboard.read', 'ai.read')
  findAll(@Query() query: AiInsightListQueryDto) {
    return this.service.findAll(query);
  }

  @Get('insights/:id')
  @RequirePermissions('insights.read', 'dashboard.read', 'ai.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('insights/:id/feedback')
  @RequirePermissions('ai.feedback', 'insights.read', 'insights.exec')
  feedback(
    @Param('id') id: string,
    @Body() dto: AiFeedbackDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submitFeedback(id, dto, user.sub);
  }

  @Post('refresh')
  @RequirePermissions('insights.exec', 'ai.feedback')
  refresh(@Body() dto: AiRefreshDto) {
    return this.service.refresh(dto);
  }
}
