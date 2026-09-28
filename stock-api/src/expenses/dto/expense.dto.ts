import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

const COFFEE_MARKETS = ['LOCAL', 'EXPORT'] as const;

export class CreateExpenseCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Null or an empty value clears the coffee market. */
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === 'NONE' ? null : value))
  @IsIn(COFFEE_MARKETS)
  coffeeMarket?: 'LOCAL' | 'EXPORT' | null;
}

export class CreateExpenseDto {
  @IsUUID()
  categoryId: string;

  @IsIn(['CASH', 'BANK'])
  paymentMethod: 'CASH' | 'BANK';

  @IsUUID()
  bankAccountId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  expenseDate: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value == null ? undefined : value,
  )
  @IsIn(COFFEE_MARKETS)
  coffeeMarket?: 'LOCAL' | 'EXPORT';
}
