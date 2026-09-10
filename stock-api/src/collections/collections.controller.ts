import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CollectionsService } from './collections.service';
import {
  CherryPriceQueryDto,
  CollectionListQueryDto,
} from './dto/collection-list-query.dto';
import {
  CreateCollectionDto,
  UpsertCherryPriceDto,
} from './dto/collection.dto';

@Controller('collections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}

  @Get('prices')
  @RequirePermissions('collection.read')
  listPrices(@Query() query: CherryPriceQueryDto) {
    return this.service.listPrices(query);
  }

  @Put('prices')
  @RequirePermissions('collection.write')
  upsertPrice(@Body() dto: UpsertCherryPriceDto) {
    return this.service.upsertPrice(dto);
  }

  @Get()
  @RequirePermissions('collection.read')
  findAll(@Query() query: CollectionListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('collection.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('collection.write')
  create(@Body() dto: CreateCollectionDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
}
