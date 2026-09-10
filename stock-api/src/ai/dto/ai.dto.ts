import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AiFeedbackDecision,
  AiInsightKind,
  AiInsightStatus,
} from '../../common/enums';

export class AiInsightListQueryDto {
  @IsOptional()
  @IsEnum(AiInsightKind)
  kind?: AiInsightKind;

  @IsOptional()
  @IsEnum(AiInsightStatus)
  status?: AiInsightStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class AiFeedbackDto {
  @IsEnum(AiFeedbackDecision)
  decision: AiFeedbackDecision;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class AiRefreshDto {
  /** When true, also re-seed demo insight cards if missing. */
  @IsOptional()
  @IsIn([true, false])
  includeDemo?: boolean = true;

  /** When true, reopen previously accepted/rejected cards with fresh content. */
  @IsOptional()
  @IsIn([true, false])
  forceReopen?: boolean = true;
}
