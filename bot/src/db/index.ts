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
    try {
      await migrate(db, { migrationsFolder });
      console.log('[DB] Migrations applied successfully');
    } catch (err) {
      console.warn('[DB] Drizzle migrate failed, applying embedded schema patches:', err);
      await db.execute(sql.raw(INIT_SCHEMA_SQL));
      console.log('[DB] Embedded schema applied after migrate error');
    }
  } else {
    console.log('[DB] No migration journal found — applying embedded schema...');
    await db.execute(sql.raw(INIT_SCHEMA_SQL));
    console.log('[DB] Schema initialized from embedded SQL');
  }

  // Always apply additive patches (new columns / indexes) idempotently
  try {
    await db.execute(sql.raw(INIT_SCHEMA_SQL));
  } catch (err) {
    console.warn('[DB] Post-migrate schema patch warning:', err);
  }
}
