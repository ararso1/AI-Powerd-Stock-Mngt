import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DateRangeQueryDto } from '../../common/dto/date-range.dto';
import { CoffeeForm, LotStatus } from '../../common/enums';

export class LotListQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsEnum(CoffeeForm)
  form?: CoffeeForm;

  @IsOptional()
  @IsEnum(LotStatus)
  status?: LotStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  cropYear?: string;

  @IsOptional()
  @IsString()
  grade?: string;
}
