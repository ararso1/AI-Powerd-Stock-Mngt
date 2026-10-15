import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideApprovalDto {
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
