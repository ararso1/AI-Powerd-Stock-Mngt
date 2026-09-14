import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportContract } from '../database/entities/export-contract.entity';
import { Lot } from '../database/entities/lot.entity';
import { MarketFxRate } from '../database/entities/market-fx-rate.entity';
import { MarketGradeBasis } from '../database/entities/market-grade-basis.entity';
import { MarketPrice } from '../database/entities/market-price.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
import { MarketFeedService } from './market-feed.service';
import { MarketPricesController } from './market-prices.controller';
import { MarketPricesService } from './market-prices.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketPrice,
      MarketFxRate,
      MarketGradeBasis,
      Lot,
      StockLevel,
      ExportContract,
    ]),
  ],
  controllers: [MarketPricesController],
  providers: [MarketFeedService, MarketPricesService],
  exports: [MarketPricesService],
})
export class MarketPricesModule {}
