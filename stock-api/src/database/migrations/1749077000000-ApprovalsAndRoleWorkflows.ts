import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApprovalsAndRoleWorkflows1749077000000
  implements MigrationInterface
{
  name = 'ApprovalsAndRoleWorkflows1749077000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "purchases_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
      EXCEPTION
        WHEN undefined_object THEN null;
        WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "purchases_status_enum" ADD VALUE IF NOT EXISTS 'REJECTED';
      EXCEPTION
        WHEN undefined_object THEN null;
        WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "sales_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
      EXCEPTION
        WHEN undefined_object THEN null;
        WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "sales_status_enum" ADD VALUE IF NOT EXISTS 'REJECTED';
      EXCEPTION
        WHEN undefined_object THEN null;
        WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "process_runs_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
      EXCEPTION
        WHEN undefined_object THEN null;
        WHEN duplicate_object THEN null;
      END $$
    `);

    // DocumentStatus may be shared as a generic enum name in some DBs
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "document_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
      EXCEPTION
        WHEN undefined_object THEN null;
        WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "document_status_enum" ADD VALUE IF NOT EXISTS 'REJECTED';
      EXCEPTION
        WHEN undefined_object THEN null;
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'APPROVAL_PENDING';
      EXCEPTION
        WHEN undefined_object THEN null;
        WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'APPROVAL_DECIDED';
      EXCEPTION
        WHEN undefined_object THEN null;
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_locations" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "location_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_locations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_locations_user_location" UNIQUE ("user_id", "location_id"),
        CONSTRAINT "FK_user_locations_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_locations_location" FOREIGN KEY ("location_id")
          REFERENCES "locations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "approval_requests_entity_type_enum" AS ENUM (
          'PURCHASE', 'SALE', 'PROCESS_RUN'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "approval_requests_status_enum" AS ENUM (
          'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "approval_steps_status_enum" AS ENUM (
          'PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "approval_requests" (
        "id" uuid NOT NULL,
        "entity_type" "approval_requests_entity_type_enum" NOT NULL,
        "entity_id" uuid NOT NULL,
        "status" "approval_requests_status_enum" NOT NULL DEFAULT 'PENDING',
        "initiated_by_id" uuid,
        "notes" text,
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "decided_at" TIMESTAMPTZ,
        CONSTRAINT "PK_approval_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_approval_requests_initiated_by" FOREIGN KEY ("initiated_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_approval_requests_entity"
        ON "approval_requests" ("entity_type", "entity_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_approval_requests_status"
        ON "approval_requests" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "approval_steps" (
        "id" uuid NOT NULL,
        "request_id" uuid NOT NULL,
        "required_role_name" character varying(100) NOT NULL,
        "required_permission" character varying(100),
        "step_order" int NOT NULL DEFAULT 1,
        "status" "approval_steps_status_enum" NOT NULL DEFAULT 'PENDING',
        "decided_by_id" uuid,
        "comment" text,
        "decided_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approval_steps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_approval_steps_request" FOREIGN KEY ("request_id")
          REFERENCES "approval_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_approval_steps_decided_by" FOREIGN KEY ("decided_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_approval_steps_request"
        ON "approval_steps" ("request_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_locations"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "approval_steps_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "approval_requests_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "approval_requests_entity_type_enum"`,
    );
  }
}
