import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { PurchaseListQueryDto } from './dto/purchase-list-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import {
  CreatePurchaseDto,
} from './dto/purchase.dto';
import { UpsertPurchaseQualityDto } from './dto/purchase-quality.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchaseQualityService } from './purchase-quality.service';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchasesController {
  constructor(
    private readonly service: PurchasesService,
    private readonly qualityService: PurchaseQualityService,
  ) {}

  @Get()
  @RequirePermissions('purchase.read')
  findAll(@Query() query: PurchaseListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id/quality')
  @RequirePermissions('purchase.read')
  listQuality(@Param('id') id: string) {
    return this.qualityService.listForPurchase(id);
  }

  @Put(':id/lines/:lineId/quality')
  @RequirePermissions('purchase.write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upsertQuality(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpsertPurchaseQualityDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.qualityService.upsertForLine(
      id,
      lineId,
      dto,
      user.sub,
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

  @Get(':id/quality/:qualityId/document')
  @RequirePermissions('purchase.read')
  async downloadQualityDocument(
    @Param('id') id: string,
    @Param('qualityId') qualityId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { file, mimeType, originalName } =
      await this.qualityService.downloadDocument(id, qualityId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${originalName.replace(/"/g, '')}"`,
    });
    return file;
  }

  @Delete(':id/quality/:qualityId/document')
  @RequirePermissions('purchase.write')
  deleteQualityDocument(
    @Param('id') id: string,
    @Param('qualityId') qualityId: string,
  ) {
    return this.qualityService.deleteDocument(id, qualityId);
  }

  @Get(':id')
  @RequirePermissions('purchase.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('purchase.write')
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions('purchase.write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissions('purchase.write')
  void(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.void(id, user.sub);
  }
}
