import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ProcessRunListQueryDto } from './dto/process-run-list-query.dto';
import {
  CompleteProcessRunDto,
  CreateProcessRunDto,
  CreateProcessTemplateDto,
  SubmitQcDto,
} from './dto/process-run.dto';
import { ProcessRunsService } from './process-runs.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProcessRunsController {
  constructor(private readonly service: ProcessRunsService) {}

  @Get('process-templates')
  @RequirePermissions('process.read')
  listTemplates() {
    return this.service.listTemplates();
  }

  @Post('process-templates')
  @RequirePermissions('process.write')
  createTemplate(@Body() dto: CreateProcessTemplateDto) {
    return this.service.createTemplate(dto);
  }

  @Get('process-runs')
  @RequirePermissions('process.read')
  findAll(@Query() query: ProcessRunListQueryDto) {
    return this.service.findAll(query);
  }

  @Get('process-runs/:id')
  @RequirePermissions('process.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('process-runs')
  @RequirePermissions('process.write')
  create(@Body() dto: CreateProcessRunDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Post('process-runs/:id/start')
  @RequirePermissions('process.write')
  start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.start(id, user.sub);
  }

  @Post('process-runs/:id/complete-stage')
  @RequirePermissions('process.write')
  completeStage(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.completeStage(id, user.sub);
  }

  @Post('process-runs/:id/qc')
  @RequirePermissions('process.write')
  submitQc(
    @Param('id') id: string,
    @Body() dto: SubmitQcDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submitQc(id, dto, user.sub);
  }

  @Post('process-runs/:id/complete')
  @RequirePermissions('process.write')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteProcessRunDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.complete(id, dto, user.sub);
  }

  @Post('process-runs/:id/cancel')
  @RequirePermissions('process.write')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.cancel(id, user.sub);
  }
}
