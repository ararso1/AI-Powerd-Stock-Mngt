import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierBankAccount } from '../database/entities/supplier-bank-account.entity';
import { SupplierDocument } from '../database/entities/supplier-document.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier, SupplierDocument, SupplierBankAccount]),
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
