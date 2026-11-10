import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SeedService } from './database/seed.service';

dotenv.config();

async function seedUsers() {
  // Prevent SeedService.onModuleInit auto-run from triggering twice when DB_SEED=true.
  process.env.DB_SEED = 'false';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const seeder = app.get(SeedService);
    await seeder.seedUsers();
  } finally {
    await app.close();
  }
}

seedUsers().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
