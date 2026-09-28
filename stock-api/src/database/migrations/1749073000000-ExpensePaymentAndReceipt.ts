import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpensePaymentAndReceipt1749073000000
  implements MigrationInterface
{
  name = 'ExpensePaymentAndReceipt1749073000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "expenses"
        ADD COLUMN IF NOT EXISTS "payment_method" varchar(10) NOT NULL DEFAULT 'BANK',
        ADD COLUMN IF NOT EXISTS "receipt_original_name" varchar(255),
        ADD COLUMN IF NOT EXISTS "receipt_mime_type" varchar(120),
        ADD COLUMN IF NOT EXISTS "receipt_storage_key" varchar(400)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "expenses"
        DROP COLUMN IF EXISTS "receipt_storage_key",
        DROP COLUMN IF EXISTS "receipt_mime_type",
        DROP COLUMN IF EXISTS "receipt_original_name",
        DROP COLUMN IF EXISTS "payment_method"
    `);
  }
}
