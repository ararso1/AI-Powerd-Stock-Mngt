import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollectionTickets1748950000000 implements MigrationInterface {
  name = 'CollectionTickets1748950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "collection_tickets_payment_method_enum" AS ENUM ('CASH', 'BANK', 'CREDIT');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "collection_tickets_status_enum" AS ENUM ('ACTIVE', 'VOIDED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cherry_prices" (
        "id" uuid NOT NULL,
        "grade" character varying(80) NOT NULL,
        "crop_year" character varying(20) NOT NULL,
        "price_per_kg" numeric(14,2) NOT NULL,
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cherry_prices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cherry_prices_grade_season" UNIQUE ("grade", "crop_year")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "collection_tickets" (
        "id" uuid NOT NULL,
        "ticket_number" character varying(40) NOT NULL,
        "supplier_id" uuid NOT NULL,
        "location_id" uuid NOT NULL,
        "item_id" uuid NOT NULL,
        "lot_id" uuid NOT NULL,
        "purchase_id" uuid,
        "weight_kg" numeric(14,3) NOT NULL,
        "grade" character varying(80),
        "price_per_kg" numeric(14,2) NOT NULL,
        "total_amount" numeric(14,2) NOT NULL,
        "payment_method" "collection_tickets_payment_method_enum" NOT NULL,
        "bank_account_id" uuid,
        "moisture_percent" numeric(5,2),
        "crop_year" character varying(20),
        "region" character varying(120),
        "woreda" character varying(120),
        "kebele" character varying(120),
        "variety" character varying(80),
        "notes" text,
        "status" "collection_tickets_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_by_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_collection_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_collection_tickets_number" UNIQUE ("ticket_number"),
        CONSTRAINT "FK_collection_tickets_supplier" FOREIGN KEY ("supplier_id")
          REFERENCES "suppliers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_collection_tickets_location" FOREIGN KEY ("location_id")
          REFERENCES "locations"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_collection_tickets_item" FOREIGN KEY ("item_id")
          REFERENCES "items"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_collection_tickets_lot" FOREIGN KEY ("lot_id")
          REFERENCES "lots"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_collection_tickets_purchase" FOREIGN KEY ("purchase_id")
          REFERENCES "purchases"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_collection_tickets_bank" FOREIGN KEY ("bank_account_id")
          REFERENCES "bank_accounts"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_collection_tickets_user" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collection_tickets_created"
      ON "collection_tickets" ("created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collection_tickets_supplier"
      ON "collection_tickets" ("supplier_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "collection_tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cherry_prices"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "collection_tickets_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "collection_tickets_payment_method_enum"`,
    );
  }
}
