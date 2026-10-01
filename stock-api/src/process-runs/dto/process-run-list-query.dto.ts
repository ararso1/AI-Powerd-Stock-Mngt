import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { DateRangeQueryDto } from '../../common/dto/date-range.dto';
import { ProcessRunStatus, PurchaseType } from '../../common/enums';
import { EXPORT_MARKET_STAGES } from '../export-market.stages';
import { LOCAL_MARKET_STAGES } from '../local-market.stages';

const PROCESS_STAGE_FILTER = [
  ...LOCAL_MARKET_STAGES,
  ...EXPORT_MARKET_STAGES.filter(
    (stage) => !LOCAL_MARKET_STAGES.includes(stage as (typeof LOCAL_MARKET_STAGES)[number]),
  ),
  'Packaging & Export Store',
] as const;

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
  @IsIn(PROCESS_STAGE_FILTER)
  stage?: (typeof PROCESS_STAGE_FILTER)[number];

  @IsOptional()
  @IsString()
  search?: string;
}
