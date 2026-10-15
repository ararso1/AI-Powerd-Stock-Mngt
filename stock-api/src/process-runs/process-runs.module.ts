import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsModule } from '../approvals/approvals.module';
import { Item } from '../database/entities/item.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { ProcessRun } from '../database/entities/process-run.entity';
import { ProcessTemplate } from '../database/entities/process-template.entity';
import { QcResult } from '../database/entities/qc-result.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { ExportMarketWorkflowService } from './export-market-workflow.service';
import { LocalMarketWorkflowService } from './local-market-workflow.service';
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
    forwardRef(() => ApprovalsModule),
  ],
  controllers: [ProcessRunsController],
  providers: [
    ProcessRunsService,
    LocalMarketWorkflowService,
    ExportMarketWorkflowService,
  ],
  exports: [ProcessRunsService],
})
export class ProcessRunsModule {}
