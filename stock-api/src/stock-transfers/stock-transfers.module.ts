import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from '../database/entities/item.entity';
import { Lot } from '../database/entities/lot.entity';
import { StockTransfer } from '../database/entities/stock-transfer.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StockTransfersController } from './stock-transfers.controller';
import { StockTransfersService } from './stock-transfers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockTransfer, Item, Lot]),
    InventoryModule,
    NotificationsModule,
  ],
  controllers: [StockTransfersController],
  providers: [StockTransfersService],
})
export class StockTransfersModule {}
