import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CoffeeForm,
  ProcessOperationType,
  PurchaseType,
} from '../../common/enums';

export class CreateProcessTemplateDto {
  @IsString()
  @MaxLength(40)
  code: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsEnum(CoffeeForm)
  inputForm: CoffeeForm;

  @IsEnum(CoffeeForm)
  outputForm: CoffeeForm;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  expectedYieldPercent: number;

  @IsOptional()
  @IsBoolean()
  requiresQc?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stages?: string[];

  @IsOptional()
  @IsUUID()
  inputItemId?: string;

  @IsOptional()
  @IsUUID()
  outputItemId?: string;

  @IsOptional()
  @IsEnum(ProcessOperationType)
  operationType?: ProcessOperationType;

  @IsOptional()
  @IsEnum(PurchaseType)
  workflow?: PurchaseType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  packSizeKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxMoisturePercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProcessRunInputDto {
  @IsUUID()
  lotId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class CreateProcessRunDto {
  @IsUUID()
  templateId: string;

  @IsOptional()
  @IsUUID()
  inputLotId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessRunInputDto)
  inputs?: ProcessRunInputDto[];

  @IsUUID()
  locationId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantityInput?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  processCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  roastProfileId?: string;
}

export class SubmitQcDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  moisturePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defectCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cuppingScore?: number;

  @IsBoolean()
  passed: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteProcessRunDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantityOutput: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantityReject?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  outputLotCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  outputGrade?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  moisturePercent?: number;

  @IsOptional()
  @IsDateString()
  roastDate?: string;

  @IsOptional()
  @IsDateString()
  bestBefore?: string;

  @IsOptional()
  @IsUUID()
  roastProfileId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
