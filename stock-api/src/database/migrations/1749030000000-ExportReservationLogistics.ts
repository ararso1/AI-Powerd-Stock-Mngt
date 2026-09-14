import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExportReservationLogistics1749030000000
  implements MigrationInterface
{
  name = 'ExportReservationLogistics1749030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_levels"
        ADD COLUMN IF NOT EXISTS "reserved_quantity" numeric(14,3) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "export_contracts"
        ADD COLUMN IF NOT EXISTS "order_number" varchar(40),
        ADD COLUMN IF NOT EXISTS "buyer_country" varchar(100),
        ADD COLUMN IF NOT EXISTS "coffee_type" varchar(80),
        ADD COLUMN IF NOT EXISTS "origin" varchar(120),
        ADD COLUMN IF NOT EXISTS "destination" varchar(200),
        ADD COLUMN IF NOT EXISTS "container_number" varchar(40),
        ADD COLUMN IF NOT EXISTS "shipping_date" date,
        ADD COLUMN IF NOT EXISTS "expected_arrival" date,
        ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "export_contracts_status_enum" ADD VALUE IF NOT EXISTS 'DELIVERED';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "lot_events_event_type_enum" ADD VALUE IF NOT EXISTS 'RELEASED_EXPORT';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "lot_events_event_type_enum" ADD VALUE IF NOT EXISTS 'DELIVERED';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Backfill reserved qty from open export allocations (physical still on hand)
    await queryRunner.query(`
      UPDATE "stock_levels" sl
      SET "reserved_quantity" = sub.qty
      FROM (
        SELECT
          ea.lot_id AS lot_id,
          l.location_id AS location_id,
          l.item_id AS item_id,
          SUM(ea.quantity_kg::numeric) AS qty
        FROM export_allocations ea
        INNER JOIN export_contracts ec ON ec.id = ea.contract_id
        INNER JOIN lots l ON l.id = ea.lot_id
        WHERE ec.status IN ('DRAFT', 'ALLOCATED', 'STAGED')
          AND l.location_id IS NOT NULL
          AND l.item_id IS NOT NULL
        GROUP BY ea.lot_id, l.location_id, l.item_id
      ) sub
      WHERE sl.lot_id = sub.lot_id
        AND sl.location_id = sub.location_id
        AND sl.item_id = sub.item_id
    `);

    // Cap reserved at on-hand (safety)
    await queryRunner.query(`
      UPDATE "stock_levels"
      SET "reserved_quantity" = "quantity"
      WHERE "reserved_quantity" > "quantity"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "export_contracts"
        DROP COLUMN IF EXISTS "order_number",
        DROP COLUMN IF EXISTS "buyer_country",
        DROP COLUMN IF EXISTS "coffee_type",
        DROP COLUMN IF EXISTS "origin",
        DROP COLUMN IF EXISTS "destination",
        DROP COLUMN IF EXISTS "container_number",
        DROP COLUMN IF EXISTS "shipping_date",
        DROP COLUMN IF EXISTS "expected_arrival",
        DROP COLUMN IF EXISTS "delivered_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_levels" DROP COLUMN IF EXISTS "reserved_quantity"
    `);
    // Postgres cannot easily remove enum values; leave DELIVERED in place.
  }
}
