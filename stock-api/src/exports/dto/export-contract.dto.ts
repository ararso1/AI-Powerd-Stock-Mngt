import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  ExportContractStatus,
  Incoterm,
} from '../../common/enums';
import { DateRangeQueryDto } from '../../common/dto/date-range.dto';

export class ExportContractListQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsEnum(ExportContractStatus)
  status?: ExportContractStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;
}

export class CreateExportContractDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  contractNumber?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  buyerName: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  volumeKg: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  grade?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerKg: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @IsEnum(Incoterm)
  incoterm?: Incoterm;

  @IsOptional()
  @IsDateString()
  windowStart?: string;

  @IsOptional()
  @IsDateString()
  windowEnd?: string;

  @IsOptional()
  @IsUUID()
  stagingLocationId?: string;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateExportContractDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  buyerName?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  volumeKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  grade?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @IsEnum(Incoterm)
  incoterm?: Incoterm;

  @IsOptional()
  @IsDateString()
  windowStart?: string | null;

  @IsOptional()
  @IsDateString()
  windowEnd?: string | null;

  @IsOptional()
  @IsUUID()
  stagingLocationId?: string | null;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class AllocateExportLotDto {
  @IsUUID()
  lotId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantityKg: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DocCheckItemDto {
  @IsString()
  key: string;

  @IsString()
  label: string;

  @IsBoolean()
  done: boolean;
}

export class UpdateDocChecklistDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DocCheckItemDto)
  docChecklist: DocCheckItemDto[];
}

export class ShipExportContractDto {
  @IsOptional()
  @IsBoolean()
  createSale?: boolean;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fxRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
