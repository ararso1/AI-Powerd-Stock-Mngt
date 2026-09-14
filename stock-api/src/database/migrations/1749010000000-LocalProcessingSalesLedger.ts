import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocalProcessingSalesLedger1749010000000
  implements MigrationInterface
{
  name = 'LocalProcessingSalesLedger1749010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Coffee form FLOUR
    for (const typeName of [
      'lots_form_enum',
      'process_templates_input_form_enum',
      'process_templates_output_form_enum',
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS 'FLOUR';
        EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END $$;
      `);
    }

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "lot_events_event_type_enum" ADD VALUE IF NOT EXISTS 'SALE_RETURNED';
        ALTER TYPE "lot_events_event_type_enum" ADD VALUE IF NOT EXISTS 'PRODUCTION_LOSS';
      EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "process_templates_operation_type_enum" AS ENUM (
          'MILL', 'FLOUR', 'ROAST', 'PACK', 'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "process_templates"
        ADD COLUMN IF NOT EXISTS "operation_type" "process_templates_operation_type_enum" NOT NULL DEFAULT 'OTHER',
        ADD COLUMN IF NOT EXISTS "pack_size_kg" numeric(14,3)
    `);

    await queryRunner.query(`
      ALTER TABLE "process_runs"
        ADD COLUMN IF NOT EXISTS "quantity_loss" numeric(14,3) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "pack_count" numeric(14,3)
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "customers_customer_type_enum" AS ENUM (
          'RETAIL', 'WHOLESALE', 'CAFE', 'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD COLUMN IF NOT EXISTS "customer_type" "customers_customer_type_enum" NOT NULL DEFAULT 'RETAIL'
    `);

    await queryRunner.query(`
      ALTER TABLE "sales"
        ADD COLUMN IF NOT EXISTS "invoice_number" character varying(40),
        ADD COLUMN IF NOT EXISTS "paid_amount" numeric(14,2) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      UPDATE "sales" SET "invoice_number" = 'INV-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 10))
      WHERE "invoice_number" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "sales" SET "paid_amount" = CASE
        WHEN "paymentMethod"::text = 'CREDIT' THEN 0
        ELSE "total"
      END
      WHERE "paid_amount" = 0
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "stock_movements_direction_enum" AS ENUM ('IN', 'OUT');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "stock_movements_source_type_enum" AS ENUM (
          'PURCHASE',
          'COLLECTION',
          'PRODUCTION_OUTPUT',
          'PRODUCTION_CONSUMPTION',
          'PRODUCTION_LOSS',
          'TRANSFER_IN',
          'TRANSFER_OUT',
          'SALE_LOCAL',
          'SALE_EXPORT',
          'SALE_RETURN',
          'EXPORT_SHIPMENT',
          'REJECTION',
          'DAMAGE',
          'WASTAGE',
          'RETURN_SUPPLIER',
          'ADJUSTMENT',
          'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_movements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "moved_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "direction" "stock_movements_direction_enum" NOT NULL,
        "source_type" "stock_movements_source_type_enum" NOT NULL DEFAULT 'OTHER',
        "item_id" uuid NOT NULL REFERENCES "items"("id"),
        "lot_id" uuid REFERENCES "lots"("id") ON DELETE SET NULL,
        "location_id" uuid NOT NULL REFERENCES "locations"("id"),
        "quantity" numeric(14,3) NOT NULL,
        "grade" character varying(80),
        "batch_code" character varying(40),
        "reference_type" character varying(60),
        "reference_id" uuid,
        "reference" character varying(120),
        "notes" text,
        "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_moved_at"
        ON "stock_movements" ("moved_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_item_lot"
        ON "stock_movements" ("item_id", "lot_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_location"
        ON "stock_movements" ("location_id", "moved_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_source"
        ON "stock_movements" ("source_type", "moved_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_returns" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "return_number" character varying(40) NOT NULL,
        "sale_id" uuid NOT NULL REFERENCES "sales"("id"),
        "location_id" uuid NOT NULL REFERENCES "locations"("id"),
        "total_amount" numeric(14,2) NOT NULL DEFAULT 0,
        "refund_method" character varying(20) NOT NULL,
        "bank_account_id" uuid REFERENCES "bank_accounts"("id") ON DELETE SET NULL,
        "notes" text,
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sale_returns_return_number"
        ON "sale_returns" ("return_number")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_return_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sale_return_id" uuid NOT NULL REFERENCES "sale_returns"("id") ON DELETE CASCADE,
        "sale_line_id" uuid REFERENCES "sale_lines"("id") ON DELETE SET NULL,
        "item_id" uuid NOT NULL REFERENCES "items"("id"),
        "lot_id" uuid REFERENCES "lots"("id") ON DELETE SET NULL,
        "quantity" numeric(14,3) NOT NULL,
        "unit_price" numeric(14,2) NOT NULL,
        "line_total" numeric(14,2) NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_return_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_returns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "stock_movements_source_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "stock_movements_direction_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP COLUMN IF EXISTS "paid_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP COLUMN IF EXISTS "invoice_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "customer_type"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "customers_customer_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "process_runs" DROP COLUMN IF EXISTS "pack_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "process_runs" DROP COLUMN IF EXISTS "quantity_loss"`,
    );
    await queryRunner.query(
      `ALTER TABLE "process_templates" DROP COLUMN IF EXISTS "pack_size_kg"`,
    );
    await queryRunner.query(
      `ALTER TABLE "process_templates" DROP COLUMN IF EXISTS "operation_type"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "process_templates_operation_type_enum"`,
    );
  }
}
