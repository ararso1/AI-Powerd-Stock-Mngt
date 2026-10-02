import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { IsBooleanString, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import {
  AllocateExportLotDto,
  AttachExportLotDto,
  CreateExportContractDto,
  ExportContractListQueryDto,
  ShipExportContractDto,
  UpdateDocChecklistDto,
  UpdateExportContractDto,
} from './dto/export-contract.dto';
import { ExportsService } from './exports.service';

class UpsertExportLotDocumentBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBooleanString()
  clearFile?: string;
}

@Controller('exports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExportsController {
  constructor(private readonly service: ExportsService) {}

  @Get()
  @RequirePermissions('export.read')
  findAll(@Query() query: ExportContractListQueryDto) {
    return this.service.findAll(query);
  }

  @Get('store')
  @RequirePermissions('export.read')
  store() {
    return this.service.exportStore();
  }

  @Get('store/:lotId')
  @RequirePermissions('export.read')
  storeLot(@Param('lotId') lotId: string) {
    return this.service.exportStoreLot(lotId);
  }

  @Post('store/:lotId/attach')
  @RequirePermissions('export.write')
  attachLot(
    @Param('lotId') lotId: string,
    @Body() dto: AttachExportLotDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.attachLot(lotId, dto, user.sub);
  }

  @Post('store/:lotId/documents/:key')
  @RequirePermissions('export.write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upsertLotDocument(
    @Param('lotId') lotId: string,
    @Param('key') key: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UpsertExportLotDocumentBodyDto,
  ) {
    return this.service.upsertLotDocument(lotId, key, {
      reference: body.reference,
      notes: body.notes,
      clearFile: body.clearFile === 'true',
      file: file
        ? {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            buffer: file.buffer,
          }
        : undefined,
    });
  }

  @Get('store/:lotId/documents/:key/file')
  @RequirePermissions('export.read')
  async downloadLotDocument(
    @Param('lotId') lotId: string,
    @Param('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { file, mimeType, originalName } =
      await this.service.downloadLotDocument(lotId, key);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${originalName.replace(/"/g, '')}"`,
    });
    return file;
  }

  @Delete('store/:lotId/documents/:key/file')
  @RequirePermissions('export.write')
  clearLotDocumentFile(
    @Param('lotId') lotId: string,
    @Param('key') key: string,
  ) {
    return this.service.clearLotDocumentFile(lotId, key);
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

  @Post(':id/allocations/:allocationId/deallocate')
  @RequirePermissions('export.write')
  deallocate(
    @Param('id') id: string,
    @Param('allocationId') allocationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deallocate(id, allocationId, user.sub);
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

  @Post(':id/deliver')
  @RequirePermissions('export.write')
  deliver(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markDelivered(id, user.sub);
  }

  @Post(':id/close')
  @RequirePermissions('export.write')
  close(@Param('id') id: string) {
    return this.service.close(id);
  }

  @Post(':id/cancel')
  @RequirePermissions('export.write')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.cancel(id, user.sub);
  }
}
