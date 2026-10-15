import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsModule } from '../approvals/approvals.module';
import { BanksModule } from '../banks/banks.module';
import { CustomerCredit } from '../database/entities/customer-credit.entity';
import { Item } from '../database/entities/item.entity';
import { Lot } from '../database/entities/lot.entity';
import { ExportContract } from '../database/entities/export-contract.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleReturn } from '../database/entities/sale-return.entity';
import { User } from '../database/entities/user.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CreditsModule } from '../credits/credits.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleReturn,
      CustomerCredit,
      User,
      Item,
      Lot,
      ExportContract,
    ]),
    InventoryModule,
    BanksModule,
    NotificationsModule,
    CreditsModule,
    forwardRef(() => ApprovalsModule),
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
