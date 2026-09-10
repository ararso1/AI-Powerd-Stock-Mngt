import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BanksModule } from '../banks/banks.module';
import { CherryPrice } from '../database/entities/cherry-price.entity';
import { CollectionTicket } from '../database/entities/collection-ticket.entity';
import { Item } from '../database/entities/item.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CollectionTicket,
      CherryPrice,
      Item,
      Location,
      Lot,
      Supplier,
    ]),
    InventoryModule,
    BanksModule,
    NotificationsModule,
  ],
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
