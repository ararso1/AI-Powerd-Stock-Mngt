import {
  Body,
  Controller,
  Delete,
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
import { PurchaseType } from '../common/enums';
import { ProcessRunListQueryDto } from './dto/process-run-list-query.dto';
import {
  CompleteProcessRunDto,
  CreateProcessRunDto,
  CreateProcessTemplateDto,
  SubmitQcDto,
} from './dto/process-run.dto';
import {
  SubmitExportStageDto,
  UpdateExportDocumentsDto,
} from './dto/export-stage.dto';
import { SubmitLocalStageDto } from './dto/local-stage.dto';
import { ExportMarketWorkflowService } from './export-market-workflow.service';
import { LocalMarketWorkflowService } from './local-market-workflow.service';
import { ProcessRunsService } from './process-runs.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProcessRunsController {
  constructor(
    private readonly service: ProcessRunsService,
    private readonly localMarket: LocalMarketWorkflowService,
    private readonly exportMarket: ExportMarketWorkflowService,
  ) {}

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

  @Get('process-runs/summary')
  @RequirePermissions('process.read')
  summary(@Query() query: ProcessRunListQueryDto) {
    return this.service.summary(query);
  }

  @Get('process-runs/:id')
  @RequirePermissions('process.read')
  findOne(@Param('id') id: string) {
    return this.present(id);
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

  @Post('process-runs/:id/local-stage')
  @RequirePermissions('process.write')
  async submitLocalStage(
    @Param('id') id: string,
    @Body() dto: SubmitLocalStageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.localMarket.submit(id, dto, user.sub);
    return this.present(id);
  }

  @Post('process-runs/:id/export-stage')
  @RequirePermissions('process.write')
  async submitExportStage(
    @Param('id') id: string,
    @Body() dto: SubmitExportStageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.exportMarket.submit(id, dto, user.sub);
    return this.present(id);
  }

  @Post('process-runs/:id/export-documents')
  @RequirePermissions('process.write')
  async updateExportDocuments(
    @Param('id') id: string,
    @Body() dto: UpdateExportDocumentsDto,
  ) {
    await this.exportMarket.updateDocuments(id, dto);
    return this.present(id);
  }

  private async present(id: string) {
    const run = await this.service.findOne(id);
    if (run.workflow === PurchaseType.LOCAL) {
      return {
        ...run,
        localMarket: await this.localMarket.view(run),
      };
    }
    if (run.workflow === PurchaseType.EXPORT) {
      return {
        ...run,
        exportMarket: await this.exportMarket.view(run),
      };
    }
    return run;
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

  @Post('process-runs/:id/rollback')
  @RequirePermissions('process.write')
  rollback(@Param('id') id: string) {
    return this.service.rollback(id);
  }

  @Delete('process-runs/:id')
  @RequirePermissions('process.write')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
