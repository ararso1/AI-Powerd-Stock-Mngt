import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierTypeSupplier1749061000000
  implements MigrationInterface
{
  name = 'AddSupplierTypeSupplier1749061000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "suppliers_supplier_type_enum" ADD VALUE IF NOT EXISTS 'SUPPLIER' BEFORE 'FARMER';
      EXCEPTION WHEN others THEN
        BEGIN
          ALTER TYPE "suppliers_supplier_type_enum" ADD VALUE IF NOT EXISTS 'SUPPLIER';
        EXCEPTION WHEN others THEN null;
        END;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "suppliers"
        ALTER COLUMN "supplier_type" SET DEFAULT 'SUPPLIER'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "suppliers"
        ALTER COLUMN "supplier_type" SET DEFAULT 'OTHER'
    `);
    // Enum values cannot be removed safely in Postgres without recreating the type.
  }
}
