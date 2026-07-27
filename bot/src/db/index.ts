import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { config } from '../config.js';
import * as schema from './schema.js';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { INIT_SCHEMA_SQL } from './init-schema.js';

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
    // Normal drizzle migration path
    await migrate(db, { migrationsFolder });
    console.log('[DB] Migrations applied successfully');
  } else {
    // Fallback: execute embedded schema SQL directly (compiled into dist/)
    console.log('[DB] No migration journal found — applying embedded schema...');
    await db.execute(sql.raw(INIT_SCHEMA_SQL));
    console.log('[DB] Schema initialized from embedded SQL');
  }
}
