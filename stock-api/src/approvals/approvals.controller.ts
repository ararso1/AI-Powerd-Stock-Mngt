import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { DecideApprovalDto } from './dto/approval.dto';
import { ApprovalsService } from './approvals.service';

@Controller('approvals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get('pending')
  @RequirePermissions('approvals.read', 'approvals.decide', 'purchase.approve', 'sales.approve', 'process.approve')
  listPending(@CurrentUser() user: JwtPayload) {
    return this.service.listPendingForUser(user.sub);
  }

  @Get('mine')
  @RequirePermissions('approvals.read')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.service.listMine(user.sub);
  }

  @Get(':id')
  @RequirePermissions('approvals.read', 'approvals.decide', 'purchase.approve', 'sales.approve', 'process.approve')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/decide')
  @RequirePermissions('approvals.decide', 'purchase.approve', 'sales.approve', 'process.approve')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.decide(id, user.sub, dto);
  }
}
