import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from '../config.js';
import * as schema from './schema.js';
import { existsSync } from 'fs';
import { resolve } from 'path';

const client = postgres(config.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export { schema };

export async function runMigrations() {
  const migrationsFolder = resolve(process.cwd(), 'drizzle');
  const journalPath = resolve(migrationsFolder, 'meta/_journal.json');
  if (existsSync(journalPath)) {
    await migrate(db, { migrationsFolder });
    console.log('[DB] Migrations applied successfully');
  } else {
    console.log('[DB] No migrations found. Tables must be created via "drizzle-kit push" or generated migrations.');
  }
}
