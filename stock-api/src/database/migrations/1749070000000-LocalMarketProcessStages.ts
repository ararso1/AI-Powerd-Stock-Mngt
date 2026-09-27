import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocalMarketProcessStages1749070000000
  implements MigrationInterface
{
  name = 'LocalMarketProcessStages1749070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "process_runs"
        ADD COLUMN IF NOT EXISTS "stage_results" jsonb NOT NULL DEFAULT '[]'
    `);
    await queryRunner.query(`
      UPDATE "process_templates"
      SET
        "stages" = '["Cleaning","Roast & Ground","Sales Store"]'::jsonb,
        "notes" = 'Local market flow: Purchase, Cleaning, Roast & Ground, Sales Store. Export uses its own workflow.',
        "expected_yield_percent" = 80.00
      WHERE "code" = 'LOCAL-MARKET'
    `);
    await queryRunner.query(`
      UPDATE "process_runs"
      SET "stages" = '["Cleaning","Roast & Ground","Sales Store"]'::jsonb
      WHERE "workflow" = 'LOCAL'
        AND "status" IN ('DRAFT', 'IN_PROGRESS')
        AND COALESCE(jsonb_array_length("stages"), 0) = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "process_runs" DROP COLUMN IF EXISTS "stage_results"
    `);
  }
}
