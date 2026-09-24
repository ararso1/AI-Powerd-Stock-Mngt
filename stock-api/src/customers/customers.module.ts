import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditsModule } from '../credits/credits.module';
import { CustomerDocument } from '../database/entities/customer-document.entity';
import { Customer } from '../database/entities/customer.entity';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, CustomerDocument]),
    CreditsModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
