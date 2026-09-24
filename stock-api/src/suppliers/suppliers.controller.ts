import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
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
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { SupplierDocumentKind } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { IsBooleanString, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { SuppliersService } from './suppliers.service';

class SupplierListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsBooleanString()
  includeInactive?: string;
}

class UploadDocumentBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers.read')
  findAll(@Query() query: SupplierListQueryDto) {
    return this.service.findAll({
      page: query.page,
      limit: query.limit,
      search: query.search,
      includeInactive: query.includeInactive === 'true',
    });
  }

  @Get(':id')
  @RequirePermissions('suppliers.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('suppliers.write')
  create(@Body() dto: CreateSupplierDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('suppliers.write')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('suppliers.write')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/documents')
  @RequirePermissions('suppliers.read')
  listDocuments(@Param('id') id: string) {
    return this.service.listDocuments(id);
  }

  @Post(':id/documents/:kind')
  @RequirePermissions('suppliers.write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @Param('id') id: string,
    @Param('kind', new ParseEnumPipe(SupplierDocumentKind))
    kind: SupplierDocumentKind,
    @UploadedFile()
    file: Express.Multer.File | undefined,
    @Body() body: UploadDocumentBodyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.uploadDocument(
      id,
      kind,
      file
        ? {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            buffer: file.buffer,
          }
        : undefined,
      user.sub,
      body?.title,
    );
  }

  @Get(':id/documents/:docId/download')
  @RequirePermissions('suppliers.read')
  async downloadDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { file, mimeType, originalName } =
      await this.service.downloadDocument(id, docId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${originalName.replace(/"/g, '')}"`,
    });
    return file;
  }

  @Delete(':id/documents/:docId')
  @RequirePermissions('suppliers.write')
  deleteDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.service.deleteDocument(id, docId);
  }
}
