import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BanksModule } from '../banks/banks.module';
import { BankAccount } from '../database/entities/bank-account.entity';
import { CollectionTicket } from '../database/entities/collection-ticket.entity';
import { CustomerCredit } from '../database/entities/customer-credit.entity';
import { Expense } from '../database/entities/expense.entity';
import { ExportContract } from '../database/entities/export-contract.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { Notification } from '../database/entities/notification.entity';
import { ProcessRun } from '../database/entities/process-run.entity';
import { ProcessTemplate } from '../database/entities/process-template.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleLine } from '../database/entities/sale-line.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
import { SupplierCredit } from '../database/entities/supplier-credit.entity';
import { MarketPricesModule } from '../market-prices/market-prices.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    BanksModule,
    MarketPricesModule,
    TypeOrmModule.forFeature([
      StockLevel,
      Location,
      Sale,
      Purchase,
      SaleLine,
      BankAccount,
      Expense,
      CollectionTicket,
      Lot,
      ProcessRun,
      ProcessTemplate,
      ExportContract,
      CustomerCredit,
      SupplierCredit,
      Supplier,
      Notification,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
