import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../common/enums';

export class CreateSaleReturnLineDto {
  @IsUUID()
  saleLineId: string;

  @IsUUID()
  itemId: string;

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
}

export class CreateSaleReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleReturnLineDto)
  lines: CreateSaleReturnLineDto[];

  @IsIn([PaymentMethod.CASH, PaymentMethod.BANK])
  refundMethod: PaymentMethod.CASH | PaymentMethod.BANK;

  /** Required when the refund is a bank transfer. */
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsDateString()
  refundDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
