import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SupplierType } from '../../common/enums';

export class SupplierBankAccountDto {
  @IsString()
  @MaxLength(120)
  bankName: string;

  @IsString()
  @MaxLength(150)
  accountHolderName: string;

  @IsString()
  @MaxLength(80)
  accountNumber: string;
}

export class CreateSupplierDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsEnum(SupplierType)
  supplierType?: SupplierType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  alternatePhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

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
  @MaxLength(200)
  organizationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tinNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenseNumber?: string;

  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SupplierBankAccountDto)
  bankAccounts?: SupplierBankAccountDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEnum(SupplierType)
  supplierType?: SupplierType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactPerson?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  alternatePhone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  zone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  woreda?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  kebele?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  organizationName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tinNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenseNumber?: string | null;

  @IsOptional()
  @IsDateString()
  licenseExpiry?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SupplierBankAccountDto)
  bankAccounts?: SupplierBankAccountDto[];

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
