import { MigrationInterface, QueryRunner } from 'typeorm';

export class LotsAndLotEvents1748940000000 implements MigrationInterface {
  name = 'LotsAndLotEvents1748940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of [
      'COLLECTION_CENTER',
      'WET_MILL',
      'DRY_MILL',
      'ROASTERY',
      'EXPORT_STAGING',
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TYPE "locations_type_enum" ADD VALUE IF NOT EXISTS '${value}';
        EXCEPTION
          WHEN undefined_object THEN NULL;
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "lots_form_enum" AS ENUM (
          'CHERRY', 'PARCHMENT', 'GREEN', 'ROASTED', 'PACKAGED', 'REJECT'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "lots_status_enum" AS ENUM ('ACTIVE', 'HOLD', 'VOIDED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "lot_events_event_type_enum" AS ENUM (
          'CREATED', 'COLLECTED', 'TRANSFERRED', 'PROCESS_STARTED',
          'PROCESS_COMPLETED', 'QC_HELD', 'QC_RELEASED', 'ADJUSTED',
          'SPLIT', 'MERGED', 'ROASTED', 'PACKAGED', 'SOLD_LOCAL',
          'ALLOCATED_EXPORT', 'SHIPPED', 'VOIDED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lots" (
        "id" uuid NOT NULL,
        "code" character varying(40) NOT NULL,
        "item_id" uuid,
        "location_id" uuid,
        "form" "lots_form_enum" NOT NULL DEFAULT 'GREEN',
        "grade" character varying(80),
        "crop_year" character varying(20),
        "variety" character varying(80),
        "process_method" character varying(80),
        "region" character varying(120),
        "woreda" character varying(120),
        "kebele" character varying(120),
        "moisture_percent" numeric(5,2),
        "quantity" numeric(14,3) NOT NULL DEFAULT 0,
        "status" "lots_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "parent_lot_id" uuid,
        "notes" text,
        "created_by_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lots" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lots_code" UNIQUE ("code"),
        CONSTRAINT "FK_lots_item" FOREIGN KEY ("item_id")
          REFERENCES "items"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_lots_location" FOREIGN KEY ("location_id")
          REFERENCES "locations"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_lots_parent" FOREIGN KEY ("parent_lot_id")
          REFERENCES "lots"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_lots_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lot_events" (
        "id" uuid NOT NULL,
        "lot_id" uuid NOT NULL,
        "event_type" "lot_events_event_type_enum" NOT NULL,
        "quantity" numeric(14,3),
        "from_location_id" uuid,
        "to_location_id" uuid,
        "related_lot_id" uuid,
        "notes" text,
        "metadata" jsonb,
        "created_by_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lot_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lot_events_lot" FOREIGN KEY ("lot_id")
          REFERENCES "lots"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lot_events_from_location" FOREIGN KEY ("from_location_id")
          REFERENCES "locations"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_lot_events_to_location" FOREIGN KEY ("to_location_id")
          REFERENCES "locations"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_lot_events_related_lot" FOREIGN KEY ("related_lot_id")
          REFERENCES "lots"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_lot_events_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lot_events_lot_created"
      ON "lot_events" ("lot_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lots_location_status"
      ON "lots" ("location_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lot_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lots"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "lot_events_event_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "lots_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "lots_form_enum"`);
  }
}
