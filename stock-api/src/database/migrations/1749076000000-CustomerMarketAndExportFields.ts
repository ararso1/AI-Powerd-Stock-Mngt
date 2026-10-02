import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerMarketAndExportFields1749076000000
  implements MigrationInterface
{
  name = 'CustomerMarketAndExportFields1749076000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "customers_market_enum" AS ENUM ('LOCAL', 'INTERNATIONAL');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD COLUMN IF NOT EXISTS "market" "customers_market_enum" NOT NULL DEFAULT 'LOCAL',
        ADD COLUMN IF NOT EXISTS "country" character varying(100),
        ADD COLUMN IF NOT EXISTS "destination_port" character varying(200),
        ADD COLUMN IF NOT EXISTS "preferred_incoterm" character varying(10),
        ADD COLUMN IF NOT EXISTS "preferred_currency" character varying(3),
        ADD COLUMN IF NOT EXISTS "trade_license_number" character varying(80),
        ADD COLUMN IF NOT EXISTS "buyer_code" character varying(80)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers"
        DROP COLUMN IF EXISTS "market",
        DROP COLUMN IF EXISTS "country",
        DROP COLUMN IF EXISTS "destination_port",
        DROP COLUMN IF EXISTS "preferred_incoterm",
        DROP COLUMN IF EXISTS "preferred_currency",
        DROP COLUMN IF EXISTS "trade_license_number",
        DROP COLUMN IF EXISTS "buyer_code"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "customers_market_enum"`);
  }
}
