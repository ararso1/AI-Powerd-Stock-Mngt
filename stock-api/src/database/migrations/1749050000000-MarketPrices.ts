import { MigrationInterface, QueryRunner } from 'typeorm';

export class MarketPrices1749050000000 implements MigrationInterface {
  name = 'MarketPrices1749050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "market_prices" (
        "id" uuid NOT NULL,
        "symbol" varchar(8) NOT NULL,
        "price_date" date NOT NULL,
        "native_price" numeric(18,6) NOT NULL,
        "native_unit" varchar(32) NOT NULL,
        "usd_per_kg" numeric(18,6) NOT NULL,
        "open_price" numeric(18,6),
        "high_price" numeric(18,6),
        "low_price" numeric(18,6),
        "close_price" numeric(18,6),
        "source" varchar(64) NOT NULL DEFAULT 'yahoo',
        "currency_code" varchar(8) NOT NULL DEFAULT 'USD',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_market_prices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_market_prices_symbol_date" UNIQUE ("symbol", "price_date")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_market_prices_symbol_date"
      ON "market_prices" ("symbol", "price_date")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "market_fx_rates" (
        "id" uuid NOT NULL,
        "base_currency" varchar(8) NOT NULL DEFAULT 'USD',
        "quote_currency" varchar(8) NOT NULL DEFAULT 'ETB',
        "rate_date" date NOT NULL,
        "rate" numeric(18,6) NOT NULL,
        "source" varchar(64) NOT NULL DEFAULT 'open.er-api.com',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_market_fx_rates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_market_fx_base_quote_date" UNIQUE ("base_currency", "quote_currency", "rate_date")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "market_grade_basis" (
        "id" uuid NOT NULL,
        "grade" varchar(32) NOT NULL,
        "coffee_type" varchar(16) NOT NULL,
        "differential_usd_per_kg" numeric(14,6) NOT NULL DEFAULT 0,
        "note" varchar(255),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_market_grade_basis" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_market_grade_basis_grade_type" UNIQUE ("grade", "coffee_type")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "ai_insights_kind_enum" ADD VALUE IF NOT EXISTS 'MARKET_ALERT';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "market_grade_basis"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "market_fx_rates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "market_prices"`);
  }
}
