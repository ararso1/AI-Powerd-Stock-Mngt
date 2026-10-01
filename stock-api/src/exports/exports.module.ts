import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BanksModule } from '../banks/banks.module';
import { ExportAllocation } from '../database/entities/export-allocation.entity';
import { ExportContract } from '../database/entities/export-contract.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { ProcessRun } from '../database/entities/process-run.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExportContract,
      ExportAllocation,
      Lot,
      Location,
      ProcessRun,
    ]),
    InventoryModule,
    BanksModule,
  ],
  controllers: [ExportsController],
  providers: [ExportsService],
  exports: [ExportsService],
})
export class ExportsModule {}
