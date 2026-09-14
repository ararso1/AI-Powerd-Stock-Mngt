import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreditDeskEnhancements1749020000000 implements MigrationInterface {
  name = 'CreditDeskEnhancements1749020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD COLUMN IF NOT EXISTS "credit_limit" numeric(14,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "suppliers"
        ADD COLUMN IF NOT EXISTS "credit_limit" numeric(14,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "purchases"
        ADD COLUMN IF NOT EXISTS "paid_amount" numeric(14,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      UPDATE "purchases" SET "paid_amount" = CASE
        WHEN "paymentMethod"::text = 'CREDIT' THEN 0
        ELSE "total"
      END
      WHERE "paid_amount" = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchases" DROP COLUMN IF EXISTS "paid_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "credit_limit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "credit_limit"`,
    );
  }
}
