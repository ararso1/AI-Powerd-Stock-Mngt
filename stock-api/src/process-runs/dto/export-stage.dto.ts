import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExportEctaDto {
  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  certificateNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  moisturePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cuppingScore?: number;

  @IsOptional()
  @IsString()
  testedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ExportDocumentDto {
  @IsString()
  key: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ExportDoniyaLabelDto {
  @IsString()
  businessName: string;

  @IsString()
  location: string;

  @IsString()
  coffeeName: string;

  @IsString()
  origin: string;

  @IsString()
  netWeight: string;

  @IsString()
  certificateNumber: string;

  @IsString()
  icoNumber: string;

  @IsString()
  productionDate: string;

  @IsString()
  expiryDate: string;

  @IsString()
  destination: string;
}

export class SubmitExportStageDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  inputQty: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  removedQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  lossPercent?: number;

  @IsOptional()
  @IsString()
  expectedGrade?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  kgPerDoniya?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  doniyaCount?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExportDoniyaLabelDto)
  doniyaLabel?: ExportDoniyaLabelDto;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExportEctaDto)
  postEcta?: ExportEctaDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportDocumentDto)
  documents?: ExportDocumentDto[];
}

export class UpdateExportDocumentsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ExportEctaDto)
  postEcta?: ExportEctaDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportDocumentDto)
  documents?: ExportDocumentDto[];
}
