import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiFeedback } from '../database/entities/ai-feedback.entity';
import { AiInsight } from '../database/entities/ai-insight.entity';
import { CollectionTicket } from '../database/entities/collection-ticket.entity';
import { CustomerCredit } from '../database/entities/customer-credit.entity';
import { ExportContract } from '../database/entities/export-contract.entity';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { SaleLine } from '../database/entities/sale-line.entity';
import { Sale } from '../database/entities/sale.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
import { MarketPricesModule } from '../market-prices/market-prices.module';
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
      Sale,
      SaleLine,
      CustomerCredit,
    ]),
    forwardRef(() => MarketPricesModule),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
