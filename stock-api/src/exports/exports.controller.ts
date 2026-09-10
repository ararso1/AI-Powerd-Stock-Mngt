import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import {
  AllocateExportLotDto,
  CreateExportContractDto,
  ExportContractListQueryDto,
  ShipExportContractDto,
  UpdateDocChecklistDto,
  UpdateExportContractDto,
} from './dto/export-contract.dto';
import { ExportsService } from './exports.service';

@Controller('exports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExportsController {
  constructor(private readonly service: ExportsService) {}

  @Get()
  @RequirePermissions('export.read')
  findAll(@Query() query: ExportContractListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('export.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('export.write')
  create(
    @Body() dto: CreateExportContractDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions('export.write')
  update(@Param('id') id: string, @Body() dto: UpdateExportContractDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/allocate')
  @RequirePermissions('export.write')
  allocate(
    @Param('id') id: string,
    @Body() dto: AllocateExportLotDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.allocate(id, dto, user.sub);
  }

  @Patch(':id/checklist')
  @RequirePermissions('export.write')
  updateChecklist(
    @Param('id') id: string,
    @Body() dto: UpdateDocChecklistDto,
  ) {
    return this.service.updateChecklist(id, dto);
  }

  @Post(':id/stage')
  @RequirePermissions('export.write')
  stage(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.stage(id, user.sub);
  }

  @Post(':id/ship')
  @RequirePermissions('export.write')
  ship(
    @Param('id') id: string,
    @Body() dto: ShipExportContractDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.ship(id, dto ?? {}, user.sub);
  }

  @Post(':id/close')
  @RequirePermissions('export.write')
  close(@Param('id') id: string) {
    return this.service.close(id);
  }

  @Post(':id/cancel')
  @RequirePermissions('export.write')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
