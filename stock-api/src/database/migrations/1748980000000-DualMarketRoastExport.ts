import { MigrationInterface, QueryRunner } from 'typeorm';

export class DualMarketRoastExport1748980000000 implements MigrationInterface {
  name = 'DualMarketRoastExport1748980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "sales_channel_enum" AS ENUM ('LOCAL', 'EXPORT');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "export_contracts_status_enum" AS ENUM (
          'DRAFT', 'ALLOCATED', 'STAGED', 'SHIPPED', 'CLOSED', 'CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "export_contracts_incoterm_enum" AS ENUM (
          'FOB', 'CIF', 'CFR', 'EXW', 'FCA', 'DAP'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'FRESHNESS';
      EXCEPTION
        WHEN undefined_object THEN NULL;
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roast_profiles" (
        "id" uuid NOT NULL,
        "code" character varying(40) NOT NULL,
        "name" character varying(120) NOT NULL,
        "roast_level" character varying(40),
        "target_agtron" int,
        "duration_minutes" int,
        "blend_notes" text,
        "shelf_life_days" int NOT NULL DEFAULT 90,
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roast_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_roast_profiles_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "lots"
        ADD COLUMN IF NOT EXISTS "roast_date" date,
        ADD COLUMN IF NOT EXISTS "best_before" date,
        ADD COLUMN IF NOT EXISTS "roast_profile_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "lots"
          ADD CONSTRAINT "FK_lots_roast_profile"
          FOREIGN KEY ("roast_profile_id") REFERENCES "roast_profiles"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "process_runs"
        ADD COLUMN IF NOT EXISTS "roast_profile_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "process_runs"
          ADD CONSTRAINT "FK_process_runs_roast_profile"
          FOREIGN KEY ("roast_profile_id") REFERENCES "roast_profiles"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "bank_accounts"
        ADD COLUMN IF NOT EXISTS "currency_code" character varying(3)
        NOT NULL DEFAULT 'ETB'
    `);

    await queryRunner.query(`
      ALTER TABLE "sales"
        ADD COLUMN IF NOT EXISTS "channel" "sales_channel_enum"
          NOT NULL DEFAULT 'LOCAL',
        ADD COLUMN IF NOT EXISTS "currency_code" character varying(3)
          NOT NULL DEFAULT 'ETB',
        ADD COLUMN IF NOT EXISTS "fx_rate" numeric(14,6),
        ADD COLUMN IF NOT EXISTS "export_contract_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "sale_lines"
        ADD COLUMN IF NOT EXISTS "lot_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "sale_lines"
          ADD CONSTRAINT "FK_sale_lines_lot"
          FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "export_contracts" (
        "id" uuid NOT NULL,
        "contract_number" character varying(40) NOT NULL,
        "buyer_name" character varying(200) NOT NULL,
        "customer_id" uuid,
        "volume_kg" numeric(14,3) NOT NULL,
        "grade" character varying(80),
        "price_per_kg" numeric(14,4) NOT NULL,
        "currency_code" character varying(3) NOT NULL DEFAULT 'USD',
        "incoterm" "export_contracts_incoterm_enum" NOT NULL DEFAULT 'FOB',
        "window_start" date,
        "window_end" date,
        "status" "export_contracts_status_enum" NOT NULL DEFAULT 'DRAFT',
        "allocated_kg" numeric(14,3) NOT NULL DEFAULT 0,
        "shipped_kg" numeric(14,3) NOT NULL DEFAULT 0,
        "staging_location_id" uuid,
        "sale_id" uuid,
        "bank_account_id" uuid,
        "packing_list" jsonb NOT NULL DEFAULT '[]',
        "doc_checklist" jsonb NOT NULL DEFAULT '[]',
        "notes" text,
        "shipped_at" TIMESTAMPTZ,
        "created_by_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_export_contracts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_export_contracts_number" UNIQUE ("contract_number"),
        CONSTRAINT "FK_export_contracts_customer"
          FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_export_contracts_staging"
          FOREIGN KEY ("staging_location_id") REFERENCES "locations"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_export_contracts_sale"
          FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_export_contracts_bank"
          FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_export_contracts_user"
          FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "sales"
          ADD CONSTRAINT "FK_sales_export_contract"
          FOREIGN KEY ("export_contract_id") REFERENCES "export_contracts"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "export_allocations" (
        "id" uuid NOT NULL,
        "contract_id" uuid NOT NULL,
        "lot_id" uuid NOT NULL,
        "quantity_kg" numeric(14,3) NOT NULL,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_export_allocations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_export_allocations_contract"
          FOREIGN KEY ("contract_id") REFERENCES "export_contracts"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_export_allocations_lot"
          FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "export_allocations"`);
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "FK_sales_export_contract"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "export_contracts"`);
    await queryRunner.query(
      `ALTER TABLE "sale_lines" DROP CONSTRAINT IF EXISTS "FK_sale_lines_lot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_lines" DROP COLUMN IF EXISTS "lot_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP COLUMN IF EXISTS "export_contract_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP COLUMN IF EXISTS "fx_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP COLUMN IF EXISTS "currency_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP COLUMN IF EXISTS "channel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_accounts" DROP COLUMN IF EXISTS "currency_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "process_runs" DROP CONSTRAINT IF EXISTS "FK_process_runs_roast_profile"`,
    );
    await queryRunner.query(
      `ALTER TABLE "process_runs" DROP COLUMN IF EXISTS "roast_profile_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lots" DROP CONSTRAINT IF EXISTS "FK_lots_roast_profile"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lots" DROP COLUMN IF EXISTS "roast_profile_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lots" DROP COLUMN IF EXISTS "best_before"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lots" DROP COLUMN IF EXISTS "roast_date"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "roast_profiles"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "export_contracts_incoterm_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "export_contracts_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "sales_channel_enum"`);
  }
}
