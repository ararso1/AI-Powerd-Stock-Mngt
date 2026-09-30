import { MigrationInterface, QueryRunner } from 'typeorm';

export class SaleReturnRefundDate1749075000000 implements MigrationInterface {
  name = 'SaleReturnRefundDate1749075000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sale_returns"
        ADD COLUMN IF NOT EXISTS "refunded_at" date
    `);
    await queryRunner.query(`
      UPDATE "sale_returns"
      SET "refunded_at" = "created_at"::date
      WHERE "refunded_at" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "sale_returns"
        ALTER COLUMN "refunded_at" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sale_returns"
        DROP COLUMN IF EXISTS "refunded_at"
    `);
  }
}
