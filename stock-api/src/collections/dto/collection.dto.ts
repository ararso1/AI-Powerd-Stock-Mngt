import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../common/enums';

export class CreateCollectionDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()
  locationId: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  weightKg: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerKg: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

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
  @MaxLength(20)
  cropYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  woreda?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  kebele?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  variety?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  lotCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  creditDueDate?: string;
}

export class UpsertCherryPriceDto {
  @IsString()
  @MaxLength(80)
  grade: string;

  @IsString()
  @MaxLength(20)
  cropYear: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerKg: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
