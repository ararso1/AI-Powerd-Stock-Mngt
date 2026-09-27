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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PurchaseQualityService } from '../purchases/purchase-quality.service';
import {
  AdvanceLotQcDto,
  AppendLotEventDto,
  CreateLotDto,
  MergeLotsDto,
  SaveLotEctaDto,
  SplitLotDto,
  UpdateLotDto,
} from './dto/lot.dto';
import { LotListQueryDto } from './dto/lot-list-query.dto';
import { LotsService } from './lots.service';

@Controller('lots')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LotsController {
  constructor(
    private readonly service: LotsService,
    private readonly purchaseQuality: PurchaseQualityService,
  ) {}

  @Get()
  @RequirePermissions('lot.read')
  findAll(@Query() query: LotListQueryDto) {
    return this.service.findAll(query);
  }

  @Get('next-code')
  @RequirePermissions('lot.write', 'purchase.write')
  nextCode() {
    return this.service.suggestNextCode();
  }

  @Get(':id/timeline')
  @RequirePermissions('lot.read')
  timeline(@Param('id') id: string) {
    return this.service.timeline(id);
  }

  @Get(':id/quality')
  @RequirePermissions('lot.read', 'purchase.read')
  quality(@Param('id') id: string) {
    return this.purchaseQuality.listForLot(id);
  }

  @Get(':id')
  @RequirePermissions('lot.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('lot.write')
  create(@Body() dto: CreateLotDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Post(':id/ecta')
  @RequirePermissions('lot.write', 'purchase.write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  saveEcta(
    @Param('id') id: string,
    @Body() dto: SaveLotEctaDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.service.saveEcta(
      id,
      dto,
      file
        ? {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            buffer: file.buffer,
          }
        : undefined,
    );
  }

  @Get(':id/ecta-document')
  @RequirePermissions('lot.read', 'purchase.read')
  async downloadEcta(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.downloadEctaDocument(id);
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `inline; filename="${result.originalName}"`,
    });
    return result.file;
  }

  @Patch(':id')
  @RequirePermissions('lot.write')
  update(@Param('id') id: string, @Body() dto: UpdateLotDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/qc')
  @RequirePermissions('lot.write', 'process.write')
  advanceQc(
    @Param('id') id: string,
    @Body() dto: AdvanceLotQcDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.advanceQc(id, dto, user.sub);
  }

  @Post(':id/events')
  @RequirePermissions('lot.write')
  appendEvent(
    @Param('id') id: string,
    @Body() dto: AppendLotEventDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.appendEvent(id, dto, user.sub);
  }

  @Post(':id/split')
  @RequirePermissions('lot.split')
  split(
    @Param('id') id: string,
    @Body() dto: SplitLotDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.split(id, dto, user.sub);
  }

  @Post(':id/merge')
  @RequirePermissions('lot.split')
  merge(
    @Param('id') id: string,
    @Body() dto: MergeLotsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.merge(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissions('lot.write')
  void(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.void(id, user.sub);
  }
}
