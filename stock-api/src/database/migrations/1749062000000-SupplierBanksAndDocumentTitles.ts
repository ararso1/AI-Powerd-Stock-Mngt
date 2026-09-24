import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplierBanksAndDocumentTitles1749062000000
  implements MigrationInterface
{
  name = 'SupplierBanksAndDocumentTitles1749062000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "supplier_bank_accounts" (
        "id" uuid NOT NULL,
        "supplier_id" uuid NOT NULL,
        "bank_name" character varying(120) NOT NULL,
        "account_holder_name" character varying(150) NOT NULL,
        "account_number" character varying(80) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_supplier_bank_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_supplier_bank_accounts_supplier"
          FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_supplier_bank_accounts_supplier_id"
        ON "supplier_bank_accounts" ("supplier_id")
    `);

    // Migrate legacy single bank fields into the new table.
    await queryRunner.query(`
      INSERT INTO "supplier_bank_accounts" (
        "id", "supplier_id", "bank_name", "account_holder_name",
        "account_number", "sort_order", "created_at", "updated_at"
      )
      SELECT
        gen_random_uuid(),
        s."id",
        s."bank_name",
        COALESCE(NULLIF(TRIM(s."bank_account_name"), ''), s."name"),
        s."bank_account_number",
        0,
        now(),
        now()
      FROM "suppliers" s
      WHERE s."bank_name" IS NOT NULL
        AND TRIM(s."bank_name") <> ''
        AND s."bank_account_number" IS NOT NULL
        AND TRIM(s."bank_account_number") <> ''
        AND NOT EXISTS (
          SELECT 1 FROM "supplier_bank_accounts" b WHERE b."supplier_id" = s."id"
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "suppliers"
        DROP COLUMN IF EXISTS "bank_name",
        DROP COLUMN IF EXISTS "bank_account_name",
        DROP COLUMN IF EXISTS "bank_account_number",
        DROP COLUMN IF EXISTS "bank_branch"
    `);

    await queryRunner.query(`
      ALTER TABLE "supplier_documents"
        ADD COLUMN IF NOT EXISTS "title" character varying(200)
    `);
    await queryRunner.query(`
      UPDATE "supplier_documents"
      SET "title" = CASE
        WHEN "kind" = 'ID' THEN 'ID Document'
        WHEN "kind" = 'AGREEMENT' THEN 'Agreement / Contract'
        ELSE COALESCE(NULLIF(TRIM("original_name"), ''), 'Document')
      END
      WHERE "title" IS NULL OR TRIM("title") = ''
    `);
    await queryRunner.query(`
      ALTER TABLE "supplier_documents"
        ALTER COLUMN "title" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "suppliers"
        ADD COLUMN IF NOT EXISTS "bank_name" character varying(120),
        ADD COLUMN IF NOT EXISTS "bank_account_name" character varying(150),
        ADD COLUMN IF NOT EXISTS "bank_account_number" character varying(80),
        ADD COLUMN IF NOT EXISTS "bank_branch" character varying(120)
    `);
    await queryRunner.query(`
      UPDATE "suppliers" s
      SET
        "bank_name" = b."bank_name",
        "bank_account_name" = b."account_holder_name",
        "bank_account_number" = b."account_number"
      FROM (
        SELECT DISTINCT ON ("supplier_id") *
        FROM "supplier_bank_accounts"
        ORDER BY "supplier_id", "sort_order" ASC
      ) b
      WHERE b."supplier_id" = s."id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_bank_accounts"`);
    await queryRunner.query(`
      ALTER TABLE "supplier_documents" DROP COLUMN IF EXISTS "title"
    `);
  }
}
