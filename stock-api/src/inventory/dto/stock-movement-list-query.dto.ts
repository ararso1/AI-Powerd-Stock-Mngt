import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  PurchaseType,
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

  /** When set with PURCHASE movements, filters by linked purchase type. */
  @IsOptional()
  @IsEnum(PurchaseType)
  purchaseType?: PurchaseType;

  @IsOptional()
  @IsString()
  search?: string;
}
