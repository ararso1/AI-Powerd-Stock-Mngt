import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod, ReceivingDisposition } from '../../common/enums';

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

  /** Receiving inspection outcome. Default ACCEPTED. */
  @IsOptional()
  @IsEnum(ReceivingDisposition)
  disposition?: ReceivingDisposition;

  /** Accepted kg (defaults to full weight when ACCEPTED). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acceptedWeightKg?: number;

  /** Rejected kg that remains in inventory as REJECT lot. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rejectedWeightKg?: number;

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
  zone?: string;

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
  @MaxLength(80)
  processMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  screenSize?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  cuppingScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  defectLevel?: string;

  @IsOptional()
  @IsString()
  rejectReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  rejectAction?: string;

  @IsOptional()
  @IsUUID()
  rejectDestinationId?: string;

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
