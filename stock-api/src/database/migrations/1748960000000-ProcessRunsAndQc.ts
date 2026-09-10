import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProcessRunsAndQc1748960000000 implements MigrationInterface {
  name = 'ProcessRunsAndQc1748960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "process_templates_input_form_enum" AS ENUM (
          'CHERRY', 'PARCHMENT', 'GREEN', 'ROASTED', 'PACKAGED', 'REJECT'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "process_templates_output_form_enum" AS ENUM (
          'CHERRY', 'PARCHMENT', 'GREEN', 'ROASTED', 'PACKAGED', 'REJECT'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "process_runs_status_enum" AS ENUM (
          'DRAFT', 'IN_PROGRESS', 'QC_HOLD', 'READY', 'COMPLETED', 'CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "process_templates" (
        "id" uuid NOT NULL,
        "code" character varying(40) NOT NULL,
        "name" character varying(150) NOT NULL,
        "input_form" "process_templates_input_form_enum" NOT NULL,
        "output_form" "process_templates_output_form_enum" NOT NULL,
        "expected_yield_percent" numeric(6,2) NOT NULL DEFAULT 100,
        "requires_qc" boolean NOT NULL DEFAULT true,
        "stages" jsonb NOT NULL DEFAULT '[]',
        "input_item_id" uuid,
        "output_item_id" uuid,
        "max_moisture_percent" numeric(5,2),
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_process_templates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_process_templates_code" UNIQUE ("code"),
        CONSTRAINT "FK_process_templates_input_item" FOREIGN KEY ("input_item_id")
          REFERENCES "items"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_process_templates_output_item" FOREIGN KEY ("output_item_id")
          REFERENCES "items"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "process_runs" (
        "id" uuid NOT NULL,
        "run_number" character varying(40) NOT NULL,
        "template_id" uuid NOT NULL,
        "input_lot_id" uuid NOT NULL,
        "output_lot_id" uuid,
        "location_id" uuid NOT NULL,
        "quantity_input" numeric(14,3) NOT NULL,
        "quantity_output" numeric(14,3),
        "quantity_reject" numeric(14,3) NOT NULL DEFAULT 0,
        "expected_yield_percent" numeric(6,2) NOT NULL,
        "actual_yield_percent" numeric(6,2),
        "status" "process_runs_status_enum" NOT NULL DEFAULT 'DRAFT',
        "current_stage_index" int NOT NULL DEFAULT 0,
        "stages" jsonb NOT NULL DEFAULT '[]',
        "stages_completed" jsonb NOT NULL DEFAULT '[]',
        "process_cost" numeric(14,2) NOT NULL DEFAULT 0,
        "notes" text,
        "started_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "created_by_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_process_runs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_process_runs_number" UNIQUE ("run_number"),
        CONSTRAINT "FK_process_runs_template" FOREIGN KEY ("template_id")
          REFERENCES "process_templates"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_process_runs_input_lot" FOREIGN KEY ("input_lot_id")
          REFERENCES "lots"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_process_runs_output_lot" FOREIGN KEY ("output_lot_id")
          REFERENCES "lots"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_process_runs_location" FOREIGN KEY ("location_id")
          REFERENCES "locations"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_process_runs_user" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "qc_results" (
        "id" uuid NOT NULL,
        "process_run_id" uuid NOT NULL,
        "lot_id" uuid NOT NULL,
        "moisture_percent" numeric(5,2),
        "defect_count" int,
        "cupping_score" numeric(5,2),
        "passed" boolean NOT NULL DEFAULT false,
        "notes" text,
        "created_by_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_qc_results" PRIMARY KEY ("id"),
        CONSTRAINT "FK_qc_results_run" FOREIGN KEY ("process_run_id")
          REFERENCES "process_runs"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_qc_results_lot" FOREIGN KEY ("lot_id")
          REFERENCES "lots"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_qc_results_user" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_process_runs_status_created"
      ON "process_runs" ("status", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "qc_results"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "process_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "process_templates"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "process_runs_status_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "process_templates_output_form_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "process_templates_input_form_enum"`,
    );
  }
}
