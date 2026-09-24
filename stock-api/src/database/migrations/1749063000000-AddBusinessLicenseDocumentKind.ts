import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessLicenseDocumentKind1749063000000
  implements MigrationInterface
{
  name = 'AddBusinessLicenseDocumentKind1749063000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "supplier_documents_kind_enum" ADD VALUE IF NOT EXISTS 'BUSINESS_LICENSE';
      EXCEPTION WHEN others THEN null;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Enum values cannot be removed safely without recreating the type.
  }
}
