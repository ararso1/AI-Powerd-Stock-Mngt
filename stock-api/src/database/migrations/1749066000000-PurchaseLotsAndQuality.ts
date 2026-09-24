import { MigrationInterface, QueryRunner } from 'typeorm';

export class PurchaseLotsAndQuality1749066000000 implements MigrationInterface {
  name = 'PurchaseLotsAndQuality1749066000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "purchase_lines"
        ADD COLUMN IF NOT EXISTS "lot_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "purchase_lines"
          ADD CONSTRAINT "FK_purchase_lines_lot"
          FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purchase_lines_lot_id"
        ON "purchase_lines" ("lot_id")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_quality_results" (
        "id" uuid NOT NULL,
        "purchase_id" uuid NOT NULL,
        "purchase_line_id" uuid NOT NULL,
        "lot_id" uuid NOT NULL,
        "lab_name" character varying(200) NOT NULL DEFAULT 'ECTA',
        "tested_at" date,
        "certificate_number" character varying(120),
        "grade" character varying(80),
        "moisture_percent" numeric(5,2),
        "screen_size" character varying(40),
        "cupping_score" numeric(5,2),
        "defect_count" integer,
        "defect_level" character varying(40),
        "passed" boolean,
        "notes" text,
        "document_storage_key" character varying(500),
        "document_original_name" character varying(255),
        "document_mime_type" character varying(120),
        "document_size_bytes" integer,
        "recorded_by_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_purchase_quality_results" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_purchase_quality_line" UNIQUE ("purchase_line_id"),
        CONSTRAINT "FK_pqr_purchase"
          FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pqr_line"
          FOREIGN KEY ("purchase_line_id") REFERENCES "purchase_lines"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pqr_lot"
          FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_pqr_user"
          FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pqr_purchase_id"
        ON "purchase_quality_results" ("purchase_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pqr_lot_id"
        ON "purchase_quality_results" ("lot_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_quality_results"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_lines" DROP CONSTRAINT IF EXISTS "FK_purchase_lines_lot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_lines" DROP COLUMN IF EXISTS "lot_id"`,
    );
  }
}
