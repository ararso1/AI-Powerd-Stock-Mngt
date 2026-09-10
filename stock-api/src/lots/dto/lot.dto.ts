import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CoffeeForm, LotStatus } from '../../common/enums';

const APPENDABLE_EVENT_TYPES = [
  'COLLECTED',
  'TRANSFERRED',
  'PROCESS_STARTED',
  'PROCESS_COMPLETED',
  'QC_HELD',
  'QC_RELEASED',
  'ADJUSTED',
  'ROASTED',
  'PACKAGED',
  'SOLD_LOCAL',
  'ALLOCATED_EXPORT',
  'SHIPPED',
] as const;

export class CreateLotDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsEnum(CoffeeForm)
  form?: CoffeeForm;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cropYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  variety?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  processMethod?: string;

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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  moisturePercent?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLotDto {
  @IsOptional()
  @IsUUID()
  itemId?: string | null;

  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  @IsOptional()
  @IsEnum(CoffeeForm)
  form?: CoffeeForm;

  @IsOptional()
  @IsEnum(LotStatus)
  status?: LotStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  grade?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cropYear?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  variety?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  processMethod?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  woreda?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  kebele?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  moisturePercent?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class SplitLotDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  newCode?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class MergeLotsDto {
  @IsUUID()
  sourceLotId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  notes?: string;
}

export class AppendLotEventDto {
  @IsIn(APPENDABLE_EVENT_TYPES)
  eventType: (typeof APPENDABLE_EVENT_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @IsOptional()
  @IsUUID()
  toLocationId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
