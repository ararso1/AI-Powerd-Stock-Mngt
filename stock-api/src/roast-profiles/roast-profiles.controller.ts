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
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import {
  CreateRoastProfileDto,
  RoastProfileListQueryDto,
  UpdateRoastProfileDto,
} from './dto/roast-profile.dto';
import { RoastProfilesService } from './roast-profiles.service';

@Controller('roast-profiles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoastProfilesController {
  constructor(private readonly service: RoastProfilesService) {}

  @Get()
  @RequirePermissions('process.read')
  findAll(@Query() query: RoastProfileListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('process.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('process.write')
  create(@Body() dto: CreateRoastProfileDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('process.write')
  update(@Param('id') id: string, @Body() dto: UpdateRoastProfileDto) {
    return this.service.update(id, dto);
  }
}
