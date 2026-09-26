import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BanksModule } from '../banks/banks.module';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { PurchaseLine } from '../database/entities/purchase-line.entity';
import { PurchaseQualityResult } from '../database/entities/purchase-quality-result.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { SupplierCredit } from '../database/entities/supplier-credit.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CreditsModule } from '../credits/credits.module';
import { PurchaseQualityService } from './purchase-quality.service';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Purchase,
      PurchaseLine,
      PurchaseQualityResult,
      SupplierCredit,
      Lot,
      LotEvent,
    ]),
    InventoryModule,
    BanksModule,
    NotificationsModule,
    CreditsModule,
  ],
  controllers: [PurchasesController],
  providers: [PurchasesService, PurchaseQualityService],
  exports: [PurchaseQualityService],
})
export class PurchasesModule {}
