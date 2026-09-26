import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

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
  @Type(() => Boolean)
  @IsBoolean()
  passed?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpsertPurchaseQualityDto extends PurchaseLineQualityDto {}
