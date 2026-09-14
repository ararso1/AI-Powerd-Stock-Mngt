import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  StockMovementDirection,
  StockMovementSourceType,
} from '../../common/enums';
import { DateRangeQueryDto } from '../../common/dto/date-range.dto';

export class StockMovementListQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsOptional()
  @IsEnum(StockMovementDirection)
  direction?: StockMovementDirection;

  @IsOptional()
  @IsEnum(StockMovementSourceType)
  sourceType?: StockMovementSourceType;

  @IsOptional()
  @IsString()
  search?: string;
}
