import { MigrationInterface, QueryRunner } from 'typeorm';

export class CoffeeProcurementGrading1749000000000
  implements MigrationInterface
{
  name = 'CoffeeProcurementGrading1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "lots_qc_phase_enum" AS ENUM (
          'RECEIVED',
          'SAMPLE_TESTED',
          'GRADED',
          'ACCEPTED',
          'REJECTED',
          'PROCESSED',
          'FINAL_GRADE'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "collection_tickets_disposition_enum" AS ENUM (
          'ACCEPTED', 'PARTIAL', 'REJECTED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "lot_events_event_type_enum" ADD VALUE IF NOT EXISTS 'SAMPLE_TESTED';
      EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "lot_events_event_type_enum" ADD VALUE IF NOT EXISTS 'GRADED';
      EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "lot_events_event_type_enum" ADD VALUE IF NOT EXISTS 'RECEIVING_ACCEPTED';
      EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "lot_events_event_type_enum" ADD VALUE IF NOT EXISTS 'RECEIVING_REJECTED';
      EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "lot_events_event_type_enum" ADD VALUE IF NOT EXISTS 'FINAL_GRADED';
      EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "lots"
        ADD COLUMN IF NOT EXISTS "zone" character varying(120),
        ADD COLUMN IF NOT EXISTS "screen_size" character varying(40),
        ADD COLUMN IF NOT EXISTS "cupping_score" numeric(5,2),
        ADD COLUMN IF NOT EXISTS "defect_count" int,
        ADD COLUMN IF NOT EXISTS "defect_level" character varying(40),
        ADD COLUMN IF NOT EXISTS "qc_phase" "lots_qc_phase_enum" NOT NULL DEFAULT 'RECEIVED',
        ADD COLUMN IF NOT EXISTS "inspector_id" uuid,
        ADD COLUMN IF NOT EXISTS "inspected_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "reject_reason" text,
        ADD COLUMN IF NOT EXISTS "reject_percent" numeric(6,2),
        ADD COLUMN IF NOT EXISTS "reject_action" character varying(120)
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "lots"
          ADD CONSTRAINT "FK_lots_inspector"
          FOREIGN KEY ("inspector_id") REFERENCES "users"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "collection_tickets"
        ADD COLUMN IF NOT EXISTS "disposition" "collection_tickets_disposition_enum" NOT NULL DEFAULT 'ACCEPTED',
        ADD COLUMN IF NOT EXISTS "accepted_weight_kg" numeric(14,3),
        ADD COLUMN IF NOT EXISTS "rejected_weight_kg" numeric(14,3) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "reject_lot_id" uuid,
        ADD COLUMN IF NOT EXISTS "inspector_id" uuid,
        ADD COLUMN IF NOT EXISTS "inspected_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "reject_reason" text,
        ADD COLUMN IF NOT EXISTS "reject_percent" numeric(6,2),
        ADD COLUMN IF NOT EXISTS "reject_action" character varying(120),
        ADD COLUMN IF NOT EXISTS "reject_destination_id" uuid,
        ADD COLUMN IF NOT EXISTS "process_method" character varying(80),
        ADD COLUMN IF NOT EXISTS "screen_size" character varying(40),
        ADD COLUMN IF NOT EXISTS "cupping_score" numeric(5,2),
        ADD COLUMN IF NOT EXISTS "defect_level" character varying(40),
        ADD COLUMN IF NOT EXISTS "zone" character varying(120)
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "collection_tickets"
          ADD CONSTRAINT "FK_collection_tickets_reject_lot"
          FOREIGN KEY ("reject_lot_id") REFERENCES "lots"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "collection_tickets"
          ADD CONSTRAINT "FK_collection_tickets_inspector"
          FOREIGN KEY ("inspector_id") REFERENCES "users"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "collection_tickets"
          ADD CONSTRAINT "FK_collection_tickets_reject_destination"
          FOREIGN KEY ("reject_destination_id") REFERENCES "locations"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lots_qc_phase" ON "lots" ("qc_phase")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lots_form_qc" ON "lots" ("form", "qc_phase")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collection_tickets" DROP CONSTRAINT IF EXISTS "FK_collection_tickets_reject_destination"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_tickets" DROP CONSTRAINT IF EXISTS "FK_collection_tickets_inspector"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_tickets" DROP CONSTRAINT IF EXISTS "FK_collection_tickets_reject_lot"`,
    );
    await queryRunner.query(`
      ALTER TABLE "collection_tickets"
        DROP COLUMN IF EXISTS "disposition",
        DROP COLUMN IF EXISTS "accepted_weight_kg",
        DROP COLUMN IF EXISTS "rejected_weight_kg",
        DROP COLUMN IF EXISTS "reject_lot_id",
        DROP COLUMN IF EXISTS "inspector_id",
        DROP COLUMN IF EXISTS "inspected_at",
        DROP COLUMN IF EXISTS "reject_reason",
        DROP COLUMN IF EXISTS "reject_percent",
        DROP COLUMN IF EXISTS "reject_action",
        DROP COLUMN IF EXISTS "reject_destination_id",
        DROP COLUMN IF EXISTS "process_method",
        DROP COLUMN IF EXISTS "screen_size",
        DROP COLUMN IF EXISTS "cupping_score",
        DROP COLUMN IF EXISTS "defect_level",
        DROP COLUMN IF EXISTS "zone"
    `);
    await queryRunner.query(
      `ALTER TABLE "lots" DROP CONSTRAINT IF EXISTS "FK_lots_inspector"`,
    );
    await queryRunner.query(`
      ALTER TABLE "lots"
        DROP COLUMN IF EXISTS "zone",
        DROP COLUMN IF EXISTS "screen_size",
        DROP COLUMN IF EXISTS "cupping_score",
        DROP COLUMN IF EXISTS "defect_count",
        DROP COLUMN IF EXISTS "defect_level",
        DROP COLUMN IF EXISTS "qc_phase",
        DROP COLUMN IF EXISTS "inspector_id",
        DROP COLUMN IF EXISTS "inspected_at",
        DROP COLUMN IF EXISTS "reject_reason",
        DROP COLUMN IF EXISTS "reject_percent",
        DROP COLUMN IF EXISTS "reject_action"
    `);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "collection_tickets_disposition_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "lots_qc_phase_enum"`);
  }
}
