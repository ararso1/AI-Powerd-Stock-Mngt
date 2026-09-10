import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from '../database/entities/item.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { ProcessRun } from '../database/entities/process-run.entity';
import { ProcessTemplate } from '../database/entities/process-template.entity';
import { QcResult } from '../database/entities/qc-result.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { ProcessRunsController } from './process-runs.controller';
import { ProcessRunsService } from './process-runs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessRun,
      ProcessTemplate,
      QcResult,
      Lot,
      Item,
      Location,
    ]),
    InventoryModule,
  ],
  controllers: [ProcessRunsController],
  providers: [ProcessRunsService],
  exports: [ProcessRunsService],
})
export class ProcessRunsModule {}
