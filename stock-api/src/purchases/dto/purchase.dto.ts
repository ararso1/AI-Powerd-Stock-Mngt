import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod, PurchaseType } from '../../common/enums';
import { resolveLineItemIdFromPayload } from '../../common/utils/line-item-id.util';
import { PurchaseLineQualityDto } from './purchase-quality.dto';

export class PurchaseLineDto {
  @Transform(({ obj }) =>
    resolveLineItemIdFromPayload(obj as Record<string, unknown>),
  )
  @IsUUID('4', {
    message:
      'itemId must be a product UUID — use inventory.itemId or item.id from GET /inventory, not the stock row id alone unless it is the item id',
  })
  itemId: string;

  /** Required for coffee (COF-*) items. */
  @IsOptional()
  @IsUUID()
  lotId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PurchaseLineQualityDto)
  quality?: PurchaseLineQualityDto;
}

export class CreatePurchaseDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()
  locationId: string;

  @IsOptional()
  @IsEnum(PurchaseType)
  purchaseType?: PurchaseType;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  /**
   * Amount paid now. Required for PARTIAL (must be > 0 and < total).
   * Ignored for CASH/BANK (full) and CREDIT (zero).
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amountPaid?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  creditDueDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines: PurchaseLineDto[];
}
