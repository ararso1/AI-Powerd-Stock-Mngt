import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
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
}
