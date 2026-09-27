import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { DateRangeQueryDto } from '../../common/dto/date-range.dto';
import { ProcessRunStatus, PurchaseType } from '../../common/enums';
import { LOCAL_MARKET_STAGES } from '../local-market.stages';

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
  @IsEnum(PurchaseType)
  workflow?: PurchaseType;

  /** Current local-market stage. Completed and cancelled runs are excluded. */
  @IsOptional()
  @IsIn(LOCAL_MARKET_STAGES)
  stage?: (typeof LOCAL_MARKET_STAGES)[number];

  @IsOptional()
  @IsString()
  search?: string;
}
