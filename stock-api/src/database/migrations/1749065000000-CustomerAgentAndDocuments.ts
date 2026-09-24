import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerAgentAndDocuments1749065000000
  implements MigrationInterface
{
  name = 'CustomerAgentAndDocuments1749065000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "customers_customer_type_enum" ADD VALUE IF NOT EXISTS 'NORMAL';
      EXCEPTION WHEN others THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "customers_customer_type_enum" ADD VALUE IF NOT EXISTS 'AGENT';
      EXCEPTION WHEN others THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "customer_documents_kind_enum" AS ENUM ('AGENT_AGREEMENT', 'OTHER');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_documents" (
        "id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "kind" "customer_documents_kind_enum" NOT NULL,
        "title" character varying(200) NOT NULL,
        "original_name" character varying(255) NOT NULL,
        "mime_type" character varying(120) NOT NULL,
        "size_bytes" integer NOT NULL,
        "storage_key" character varying(500) NOT NULL,
        "uploaded_by_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_documents_customer"
          FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_documents_user"
          FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_documents_customer_id"
        ON "customer_documents" ("customer_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "customers"
        ALTER COLUMN "customer_type" SET DEFAULT 'NORMAL'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_documents"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "customer_documents_kind_enum"`);
    await queryRunner.query(`
      ALTER TABLE "customers"
        ALTER COLUMN "customer_type" SET DEFAULT 'RETAIL'
    `);
  }
}
