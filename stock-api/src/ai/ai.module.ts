import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiFeedback } from '../database/entities/ai-feedback.entity';
import { AiInsight } from '../database/entities/ai-insight.entity';
import { CollectionTicket } from '../database/entities/collection-ticket.entity';
import { ExportContract } from '../database/entities/export-contract.entity';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiInsight,
      AiFeedback,
      Lot,
      ExportContract,
      StockLevel,
      CollectionTicket,
      LotEvent,
    ]),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
