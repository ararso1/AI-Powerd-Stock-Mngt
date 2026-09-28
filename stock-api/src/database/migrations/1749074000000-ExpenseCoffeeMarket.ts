import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpenseCoffeeMarket1749074000000 implements MigrationInterface {
  name = 'ExpenseCoffeeMarket1749074000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "expenses"
        ADD COLUMN IF NOT EXISTS "coffee_market" varchar(10)
    `);
    await queryRunner.query(`
      ALTER TABLE "expenses"
        DROP CONSTRAINT IF EXISTS "expenses_coffee_market_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "expenses"
        ADD CONSTRAINT "expenses_coffee_market_check"
        CHECK ("coffee_market" IS NULL OR "coffee_market" IN ('LOCAL', 'EXPORT'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "expenses"
        DROP CONSTRAINT IF EXISTS "expenses_coffee_market_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "expenses"
        DROP COLUMN IF EXISTS "coffee_market"
    `);
  }
}
