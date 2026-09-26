import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaymentMethod, PurchaseType } from '../../common/enums';
import { DocumentListQueryDto } from '../../common/dto/document-list-query.dto';

export class PurchaseListQueryDto extends DocumentListQueryDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(PurchaseType)
  purchaseType?: PurchaseType;
}
