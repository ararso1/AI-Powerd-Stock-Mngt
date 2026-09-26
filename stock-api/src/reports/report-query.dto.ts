import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PurchaseType } from '../common/enums';

export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  soldByUserId?: string;

  /** Filter purchase reports by local market vs export. */
  @IsOptional()
  @IsEnum(PurchaseType)
  purchaseType?: PurchaseType;
}
