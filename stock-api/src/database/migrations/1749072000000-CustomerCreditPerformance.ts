import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerCreditPerformance1749072000000
  implements MigrationInterface
{
  name = 'CustomerCreditPerformance1749072000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD COLUMN IF NOT EXISTS "credit_limit_base" decimal(14,2),
        ADD COLUMN IF NOT EXISTS "last_limit_increase" decimal(14,2),
        ADD COLUMN IF NOT EXISTS "last_limit_increase_percent" integer,
        ADD COLUMN IF NOT EXISTS "last_repayment_days" integer,
        ADD COLUMN IF NOT EXISTS "last_repayment_risk" varchar(40)
    `);
    await queryRunner.query(`
      UPDATE "customers"
      SET "credit_limit_base" = "credit_limit"
      WHERE "credit_limit" IS NOT NULL
        AND "credit_limit_base" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_credits"
        ADD COLUMN IF NOT EXISTS "limit_reward_applied" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "repaid_in_days" integer
    `);
    await queryRunner.query(`
      UPDATE "customer_credits"
      SET "limit_reward_applied" = true
      WHERE "status" = 'PAID'
        AND "limit_reward_applied" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_credits"
        DROP COLUMN IF EXISTS "repaid_in_days",
        DROP COLUMN IF EXISTS "limit_reward_applied"
    `);
    await queryRunner.query(`
      ALTER TABLE "customers"
        DROP COLUMN IF EXISTS "last_repayment_risk",
        DROP COLUMN IF EXISTS "last_repayment_days",
        DROP COLUMN IF EXISTS "last_limit_increase_percent",
        DROP COLUMN IF EXISTS "last_limit_increase",
        DROP COLUMN IF EXISTS "credit_limit_base"
    `);
  }
}
