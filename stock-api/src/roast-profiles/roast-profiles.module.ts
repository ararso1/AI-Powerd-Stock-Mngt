import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoastProfile } from '../database/entities/roast-profile.entity';
import { RoastProfilesController } from './roast-profiles.controller';
import { RoastProfilesService } from './roast-profiles.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoastProfile])],
  controllers: [RoastProfilesController],
  providers: [RoastProfilesService],
  exports: [RoastProfilesService],
})
export class RoastProfilesModule {}
