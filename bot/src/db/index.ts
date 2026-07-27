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
  if (existsSync(migrationsFolder)) {
    await migrate(db, { migrationsFolder });
  } else {
    console.log('[DB] No migrations folder found. Run "pnpm db:generate" first, or use "pnpm db:push" for development.');
  }
}
