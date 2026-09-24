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
import { CustomerDocumentKind } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { IsBooleanString, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { CustomersService } from './customers.service';

class CustomerListQueryDto extends ListQueryDto {
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

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @RequirePermissions('customers.read')
  findAll(@Query() query: CustomerListQueryDto) {
    return this.service.findAll({
      page: query.page,
      limit: query.limit,
      search: query.search,
      includeInactive: query.includeInactive === 'true',
    });
  }

  @Get(':id/profile')
  @RequirePermissions('customers.read')
  findProfile(@Param('id') id: string) {
    return this.service.findProfile(id);
  }

  @Get(':id')
  @RequirePermissions('customers.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('customers.write')
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('customers.write')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('customers.write')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/documents')
  @RequirePermissions('customers.read')
  listDocuments(@Param('id') id: string) {
    return this.service.listDocuments(id);
  }

  @Post(':id/documents/:kind')
  @RequirePermissions('customers.write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @Param('id') id: string,
    @Param('kind', new ParseEnumPipe(CustomerDocumentKind))
    kind: CustomerDocumentKind,
    @UploadedFile() file: Express.Multer.File | undefined,
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
  @RequirePermissions('customers.read')
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
  @RequirePermissions('customers.write')
  deleteDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.service.deleteDocument(id, docId);
  }
}
