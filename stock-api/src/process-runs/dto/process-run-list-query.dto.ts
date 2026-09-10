import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DateRangeQueryDto } from '../../common/dto/date-range.dto';
import { ProcessRunStatus } from '../../common/enums';

export class ProcessRunListQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsEnum(ProcessRunStatus)
  status?: ProcessRunStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
