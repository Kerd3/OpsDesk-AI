// Resets the TEST database and loads the fictional seed data before the E2E run.
// NODE_ENV must be "test" before backend modules load so they target TEST_DATABASE_URL.
import { E2E_PASSWORD } from './tests/helpers.js';

export default async function globalSetup() {
  process.env.NODE_ENV = 'test';
  const { config } = await import('../backend/src/config/env.js');
  if (!/test/i.test(new URL(config.databaseUrl).pathname)) {
    throw new Error('Refusing to reset: TEST_DATABASE_URL must point at a database whose name contains "test"');
  }
  const { pool } = await import('../backend/src/database/pool.js');
  const { resetDatabase, migrate } = await import('../backend/src/database/migrate.js');
  const { seed } = await import('../backend/src/database/seed.js');
  await resetDatabase();
  await migrate({ log: () => {} });
  await seed({ password: E2E_PASSWORD, log: () => {} });
  await pool.end();
}
