import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { app, client, signIn, resetAndSeed, pool, query, request, EMAILS, TEST_PASSWORD } from './helpers.js';

before(resetAndSeed);
after(() => pool.end());

describe('authentication', () => {
  test('valid login returns the user, sets an HTTP-only session cookie, and never returns the password hash', async () => {
    const c = await client();
    const res = await c.post('/api/auth/login').send({ email: EMAILS.employee, password: TEST_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, EMAILS.employee);
    assert.equal(res.body.data.user.role, 'employee');
    assert.ok(res.body.data.csrfToken);
    assert.equal(JSON.stringify(res.body).includes('password'), false);

    const cookie = res.headers['set-cookie'].find((h) => h.startsWith('opsdesk.sid='));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
  });

  test('email matching is case-insensitive', async () => {
    const c = await client();
    const res = await c.post('/api/auth/login').send({ email: 'Employee@OpsDesk.LOCAL', password: TEST_PASSWORD });
    assert.equal(res.status, 200);
  });

  test('invalid password is rejected with a generic message', async () => {
    const c = await client();
    const res = await c.post('/api/auth/login').send({ email: EMAILS.employee, password: 'wrong-password-123' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(res.body.error.message, 'Invalid email or password');
  });

  test('unknown email gets the same response as a wrong password', async () => {
    const c = await client();
    const res = await c.post('/api/auth/login').send({ email: 'nobody@opsdesk.local', password: 'whatever-123' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, 'Invalid email or password');
  });

  test('missing credentials return field validation errors', async () => {
    const c = await client();
    const res = await c.post('/api/auth/login').send({});
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['email', 'password']);
  });

  test('deactivated accounts cannot sign in', async () => {
    const c = await client();
    const res = await c.post('/api/auth/login').send({ email: EMAILS.inactive, password: TEST_PASSWORD });
    assert.equal(res.status, 401);
  });

  test('unauthenticated API requests are rejected', async () => {
    for (const path of ['/api/auth/me', '/api/tickets', '/api/dashboard', '/api/knowledge-base', '/api/assets', '/api/admin/users']) {
      const res = await request(app).get(path);
      assert.equal(res.status, 401, path);
      assert.equal(res.body.error.code, 'UNAUTHENTICATED');
    }
  });

  test('state-changing requests without a CSRF token are rejected', async () => {
    const c = await signIn(EMAILS.employee);
    const res = await c.agent.post('/api/tickets').send({ subject: 'No token', description: 'This should be blocked by CSRF.', category: 'other' });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'CSRF_INVALID');

    const wrong = await c.agent.post('/api/tickets').set('X-CSRF-Token', 'x'.repeat(64)).send({ subject: 'Bad token', description: 'This should be blocked by CSRF.', category: 'other' });
    assert.equal(wrong.status, 403);
  });

  test('GET /api/auth/me returns the current user', async () => {
    const c = await signIn(EMAILS.support);
    const res = await c.get('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'it_support');
  });

  test('logout destroys the session', async () => {
    const c = await signIn(EMAILS.employee);
    assert.equal((await c.get('/api/auth/me')).status, 200);
    const out = await c.post('/api/auth/logout');
    assert.equal(out.status, 200);
    assert.equal((await c.get('/api/auth/me')).status, 401);
  });

  test('login and failed login are written to the audit log without secrets', async () => {
    const { rows } = await query(`SELECT action, metadata FROM audit_logs WHERE action IN ('auth.login', 'auth.login_failed')`);
    assert.ok(rows.some((r) => r.action === 'auth.login'));
    assert.ok(rows.some((r) => r.action === 'auth.login_failed' && r.metadata.reason === 'wrong_password'));
    assert.equal(JSON.stringify(rows).includes('wrong-password-123'), false);
  });

  test('password change requires the current password and signs out other sessions', async () => {
    const first = await signIn(EMAILS.employee2);
    const second = await signIn(EMAILS.employee2);

    const bad = await first.post('/api/auth/change-password').send({ currentPassword: 'not-it-12345', newPassword: 'Brand-new-pass-99' });
    assert.equal(bad.status, 400);

    const weak = await first.post('/api/auth/change-password').send({ currentPassword: TEST_PASSWORD, newPassword: 'short' });
    assert.equal(weak.status, 422);

    const ok = await first.post('/api/auth/change-password').send({ currentPassword: TEST_PASSWORD, newPassword: 'Brand-new-pass-99' });
    assert.equal(ok.status, 200);
    assert.equal((await first.get('/api/auth/me')).status, 200, 'current session stays signed in');
    assert.equal((await second.get('/api/auth/me')).status, 401, 'other sessions are signed out');

    await signIn(EMAILS.employee2, 'Brand-new-pass-99');
  });

  test('malformed JSON returns 400 without a stack trace', async () => {
    const c = await client();
    const res = await c.post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'BAD_REQUEST');
    assert.equal(JSON.stringify(res.body).includes('at '), false);
  });

  test('security headers are set', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['content-security-policy']);
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});
