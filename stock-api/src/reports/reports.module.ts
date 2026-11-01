import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRequest } from '../database/entities/approval-request.entity';
import { BankAccount } from '../database/entities/bank-account.entity';
import { BankTransaction } from '../database/entities/bank-transaction.entity';
import { CollectionTicket } from '../database/entities/collection-ticket.entity';
import { CustomerCredit } from '../database/entities/customer-credit.entity';
import { Expense } from '../database/entities/expense.entity';
import { ExportContract } from '../database/entities/export-contract.entity';
import { Lot } from '../database/entities/lot.entity';
import { MarketPrice } from '../database/entities/market-price.entity';
import { ProcessRun } from '../database/entities/process-run.entity';
import { PurchaseLine } from '../database/entities/purchase-line.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { SaleLine } from '../database/entities/sale-line.entity';
import { Sale } from '../database/entities/sale.entity';
import { StockAdjustment } from '../database/entities/stock-adjustment.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
import { StockTransfer } from '../database/entities/stock-transfer.entity';
import { SupplierCredit } from '../database/entities/supplier-credit.entity';
import { User } from '../database/entities/user.entity';
import { ProfitLossModule } from '../profit-loss/profit-loss.module';
import { ReportExportService } from './report-export.service';
import { ReportsController } from './reports.controller';
import { ReportsOpsService } from './reports-ops.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleLine,
      Purchase,
      PurchaseLine,
      Expense,
      BankTransaction,
      BankAccount,
      StockLevel,
      StockAdjustment,
      StockTransfer,
      CustomerCredit,
      SupplierCredit,
      Lot,
      CollectionTicket,
      ProcessRun,
      ExportContract,
      ApprovalRequest,
      User,
      MarketPrice,
    ]),
    ProfitLossModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsOpsService, ReportExportService],
})
export class ReportsModule {}
