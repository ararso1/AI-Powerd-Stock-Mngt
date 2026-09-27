import { MigrationInterface, QueryRunner } from 'typeorm';

export class LotEctaIntake1749068000000 implements MigrationInterface {
  name = 'LotEctaIntake1749068000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lots"
        ADD COLUMN IF NOT EXISTS "ecta_certificate_number" character varying(120),
        ADD COLUMN IF NOT EXISTS "ecta_tested_at" date,
        ADD COLUMN IF NOT EXISTS "ecta_grade" character varying(80),
        ADD COLUMN IF NOT EXISTS "ecta_moisture_percent" numeric(5,2),
        ADD COLUMN IF NOT EXISTS "ecta_cupping_score" numeric(5,2),
        ADD COLUMN IF NOT EXISTS "ecta_notes" text,
        ADD COLUMN IF NOT EXISTS "ecta_document_storage_key" character varying(500),
        ADD COLUMN IF NOT EXISTS "ecta_document_original_name" character varying(255),
        ADD COLUMN IF NOT EXISTS "ecta_document_mime_type" character varying(120)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lots"
        DROP COLUMN IF EXISTS "ecta_document_mime_type",
        DROP COLUMN IF EXISTS "ecta_document_original_name",
        DROP COLUMN IF EXISTS "ecta_document_storage_key",
        DROP COLUMN IF EXISTS "ecta_notes",
        DROP COLUMN IF EXISTS "ecta_cupping_score",
        DROP COLUMN IF EXISTS "ecta_moisture_percent",
        DROP COLUMN IF EXISTS "ecta_grade",
        DROP COLUMN IF EXISTS "ecta_tested_at",
        DROP COLUMN IF EXISTS "ecta_certificate_number"
    `);
  }
}
