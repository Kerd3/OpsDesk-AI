// Test harness. Each test file runs in its own process (node --test), so the
// environment is configured here BEFORE any application module is imported.
process.env.NODE_ENV = 'test';
process.env.AI_RATE_LIMIT_PER_MINUTE ??= '1000';
process.env.SESSION_SECRET ??= 'test-session-secret-that-is-long-enough-1234567890';

export const TEST_PASSWORD = 'Test-Demo-Password-2026';

const { default: request } = await import('supertest');
const { config } = await import('../src/config/env.js');
if (!config.databaseUrl) throw new Error('TEST_DATABASE_URL must be set (see .env.example)');
if (!/test/i.test(new URL(config.databaseUrl).pathname)) {
  throw new Error('Refusing to run tests: TEST_DATABASE_URL must point at a database whose name contains "test"');
}

const { createApp } = await import('../src/app.js');
const { pool, query } = await import('../src/database/pool.js');
const { migrate, resetDatabase } = await import('../src/database/migrate.js');
const { seed } = await import('../src/database/seed.js');

export { config, pool, query, request };

/** Wipe the test database and load the fictional seed data. */
export async function resetAndSeed() {
  await resetDatabase();
  await migrate({ log: () => {} });
  await seed({ password: TEST_PASSWORD, log: () => {} });
}

export const app = createApp();

/**
 * A cookie-carrying client that automatically sends the CSRF token.
 * Usage: const c = await signIn('employee@opsdesk.local'); await c.post('/api/tickets').send({...})
 */
export async function client() {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf');
  let token = csrf.body.data.csrfToken;
  const withToken = (req) => req.set('X-CSRF-Token', token);
  return {
    agent,
    get: (url) => agent.get(url),
    post: (url) => withToken(agent.post(url)),
    patch: (url) => withToken(agent.patch(url)),
    delete: (url) => withToken(agent.delete(url)),
    setToken: (t) => {
      token = t;
    },
  };
}

export async function signIn(email, password = TEST_PASSWORD) {
  const c = await client();
  const res = await c.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Sign-in failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  c.setToken(res.body.data.csrfToken);
  c.user = res.body.data.user;
  return c;
}

export const EMAILS = {
  admin: 'admin@opsdesk.local',
  support: 'support@opsdesk.local',
  support2: 'support2@opsdesk.local',
  employee: 'employee@opsdesk.local',
  employee2: 'employee2@opsdesk.local',
  inactive: 'former.employee@opsdesk.local',
};

export async function userId(email) {
  return (await query('SELECT id FROM users WHERE email = $1', [email])).rows[0].id;
}

/** First seeded ticket requested by `email` (optionally matching extra SQL). */
export async function ticketOf(email, extra = 'true') {
  const { rows } = await query(
    `SELECT t.* FROM tickets t JOIN users u ON u.id = t.requester_id WHERE u.email = $1 AND ${extra} ORDER BY t.created_at LIMIT 1`,
    [email],
  );
  return rows[0];
}
