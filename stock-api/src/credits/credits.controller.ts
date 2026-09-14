import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { CreditListQueryDto } from './dto/credit-list-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreditsService } from './credits.service';
import { CreditPaymentDto } from './dto/credit-payment.dto';

@Controller('credits')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CreditsController {
  constructor(private readonly service: CreditsService) {}

  @Get('customers')
  @RequirePermissions('credit.read')
  customerCredits(@Query() query: CreditListQueryDto) {
    return this.service.findCustomerCredits(query);
  }

  @Get('suppliers')
  @RequirePermissions('credit.read')
  supplierCredits(@Query() query: CreditListQueryDto) {
    return this.service.findSupplierCredits(query);
  }

  @Get('customers/accounts/:customerId')
  @RequirePermissions('credit.read')
  customerAccount(@Param('customerId') customerId: string) {
    return this.service.customerAccountSummary(customerId);
  }

  @Get('suppliers/accounts/:supplierId')
  @RequirePermissions('credit.read')
  supplierAccount(@Param('supplierId') supplierId: string) {
    return this.service.supplierAccountSummary(supplierId);
  }

  @Get('customers/:id/payments')
  @RequirePermissions('credit.read')
  customerPayments(@Param('id') id: string) {
    return this.service.findCustomerPayments(id);
  }

  @Get('suppliers/:id/payments')
  @RequirePermissions('credit.read')
  supplierPayments(@Param('id') id: string) {
    return this.service.findSupplierPayments(id);
  }

  @Get('aging')
  @RequirePermissions('credit.read')
  aging() {
    return this.service.agingAnalysis();
  }

  @Get('overdue')
  @RequirePermissions('credit.read')
  overdue() {
    return this.service.overdueAccounts();
  }

  @Post('reminders')
  @RequirePermissions('credit.write')
  reminders() {
    return this.service.sendPaymentReminders(true);
  }

  @Post('customers/:id/payments')
  @RequirePermissions('credit.write')
  payCustomer(
    @Param('id') id: string,
    @Body() dto: CreditPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.payCustomerCredit(id, dto, user.sub);
  }

  @Post('suppliers/:id/payments')
  @RequirePermissions('credit.write')
  paySupplier(
    @Param('id') id: string,
    @Body() dto: CreditPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.paySupplierCredit(id, dto, user.sub);
  }
}
