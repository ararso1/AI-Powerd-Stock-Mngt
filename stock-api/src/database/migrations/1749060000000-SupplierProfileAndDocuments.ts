import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplierProfileAndDocuments1749060000000
  implements MigrationInterface
{
  name = 'SupplierProfileAndDocuments1749060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "suppliers_supplier_type_enum" AS ENUM (
          'SUPPLIER', 'FARMER', 'COOPERATIVE', 'COLLECTOR', 'UNION', 'TRADER', 'PROCESSOR', 'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "supplier_documents_kind_enum" AS ENUM ('ID', 'AGREEMENT', 'BUSINESS_LICENSE', 'OTHER');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "suppliers"
        ADD COLUMN IF NOT EXISTS "supplier_type" "suppliers_supplier_type_enum" NOT NULL DEFAULT 'SUPPLIER',
        ADD COLUMN IF NOT EXISTS "contact_person" character varying(120),
        ADD COLUMN IF NOT EXISTS "alternate_phone" character varying(50),
        ADD COLUMN IF NOT EXISTS "region" character varying(120),
        ADD COLUMN IF NOT EXISTS "zone" character varying(120),
        ADD COLUMN IF NOT EXISTS "woreda" character varying(120),
        ADD COLUMN IF NOT EXISTS "kebele" character varying(120),
        ADD COLUMN IF NOT EXISTS "organization_name" character varying(200),
        ADD COLUMN IF NOT EXISTS "tin_number" character varying(40),
        ADD COLUMN IF NOT EXISTS "license_number" character varying(80),
        ADD COLUMN IF NOT EXISTS "license_expiry" date,
        ADD COLUMN IF NOT EXISTS "bank_name" character varying(120),
        ADD COLUMN IF NOT EXISTS "bank_account_name" character varying(150),
        ADD COLUMN IF NOT EXISTS "bank_account_number" character varying(80),
        ADD COLUMN IF NOT EXISTS "bank_branch" character varying(120),
        ADD COLUMN IF NOT EXISTS "notes" text
    `);

    await queryRunner.query(`
      ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "credit_limit"
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "supplier_documents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "supplier_id" uuid NOT NULL,
        "kind" "supplier_documents_kind_enum" NOT NULL,
        "original_name" character varying(255) NOT NULL,
        "mime_type" character varying(120) NOT NULL,
        "size_bytes" integer NOT NULL,
        "storage_key" character varying(500) NOT NULL,
        "uploaded_by_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_supplier_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_supplier_documents_supplier"
          FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_supplier_documents_user"
          FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_supplier_documents_supplier_id"
        ON "supplier_documents" ("supplier_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_documents"`);
    await queryRunner.query(`
      ALTER TABLE "suppliers"
        DROP COLUMN IF EXISTS "supplier_type",
        DROP COLUMN IF EXISTS "contact_person",
        DROP COLUMN IF EXISTS "alternate_phone",
        DROP COLUMN IF EXISTS "region",
        DROP COLUMN IF EXISTS "zone",
        DROP COLUMN IF EXISTS "woreda",
        DROP COLUMN IF EXISTS "kebele",
        DROP COLUMN IF EXISTS "organization_name",
        DROP COLUMN IF EXISTS "tin_number",
        DROP COLUMN IF EXISTS "license_number",
        DROP COLUMN IF EXISTS "license_expiry",
        DROP COLUMN IF EXISTS "bank_name",
        DROP COLUMN IF EXISTS "bank_account_name",
        DROP COLUMN IF EXISTS "bank_account_number",
        DROP COLUMN IF EXISTS "bank_branch",
        DROP COLUMN IF EXISTS "notes"
    `);
    await queryRunner.query(`
      ALTER TABLE "suppliers"
        ADD COLUMN IF NOT EXISTS "credit_limit" numeric(14,2)
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "supplier_documents_kind_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "suppliers_supplier_type_enum"`);
  }
}
