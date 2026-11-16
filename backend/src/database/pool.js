import pg from 'pg';
import { config } from '../config/env.js';

// Return BIGINT/NUMERIC aggregates (COUNT, AVG) as JS numbers. Values in this
// application are far below Number.MAX_SAFE_INTEGER.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number.parseInt(v, 10));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number.parseFloat(v));
// Keep DATE columns as 'YYYY-MM-DD' strings instead of local-midnight Date objects.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // An idle client errored (e.g. database restarted). The pool discards it.
  console.error('[db] idle client error:', err.message);
});

/** Run a parameterized query. Never interpolate user input into `text`. */
export function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Run `fn` inside a transaction. `fn` receives a client whose `query` method
 * must be used for every statement that belongs to the transaction.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
