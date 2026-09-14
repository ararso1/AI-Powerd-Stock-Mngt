import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { CreditStatus } from '../../common/enums';
import { DateRangeQueryDto } from '../../common/dto/date-range.dto';

function toBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

export class CreditListQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsEnum(CreditStatus)
  status?: CreditStatus;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  /** Open/partial credits with dueDate before today. */
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  overdue?: boolean;
}
