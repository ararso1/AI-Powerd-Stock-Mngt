import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandCustomerProfile1749064000000 implements MigrationInterface {
  name = 'ExpandCustomerProfile1749064000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD COLUMN IF NOT EXISTS "contact_person" character varying(120),
        ADD COLUMN IF NOT EXISTS "alternate_phone" character varying(50),
        ADD COLUMN IF NOT EXISTS "city" character varying(120),
        ADD COLUMN IF NOT EXISTS "region" character varying(120),
        ADD COLUMN IF NOT EXISTS "organization_name" character varying(200),
        ADD COLUMN IF NOT EXISTS "tin_number" character varying(40),
        ADD COLUMN IF NOT EXISTS "notes" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers"
        DROP COLUMN IF EXISTS "contact_person",
        DROP COLUMN IF EXISTS "alternate_phone",
        DROP COLUMN IF EXISTS "city",
        DROP COLUMN IF EXISTS "region",
        DROP COLUMN IF EXISTS "organization_name",
        DROP COLUMN IF EXISTS "tin_number",
        DROP COLUMN IF EXISTS "notes"
    `);
  }
}
