import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../common/enums';
import { resolveLineItemIdFromPayload } from '../../common/utils/line-item-id.util';

/** Manual ECTA / buyer lab results entered with a purchase line. */
export class PurchaseLineQualityDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  labName?: string;

  @IsOptional()
  @IsDateString()
  testedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  certificateNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  grade?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  moisturePercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  screenSize?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cuppingScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defectCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  defectLevel?: string;

  @IsOptional()
  @IsBoolean()
  passed?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

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

export class UpsertPurchaseQualityDto extends PurchaseLineQualityDto {}
