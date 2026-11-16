import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { signIn, client, resetAndSeed, pool, query, EMAILS, TEST_PASSWORD } from './helpers.js';

let employee, support, admin;

before(async () => {
  await resetAndSeed();
  [employee, support, admin] = await Promise.all([signIn(EMAILS.employee), signIn(EMAILS.support), signIn(EMAILS.admin)]);
});
after(() => pool.end());

describe('role restrictions', () => {
  test('only administrators can reach admin and report endpoints', async () => {
    const paths = ['/api/admin/users', '/api/admin/audit-logs', '/api/admin/settings', '/api/reports/summary', '/api/reports/tickets'];
    for (const user of [employee, support]) {
      for (const p of paths) assert.equal((await user.get(p)).status, 403, p);
    }
    for (const p of paths) assert.equal((await admin.get(p)).status, 200, p);
  });

  test('the staff directory is not available to employees', async () => {
    assert.equal((await employee.get('/api/users/directory')).status, 403);
    const res = await support.get('/api/users/directory');
    assert.ok(res.body.data.every((u) => ['admin', 'it_support'].includes(u.role)));
  });
});

describe('user management', () => {
  const newUser = { email: 'New.Hire@OpsDesk.local', fullName: 'Avery Quinn', role: 'employee', department: 'Finance', password: 'Welcome-to-opsdesk-1' };

  test('admin creates a user (email normalized, password hashed, audited)', async () => {
    const res = await admin.post('/api/admin/users').send(newUser);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.email, 'new.hire@opsdesk.local');
    const row = (await query('SELECT password_hash FROM users WHERE id = $1', [res.body.data.id])).rows[0];
    assert.match(row.password_hash, /^\$2[aby]\$12\$/);
    assert.notEqual(row.password_hash, newUser.password);
    const audit = await query(`SELECT metadata FROM audit_logs WHERE action = 'user.created' AND resource_id = $1`, [res.body.data.id]);
    assert.equal(JSON.stringify(audit.rows[0].metadata).includes(newUser.password), false);
  });

  test('duplicate emails are rejected', async () => {
    assert.equal((await admin.post('/api/admin/users').send(newUser)).status, 409);
  });

  test('weak passwords and invalid roles are rejected', async () => {
    const res = await admin.post('/api/admin/users').send({ ...newUser, email: 'x@opsdesk.local', password: 'short', role: 'superuser' });
    assert.equal(res.status, 422);
  });

  test('deactivating a user signs them out immediately', async () => {
    const created = (await admin.post('/api/admin/users').send({ ...newUser, email: 'leaver@opsdesk.local' })).body.data;
    const leaver = await signIn('leaver@opsdesk.local', newUser.password);
    assert.equal((await leaver.get('/api/auth/me')).status, 200);

    const res = await admin.patch(`/api/admin/users/${created.id}`).send({ isActive: false });
    assert.equal(res.body.data.isActive, false);
    assert.equal((await leaver.get('/api/auth/me')).status, 401);
    const again = await client();
    assert.equal((await again.post('/api/auth/login').send({ email: 'leaver@opsdesk.local', password: newUser.password })).status, 401);
  });

  test('role changes take effect on the next request', async () => {
    const created = (await admin.post('/api/admin/users').send({ ...newUser, email: 'promoted@opsdesk.local' })).body.data;
    const user = await signIn('promoted@opsdesk.local', newUser.password);
    assert.equal((await user.get('/api/users/directory')).status, 403);
    await admin.patch(`/api/admin/users/${created.id}`).send({ role: 'it_support' });
    assert.equal((await user.get('/api/users/directory')).status, 200);
  });

  test('admins cannot demote or deactivate themselves', async () => {
    assert.equal((await admin.patch(`/api/admin/users/${admin.user.id}`).send({ role: 'employee' })).status, 400);
    assert.equal((await admin.patch(`/api/admin/users/${admin.user.id}`).send({ isActive: false })).status, 400);
  });

  test('user list supports search and role filters', async () => {
    const res = await admin.get('/api/admin/users?role=it_support');
    assert.ok(res.body.data.length >= 2 && res.body.data.every((u) => u.role === 'it_support'));
    const search = await admin.get('/api/admin/users?search=carter');
    assert.equal(search.body.data[0].email, EMAILS.employee);
  });
});

describe('audit logs', () => {
  test('audit log captures logins and changes and is filterable', async () => {
    const res = await admin.get('/api/admin/audit-logs?action=auth.login&pageSize=5');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data.every((e) => e.action === 'auth.login' && e.actor));
    const actions = await admin.get('/api/admin/audit-logs/actions');
    assert.ok(actions.body.data.includes('user.created'));
  });

  test('audit entries cannot be modified or deleted, even directly in the database', async () => {
    await assert.rejects(query(`UPDATE audit_logs SET action = 'tampered'`), /append-only/);
    await assert.rejects(query(`DELETE FROM audit_logs`), /append-only/);
    await assert.rejects(query(`TRUNCATE audit_logs`), /append-only/);
  });

  test('there is no API to change audit entries', async () => {
    const entry = (await query('SELECT id FROM audit_logs LIMIT 1')).rows[0];
    assert.equal((await admin.patch(`/api/admin/audit-logs/${entry.id}`).send({ action: 'x' })).status, 404);
    assert.equal((await admin.delete(`/api/admin/audit-logs/${entry.id}`)).status, 404);
  });
});

describe('dashboards and reports reflect the database', () => {
  test('admin dashboard numbers match SQL counts', async () => {
    const res = await admin.get('/api/dashboard');
    const s = res.body.data.stats;
    const db = (await query(`SELECT count(*) AS total, count(*) FILTER (WHERE status = 'open') AS open, count(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved FROM tickets`)).rows[0];
    assert.equal(s.totalTickets, db.total);
    assert.equal(s.openTickets, db.open);
    assert.equal(s.resolvedTickets, db.resolved);
    assert.equal(s.totalEmployees, (await query(`SELECT count(*) AS n FROM users WHERE role = 'employee' AND is_active`)).rows[0].n);
    assert.ok(typeof s.averageResolutionHours === 'number');
  });

  test('dashboards update when a ticket is created', async () => {
    const before = (await employee.get('/api/dashboard')).body.data.stats.openTickets;
    await employee.post('/api/tickets').send({ subject: 'Dashboard counter test', description: 'Checking that counts are live.', category: 'other' });
    const afterCount = (await employee.get('/api/dashboard')).body.data.stats.openTickets;
    assert.equal(afterCount, before + 1);
  });

  test('IT support dashboard shows their queue', async () => {
    const res = await support.get('/api/dashboard');
    const s = res.body.data.stats;
    const db = (await query(`SELECT count(*) AS n FROM tickets WHERE assignee_id = $1 AND status IN ('open','in_progress','waiting_for_employee')`, [support.user.id])).rows[0];
    assert.equal(s.assignedTickets, db.n);
    assert.ok(s.unassignedTickets >= 1);
  });

  test('ticket report groupings add up to the total for the range', async () => {
    const summary = (await admin.get('/api/reports/summary?from=2025-01-01')).body.data;
    const report = (await admin.get('/api/reports/tickets?from=2025-01-01&interval=month')).body.data;
    const sum = (rows) => rows.reduce((n, r) => n + r.count, 0);
    assert.equal(sum(report.byCategory), summary.tickets.total);
    assert.equal(sum(report.byStatus), summary.tickets.total);
    assert.equal(sum(report.byPriority), summary.tickets.total);
    assert.equal(report.trend.reduce((n, r) => n + r.created, 0), summary.tickets.total);
    assert.ok(report.perStaff.some((p) => p.fullName === 'Jordan Reyes' && p.assigned > 0));
  });

  test('report date validation', async () => {
    assert.equal((await admin.get('/api/reports/summary?from=2000-01-01')).status, 400, 'ranges over two years are rejected');
    assert.equal((await admin.get('/api/reports/summary?from=2026-12-01&to=2026-01-01')).status, 400);
    assert.equal((await admin.get('/api/reports/summary?from=yesterday')).status, 422);
  });
});

describe('profile', () => {
  test('users can update their own profile name but not their role', async () => {
    const res = await employee.patch('/api/auth/me').send({ fullName: 'Sam J. Carter', role: 'admin' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.fullName, 'Sam J. Carter');
    assert.equal(res.body.data.user.role, 'employee');
  });

  test('seeded demo password works for all demo roles', async () => {
    for (const email of [EMAILS.admin, EMAILS.support, EMAILS.employee]) await signIn(email, TEST_PASSWORD);
  });
});
