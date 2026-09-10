import { MigrationInterface, QueryRunner } from 'typeorm';

export class LotAwareStock1748970000000 implements MigrationInterface {
  name = 'LotAwareStock1748970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Coffee adjustment reasons
    for (const value of ['MOISTURE_LOSS', 'SHRINKAGE', 'QC_REJECT']) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TYPE "stock_adjustments_reason_enum" ADD VALUE IF NOT EXISTS '${value}';
        EXCEPTION
          WHEN undefined_object THEN NULL;
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }

    await queryRunner.query(`
      ALTER TABLE "stock_levels"
      ADD COLUMN IF NOT EXISTS "lot_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_transfer_lines"
      ADD COLUMN IF NOT EXISTS "lot_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_adjustments"
      ADD COLUMN IF NOT EXISTS "lot_id" uuid
    `);

    // Drop TypeORM unique constraint on (location_id, item_id) — name varies
    await queryRunner.query(`
      DO $$ DECLARE r record;
      BEGIN
        FOR r IN
          SELECT c.conname
          FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'stock_levels'
            AND c.contype = 'u'
        LOOP
          EXECUTE format('ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_levels_loc_item_nolot"
      ON "stock_levels" ("location_id", "item_id")
      WHERE "lot_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_levels_loc_item_lot"
      ON "stock_levels" ("location_id", "item_id", "lot_id")
      WHERE "lot_id" IS NOT NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "stock_levels"
          ADD CONSTRAINT "FK_stock_levels_lot"
          FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "stock_transfer_lines"
          ADD CONSTRAINT "FK_stock_transfer_lines_lot"
          FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "stock_adjustments"
          ADD CONSTRAINT "FK_stock_adjustments_lot"
          FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_adjustments" DROP CONSTRAINT IF EXISTS "FK_stock_adjustments_lot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_transfer_lines" DROP CONSTRAINT IF EXISTS "FK_stock_transfer_lines_lot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_levels" DROP CONSTRAINT IF EXISTS "FK_stock_levels_lot"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_stock_levels_loc_item_lot"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_stock_levels_loc_item_nolot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_adjustments" DROP COLUMN IF EXISTS "lot_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_transfer_lines" DROP COLUMN IF EXISTS "lot_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_levels" DROP COLUMN IF EXISTS "lot_id"`,
    );
  }
}
