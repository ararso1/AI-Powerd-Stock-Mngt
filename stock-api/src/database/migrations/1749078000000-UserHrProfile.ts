import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserHrProfile1749078000000 implements MigrationInterface {
  name = 'UserHrProfile1749078000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_employment_type_enum" AS ENUM (
          'FULL_TIME', 'PART_TIME', 'CONTRACT', 'CASUAL'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_employment_status_enum" AS ENUM (
          'ACTIVE', 'ON_LEAVE', 'TERMINATED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "phone" character varying(40),
        ADD COLUMN IF NOT EXISTS "employee_code" character varying(40),
        ADD COLUMN IF NOT EXISTS "department" character varying(120),
        ADD COLUMN IF NOT EXISTS "designation" character varying(120),
        ADD COLUMN IF NOT EXISTS "salary" numeric(14,2),
        ADD COLUMN IF NOT EXISTS "salary_currency" character varying(3) DEFAULT 'ETB',
        ADD COLUMN IF NOT EXISTS "hired_at" date,
        ADD COLUMN IF NOT EXISTS "employment_type" "users_employment_type_enum",
        ADD COLUMN IF NOT EXISTS "employment_status" "users_employment_status_enum"
          NOT NULL DEFAULT 'ACTIVE',
        ADD COLUMN IF NOT EXISTS "notes" text
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_employee_code"
        ON "users" ("employee_code")
        WHERE "employee_code" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_employee_code"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "phone",
        DROP COLUMN IF EXISTS "employee_code",
        DROP COLUMN IF EXISTS "department",
        DROP COLUMN IF EXISTS "designation",
        DROP COLUMN IF EXISTS "salary",
        DROP COLUMN IF EXISTS "salary_currency",
        DROP COLUMN IF EXISTS "hired_at",
        DROP COLUMN IF EXISTS "employment_type",
        DROP COLUMN IF EXISTS "employment_status",
        DROP COLUMN IF EXISTS "notes"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_employment_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_employment_type_enum"`);
  }
}
