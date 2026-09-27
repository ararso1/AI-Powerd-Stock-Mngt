import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProcessRunInputLines1749071000000 implements MigrationInterface {
  name = 'ProcessRunInputLines1749071000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "process_runs"
        ADD COLUMN IF NOT EXISTS "input_lines" jsonb NOT NULL DEFAULT '[]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "process_runs" DROP COLUMN IF EXISTS "input_lines"
    `);
  }
}
