import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurchaseType1749067000000 implements MigrationInterface {
  name = 'AddPurchaseType1749067000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "purchases_purchase_type_enum" AS ENUM ('LOCAL', 'EXPORT');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "purchases"
        ADD COLUMN IF NOT EXISTS "purchase_type" "purchases_purchase_type_enum"
          NOT NULL DEFAULT 'LOCAL'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "purchases" DROP COLUMN IF EXISTS "purchase_type"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "purchases_purchase_type_enum"
    `);
  }
}
