import {
  Body,
  Controller,
  Delete,
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
  AppendLotEventDto,
  CreateLotDto,
  MergeLotsDto,
  SplitLotDto,
  UpdateLotDto,
} from './dto/lot.dto';
import { LotListQueryDto } from './dto/lot-list-query.dto';
import { LotsService } from './lots.service';

@Controller('lots')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LotsController {
  constructor(private readonly service: LotsService) {}

  @Get()
  @RequirePermissions('lot.read')
  findAll(@Query() query: LotListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id/timeline')
  @RequirePermissions('lot.read')
  timeline(@Param('id') id: string) {
    return this.service.timeline(id);
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

  @Patch(':id')
  @RequirePermissions('lot.write')
  update(@Param('id') id: string, @Body() dto: UpdateLotDto) {
    return this.service.update(id, dto);
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
