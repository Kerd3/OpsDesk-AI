// Runs in its own process so the small limit does not affect other test files.
process.env.AUTH_RATE_LIMIT_MAX = '3';

const { test, before, after } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { client, resetAndSeed, pool, EMAILS, TEST_PASSWORD } = await import('./helpers.js');

before(resetAndSeed);
after(() => pool.end());

test('repeated failed sign-ins are rate limited', async () => {
  const c = await client();
  for (let i = 0; i < 3; i += 1) {
    const res = await c.post('/api/auth/login').send({ email: EMAILS.employee, password: `wrong-password-${i}` });
    assert.equal(res.status, 401);
  }
  const blocked = await c.post('/api/auth/login').send({ email: EMAILS.employee, password: TEST_PASSWORD });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, 'RATE_LIMITED');
});
