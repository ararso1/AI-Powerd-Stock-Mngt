import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  ApprovalEntityType,
  ApprovalRequestStatus,
  CoffeeForm,
  EmploymentStatus,
  ExportContractStatus,
  LotStatus,
  ProcessRunStatus,
  PurchaseType,
  ReceivingDisposition,
  SaleChannel,
  TransferStatus,
} from '../common/enums';

export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  soldByUserId?: string;

  /** Filter purchase / process reports by local market vs export. */
  @IsOptional()
  @IsEnum(PurchaseType)
  purchaseType?: PurchaseType;

  /** Sale channel LOCAL | EXPORT */
  @IsOptional()
  @IsEnum(SaleChannel)
  channel?: SaleChannel;

  /** Process workflow LOCAL | EXPORT (same enum values as PurchaseType). */
  @IsOptional()
  @IsEnum(PurchaseType)
  workflow?: PurchaseType;

  /** Generic status filter — validated as known enums where applicable. */
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(LotStatus)
  lotStatus?: LotStatus;

  @IsOptional()
  @IsEnum(TransferStatus)
  transferStatus?: TransferStatus;

  @IsOptional()
  @IsEnum(ExportContractStatus)
  exportStatus?: ExportContractStatus;

  @IsOptional()
  @IsEnum(ProcessRunStatus)
  processStatus?: ProcessRunStatus;

  @IsOptional()
  @IsEnum(ApprovalRequestStatus)
  approvalStatus?: ApprovalRequestStatus;

  @IsOptional()
  @IsEnum(CoffeeForm)
  form?: CoffeeForm;

  @IsOptional()
  @IsEnum(ReceivingDisposition)
  disposition?: ReceivingDisposition;

  @IsOptional()
  @IsEnum(ApprovalEntityType)
  entityType?: ApprovalEntityType;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  /** Market price symbol e.g. KC | RC */
  @IsOptional()
  @IsString()
  symbol?: string;

  /** Stock adjustment direction IN | OUT */
  @IsOptional()
  @IsString()
  direction?: string;

  /** Stock adjustment reason enum value */
  @IsOptional()
  @IsString()
  reason?: string;
}
