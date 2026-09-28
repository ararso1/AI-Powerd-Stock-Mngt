import {
  IsBooleanString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CoffeeForm } from '../../common/enums';
import { ListQueryDto } from '../../common/dto/list-query.dto';

export class InventoryListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsOptional()
  @IsEnum(CoffeeForm)
  form?: CoffeeForm;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cropYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  grade?: string;

  /** When true, only processed/finished coffee and reject stock. */
  @IsOptional()
  @IsBooleanString()
  forSale?: string;

  /** Warehouse coffee group: raw stock, sales-store coffee, or reject. */
  @IsOptional()
  @IsIn(['process', 'sales', 'reject'])
  stockGroup?: 'process' | 'sales' | 'reject';
}
