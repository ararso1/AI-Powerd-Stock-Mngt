import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../common/enums';

export class CreateSaleReturnLineDto {
  @IsOptional()
  @IsUUID()
  saleLineId?: string;

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

  @IsEnum(PaymentMethod)
  refundMethod: PaymentMethod;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
