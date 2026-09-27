import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProcessWorkflowMarket1749069000000 implements MigrationInterface {
  name = 'ProcessWorkflowMarket1749069000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "process_workflow_enum" AS ENUM ('LOCAL', 'EXPORT');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "process_templates"
        ADD COLUMN IF NOT EXISTS "workflow" "process_workflow_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "process_runs"
        ADD COLUMN IF NOT EXISTS "workflow" "process_workflow_enum",
        ADD COLUMN IF NOT EXISTS "purchase_id" uuid,
        ADD COLUMN IF NOT EXISTS "purchase_line_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "process_runs"
          ADD CONSTRAINT "FK_process_runs_purchase"
          FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_process_runs_purchase"
      ON "process_runs" ("purchase_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_process_runs_workflow"
      ON "process_runs" ("workflow")
    `);

    await queryRunner.query(`
      INSERT INTO "process_templates" (
        "id", "code", "name", "input_form", "output_form", "operation_type",
        "expected_yield_percent", "requires_qc", "stages", "workflow",
        "notes", "is_active"
      )
      SELECT
        '7c4e8a21-6b3d-4f1a-9e20-1d5c8a0b3f11',
        'LOCAL-MARKET',
        'Local market processing',
        'GREEN',
        'GREEN',
        'OTHER',
        100.00,
        false,
        '[]'::jsonb,
        'LOCAL',
        'Coffee purchased for the local market. Processing steps are defined on this workflow.',
        true
      WHERE NOT EXISTS (
        SELECT 1 FROM "process_templates" WHERE "code" = 'LOCAL-MARKET'
      )
    `);
    await queryRunner.query(`
      INSERT INTO "process_templates" (
        "id", "code", "name", "input_form", "output_form", "operation_type",
        "expected_yield_percent", "requires_qc", "stages", "workflow",
        "notes", "is_active"
      )
      SELECT
        '9e2f6c44-1a8b-4d73-b5e1-0c7a4d2e8f66',
        'EXPORT-MARKET',
        'Export processing',
        'GREEN',
        'GREEN',
        'OTHER',
        100.00,
        false,
        '[]'::jsonb,
        'EXPORT',
        'Coffee purchased for export. Processing steps are defined on this workflow.',
        true
      WHERE NOT EXISTS (
        SELECT 1 FROM "process_templates" WHERE "code" = 'EXPORT-MARKET'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "process_templates"
      WHERE "code" IN ('LOCAL-MARKET', 'EXPORT-MARKET')
    `);
    await queryRunner.query(`
      ALTER TABLE "process_runs" DROP CONSTRAINT IF EXISTS "FK_process_runs_purchase"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_process_runs_purchase"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_process_runs_workflow"
    `);
    await queryRunner.query(`
      ALTER TABLE "process_runs"
        DROP COLUMN IF EXISTS "purchase_line_id",
        DROP COLUMN IF EXISTS "purchase_id",
        DROP COLUMN IF EXISTS "workflow"
    `);
    await queryRunner.query(`
      ALTER TABLE "process_templates" DROP COLUMN IF EXISTS "workflow"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "process_workflow_enum"
    `);
  }
}
