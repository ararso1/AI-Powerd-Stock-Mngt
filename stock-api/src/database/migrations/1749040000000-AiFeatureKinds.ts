import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiFeatureKinds1749040000000 implements MigrationInterface {
  name = 'AiFeatureKinds1749040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of [
      'STOCK_PREDICTION',
      'PROCUREMENT',
      'CREDIT_RISK',
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TYPE "ai_insights_kind_enum" ADD VALUE IF NOT EXISTS '${value}';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }
  }

  public async down(): Promise<void> {
    // Postgres cannot easily drop enum values.
  }
}
