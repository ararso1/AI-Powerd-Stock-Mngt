import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class LocalPackLineDto {
  @Type(() => Number)
  @IsIn([1, 0.5])
  sizeKg: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  count: number;

  @IsOptional()
  @IsIn(['ROAST', 'GROUND'])
  kind?: 'ROAST' | 'GROUND';
}

export class SubmitLocalStageDto {
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
  roastQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  groundQty?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocalPackLineDto)
  packs?: LocalPackLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
