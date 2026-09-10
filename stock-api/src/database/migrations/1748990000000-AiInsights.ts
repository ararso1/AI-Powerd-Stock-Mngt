import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiInsights1748990000000 implements MigrationInterface {
  name = 'AiInsights1748990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ai_insights_kind_enum" AS ENUM (
          'DEMAND_FORECAST',
          'INTAKE_ADVICE',
          'YIELD_ANOMALY',
          'BLEND_OPTIMIZER',
          'PRICING',
          'EXPORT_READINESS',
          'QUALITY_RISK'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ai_insights_severity_enum" AS ENUM (
          'info', 'warn', 'critical'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ai_insights_status_enum" AS ENUM (
          'OPEN', 'ACCEPTED', 'REJECTED', 'DISMISSED', 'SUPERSEDED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ai_insights_source_enum" AS ENUM (
          'DEMO', 'RULES', 'FORECAST'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ai_feedback_decision_enum" AS ENUM (
          'ACCEPT', 'REJECT', 'DISMISS'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_insights" (
        "id" uuid NOT NULL,
        "code" character varying(80) NOT NULL,
        "kind" "ai_insights_kind_enum" NOT NULL,
        "severity" "ai_insights_severity_enum" NOT NULL DEFAULT 'info',
        "status" "ai_insights_status_enum" NOT NULL DEFAULT 'OPEN',
        "title" character varying(200) NOT NULL,
        "summary" text NOT NULL,
        "href" character varying(240),
        "confidence" numeric(5,4) NOT NULL DEFAULT 0.7500,
        "score" numeric(8,2),
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "source" "ai_insights_source_enum" NOT NULL DEFAULT 'RULES',
        "lot_id" uuid,
        "export_contract_id" uuid,
        "expires_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_insights" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ai_insights_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_insights_kind_status"
        ON "ai_insights" ("kind", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_insights_created_at"
        ON "ai_insights" ("created_at")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "ai_insights"
          ADD CONSTRAINT "FK_ai_insights_lot"
          FOREIGN KEY ("lot_id") REFERENCES "lots"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "ai_insights"
          ADD CONSTRAINT "FK_ai_insights_export_contract"
          FOREIGN KEY ("export_contract_id") REFERENCES "export_contracts"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_feedback" (
        "id" uuid NOT NULL,
        "insight_id" uuid NOT NULL,
        "decision" "ai_feedback_decision_enum" NOT NULL,
        "note" text,
        "user_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_feedback" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_feedback_insight_id"
        ON "ai_feedback" ("insight_id")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "ai_feedback"
          ADD CONSTRAINT "FK_ai_feedback_insight"
          FOREIGN KEY ("insight_id") REFERENCES "ai_insights"("id")
          ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "ai_feedback"
          ADD CONSTRAINT "FK_ai_feedback_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_feedback" DROP CONSTRAINT IF EXISTS "FK_ai_feedback_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_feedback" DROP CONSTRAINT IF EXISTS "FK_ai_feedback_insight"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_feedback"`);
    await queryRunner.query(
      `ALTER TABLE "ai_insights" DROP CONSTRAINT IF EXISTS "FK_ai_insights_export_contract"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_insights" DROP CONSTRAINT IF EXISTS "FK_ai_insights_lot"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_insights"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "ai_feedback_decision_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_insights_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_insights_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_insights_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_insights_kind_enum"`);
  }
}
