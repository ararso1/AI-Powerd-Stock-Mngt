import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { SaleChannel } from '../../common/enums';

export const SALES_ANALYSIS_PAYMENT_STATUSES = [
  'CASH',
  'BANK',
  'CREDIT',
  'PARTIAL',
  'OUTSTANDING',
] as const;

export type SalesAnalysisPaymentStatus =
  (typeof SALES_ANALYSIS_PAYMENT_STATUSES)[number];

export class SalesAnalysisQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(SaleChannel)
  channel?: SaleChannel;

  @IsOptional()
  @IsIn(SALES_ANALYSIS_PAYMENT_STATUSES)
  paymentStatus?: SalesAnalysisPaymentStatus;
}
