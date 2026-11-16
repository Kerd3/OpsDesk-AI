import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { signIn, resetAndSeed, pool, query, EMAILS, userId, ticketOf } from './helpers.js';

let employee, employee2, support, support2, admin;

before(async () => {
  await resetAndSeed();
  [employee, employee2, support, support2, admin] = await Promise.all([
    signIn(EMAILS.employee),
    signIn(EMAILS.employee2),
    signIn(EMAILS.support),
    signIn(EMAILS.support2),
    signIn(EMAILS.admin),
  ]);
});
after(() => pool.end());

const newTicket = (overrides = {}) => ({
  subject: 'Docking station not detecting monitors',
  description: 'When I plug my laptop into the docking station neither external monitor turns on.',
  category: 'hardware',
  priority: 'medium',
  ...overrides,
});

describe('ticket creation', () => {
  test('employee creates a ticket with a readable id, persisted in PostgreSQL with history', async () => {
    const res = await employee.post('/api/tickets').send(newTicket());
    assert.equal(res.status, 201);
    const t = res.body.data;
    assert.match(t.ticketNumber, /^OPS-\d{4}-\d{4}$/);
    assert.equal(t.status, 'open');
    assert.equal(t.requester.email, EMAILS.employee);
    assert.equal(t.assignee, null);

    const db = await query('SELECT * FROM tickets WHERE id = $1', [t.id]);
    assert.equal(db.rows[0].subject, 'Docking station not detecting monitors');

    const activity = await query('SELECT action FROM ticket_activity WHERE ticket_id = $1', [t.id]);
    assert.deepEqual(activity.rows.map((r) => r.action), ['created']);

    const audit = await query(`SELECT 1 FROM audit_logs WHERE action = 'ticket.created' AND resource_id = $1`, [t.id]);
    assert.equal(audit.rowCount, 1);
  });

  test('ticket numbers are sequential and unique under concurrent creation', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => employee.post('/api/tickets').send(newTicket({ subject: `Concurrent ticket ${i}` }))));
    const numbers = results.map((r) => r.body.data.ticketNumber);
    assert.equal(new Set(numbers).size, 5);
  });

  test('validation rejects missing and invalid fields', async () => {
    const res = await employee.post('/api/tickets').send({ subject: 'x', category: 'coffee' });
    assert.equal(res.status, 422);
    const fields = res.body.error.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['category', 'description', 'subject']);
  });

  test('employees cannot file tickets on behalf of someone else', async () => {
    const res = await employee.post('/api/tickets').send(newTicket({ requesterId: await userId(EMAILS.employee2) }));
    assert.equal(res.status, 403);
  });

  test('HTML in ticket text is stored as plain text (escaped by the UI, never executed)', async () => {
    const res = await employee.post('/api/tickets').send(newTicket({ subject: '<img src=x onerror=alert(1)>' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.subject, '<img src=x onerror=alert(1)>');
    assert.match(res.headers['content-type'], /application\/json/);
  });
});

describe('ticket visibility', () => {
  test('employee list contains only their own tickets', async () => {
    const res = await employee.get('/api/tickets?pageSize=100');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data.every((t) => t.requester.email === EMAILS.employee));
    // "scope=all" cannot widen an employee's view.
    const all = await employee.get('/api/tickets?scope=all&pageSize=100');
    assert.ok(all.body.data.every((t) => t.requester.email === EMAILS.employee));
  });

  test("employee cannot open another employee's ticket by id or by ticket number", async () => {
    const other = await ticketOf(EMAILS.employee2);
    for (const id of [other.id, other.ticket_number]) {
      const res = await employee.get(`/api/tickets/${id}`);
      assert.equal(res.status, 404, `GET ${id}`);
      assert.equal((await employee.get(`/api/tickets/${id}/activity`)).status, 404);
      assert.equal((await employee.post(`/api/tickets/${id}/comments`).send({ body: 'hi' })).status, 404);
      assert.equal((await employee.patch(`/api/tickets/${id}`).send({ subject: 'Hijacked subject' })).status, 404);
    }
  });

  test('requester filter cannot be used by employees to read other people\'s tickets', async () => {
    const res = await employee.get(`/api/tickets?requesterId=${await userId(EMAILS.employee2)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0);
  });

  test('administrator can access all tickets', async () => {
    const res = await admin.get('/api/tickets?pageSize=100');
    const total = (await query('SELECT count(*) AS n FROM tickets')).rows[0].n;
    assert.equal(res.body.meta.total, total);
    const other = await ticketOf(EMAILS.employee2);
    assert.equal((await admin.get(`/api/tickets/${other.id}`)).status, 200);
  });

  test('IT support sees tickets assigned to them and unassigned tickets, but not tickets assigned to colleagues', async () => {
    const supportId = await userId(EMAILS.support);
    const res = await support.get('/api/tickets?pageSize=100');
    assert.ok(res.body.data.every((t) => t.assignee === null || t.assignee.id === supportId || t.requester.id === supportId));

    const colleagues = (await query(`SELECT t.id FROM tickets t JOIN users u ON u.id = t.assignee_id WHERE u.email = $1 LIMIT 1`, [EMAILS.support2])).rows[0];
    assert.equal((await support.get(`/api/tickets/${colleagues.id}`)).status, 404);
  });

  test('invalid identifiers are rejected cleanly', async () => {
    assert.equal((await employee.get('/api/tickets/not-a-uuid')).status, 422);
    assert.equal((await employee.get("/api/tickets/1' OR '1'='1")).status, 422);
  });

  test('search, filters, sorting and pagination', async () => {
    const page = await admin.get('/api/tickets?pageSize=3&page=2&sort=number&order=asc');
    assert.equal(page.status, 200);
    assert.equal(page.body.data.length, 3);
    assert.equal(page.body.meta.page, 2);
    const nums = page.body.data.map((t) => t.ticketNumber);
    assert.deepEqual([...nums].sort(), nums);

    const filtered = await admin.get('/api/tickets?status=open,in_progress&priority=urgent&pageSize=100');
    assert.ok(filtered.body.data.length >= 1);
    assert.ok(filtered.body.data.every((t) => ['open', 'in_progress'].includes(t.status) && t.priority === 'urgent'));

    const search = await admin.get(`/api/tickets?search=${encodeURIComponent('warehouse network')}`);
    assert.ok(search.body.data.some((t) => t.subject === 'Whole warehouse lost network connection'));

    const injection = await admin.get(`/api/tickets?search=${encodeURIComponent("'; DROP TABLE tickets; --")}`);
    assert.equal(injection.status, 200);
    assert.equal((await query('SELECT count(*) AS n FROM tickets')).rows[0].n > 0, true);

    const bad = await admin.get('/api/tickets?status=deleted');
    assert.equal(bad.status, 422);

    const dated = await admin.get('/api/tickets?from=2000-01-01&to=2000-01-31');
    assert.equal(dated.body.meta.total, 0);
  });
});

describe('ticket updates and permissions', () => {
  test('employee cannot change restricted fields', async () => {
    const own = await ticketOf(EMAILS.employee, "status = 'open'");
    for (const patch of [{ priority: 'urgent' }, { assigneeId: await userId(EMAILS.support) }, { category: 'network' }, { status: 'resolved' }]) {
      const res = await employee.patch(`/api/tickets/${own.id}`).send(patch);
      assert.equal(res.status, 403, JSON.stringify(patch));
    }
    const unchanged = (await query('SELECT priority, assignee_id, status FROM tickets WHERE id = $1', [own.id])).rows[0];
    assert.equal(unchanged.priority, own.priority);
    assert.equal(unchanged.assignee_id, null);
    assert.equal(unchanged.status, 'open');
  });

  test('employee can edit the subject of their own open ticket', async () => {
    const own = await ticketOf(EMAILS.employee, "status = 'open'");
    const res = await employee.patch(`/api/tickets/${own.id}`).send({ subject: 'Excel crashes opening the 80 MB ledger export' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.subject, 'Excel crashes opening the 80 MB ledger export');
  });

  test('unknown fields in the body are ignored, not applied', async () => {
    const own = await ticketOf(EMAILS.employee, "status = 'open'");
    const res = await employee.patch(`/api/tickets/${own.id}`).send({ subject: 'Excel crash with large files', requester_id: await userId(EMAILS.employee2), status_internal: 'x' });
    assert.equal(res.status, 200);
    const row = (await query('SELECT requester_id FROM tickets WHERE id = $1', [own.id])).rows[0];
    assert.equal(row.requester_id, own.requester_id);
  });

  test('IT staff must accept an unassigned ticket before changing it', async () => {
    const unassigned = (await query(`SELECT id FROM tickets WHERE assignee_id IS NULL AND status = 'open' ORDER BY created_at LIMIT 1`)).rows[0];
    const denied = await support.patch(`/api/tickets/${unassigned.id}`).send({ status: 'in_progress' });
    assert.equal(denied.status, 403);

    const accept = await support.patch(`/api/tickets/${unassigned.id}`).send({ assigneeId: support.user.id, status: 'in_progress' });
    assert.equal(accept.status, 200);
    assert.equal(accept.body.data.assignee.id, support.user.id);
    assert.equal(accept.body.data.status, 'in_progress');

    const actions = (await query('SELECT action FROM ticket_activity WHERE ticket_id = $1 ORDER BY created_at, id', [unassigned.id])).rows.map((r) => r.action);
    assert.ok(actions.includes('assigned') && actions.includes('status_changed'));
  });

  test('IT staff can update tickets assigned to them, including status, priority and resolution', async () => {
    const mine = (await query(`SELECT id FROM tickets WHERE assignee_id = $1 AND status = 'in_progress' LIMIT 1`, [support.user.id])).rows[0];
    const res = await support.patch(`/api/tickets/${mine.id}`).send({ priority: 'high', status: 'resolved' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'resolved');
    assert.ok(res.body.data.resolvedAt);

    const audits = (await query(`SELECT action FROM audit_logs WHERE resource_id = $1`, [mine.id])).rows.map((r) => r.action);
    assert.ok(audits.includes('ticket.status_changed') && audits.includes('ticket.priority_changed'));
  });

  test('IT staff cannot update a ticket assigned to a colleague', async () => {
    const theirs = (await query(`SELECT id FROM tickets WHERE assignee_id = $1 LIMIT 1`, [support2.user.id])).rows[0];
    const res = await support.patch(`/api/tickets/${theirs.id}`).send({ status: 'closed' });
    assert.equal(res.status, 404);
  });

  test('tickets can only be assigned to active staff', async () => {
    const t = await ticketOf(EMAILS.employee2);
    const res = await admin.patch(`/api/tickets/${t.id}`).send({ assigneeId: await userId(EMAILS.employee) });
    assert.equal(res.status, 400);
  });

  test('administrator can reassign and unassign', async () => {
    const t = await ticketOf(EMAILS.employee2, 'assignee_id IS NOT NULL');
    const re = await admin.patch(`/api/tickets/${t.id}`).send({ assigneeId: support.user.id });
    assert.equal(re.body.data.assignee.id, support.user.id);
    const un = await admin.patch(`/api/tickets/${t.id}`).send({ assigneeId: null });
    assert.equal(un.status, 200);
    assert.equal(un.body.data.assignee, null);
  });

  test('requester confirms a resolution (close) or reopens a resolved ticket', async () => {
    const created = (await employee.post('/api/tickets').send(newTicket({ subject: 'Ticket to resolve and reopen' }))).body.data;
    await admin.patch(`/api/tickets/${created.id}`).send({ assigneeId: support.user.id, status: 'resolved' });

    const reopen = await employee.patch(`/api/tickets/${created.id}`).send({ status: 'open' });
    assert.equal(reopen.status, 200);
    assert.equal(reopen.body.data.resolvedAt, null);

    await support.patch(`/api/tickets/${created.id}`).send({ status: 'resolved' });
    const close = await employee.patch(`/api/tickets/${created.id}`).send({ status: 'closed' });
    assert.equal(close.status, 200);
    assert.ok(close.body.data.closedAt);

    // Closed tickets no longer accept employee comments or edits.
    assert.equal((await employee.post(`/api/tickets/${created.id}/comments`).send({ body: 'One more thing' })).status, 409);
    assert.equal((await employee.patch(`/api/tickets/${created.id}`).send({ status: 'open' })).status, 403);
  });
});

describe('comments and internal notes', () => {
  test('internal notes are never visible to employees', async () => {
    // Seed ticket OPS-xxxx-0001 has an internal note on Sam Carter's Wi-Fi ticket.
    const own = await ticketOf(EMAILS.employee, "subject ILIKE '%Wi-Fi%'");
    const staffView = await admin.get(`/api/tickets/${own.id}`);
    assert.ok(staffView.body.data.comments.some((c) => c.isInternal));
    assert.ok(staffView.body.data.activity.some((a) => a.action === 'internal_note_added'));

    const employeeView = await employee.get(`/api/tickets/${own.id}`);
    assert.equal(employeeView.status, 200);
    assert.ok(employeeView.body.data.comments.length > 0);
    assert.equal(employeeView.body.data.comments.some((c) => c.isInternal), false);
    assert.equal(JSON.stringify(employeeView.body).includes('corrupted after the certificate rotation'), false);

    const activity = await employee.get(`/api/tickets/${own.id}/activity`);
    assert.equal(activity.body.data.some((a) => a.isInternal || a.action === 'internal_note_added'), false);
  });

  test('employees cannot add internal notes', async () => {
    const own = await ticketOf(EMAILS.employee, "status = 'open'");
    const res = await employee.post(`/api/tickets/${own.id}/comments`).send({ body: 'Sneaky note', isInternal: true });
    assert.equal(res.status, 403);
  });

  test('staff add internal notes and public replies; employee replies are recorded', async () => {
    const t = (await employee.post('/api/tickets').send(newTicket({ subject: 'Comment flow ticket' }))).body.data;
    await admin.patch(`/api/tickets/${t.id}`).send({ assigneeId: support.user.id });

    const note = await support.post(`/api/tickets/${t.id}/comments`).send({ body: 'Checked asset history; dock firmware outdated.', isInternal: true });
    assert.equal(note.status, 201);
    assert.equal(note.body.data.isInternal, true);

    const reply = await support.post(`/api/tickets/${t.id}/comments`).send({ body: 'Can you tell me the dock model?' });
    assert.equal(reply.body.data.isInternal, false);

    const empReply = await employee.post(`/api/tickets/${t.id}/comments`).send({ body: 'It is the USB-C universal dock.' });
    assert.equal(empReply.status, 201);

    const view = await employee.get(`/api/tickets/${t.id}`);
    assert.deepEqual(view.body.data.comments.map((c) => c.body), ['Can you tell me the dock model?', 'It is the USB-C universal dock.']);
  });

  test('a requester reply moves a "waiting for employee" ticket back to in progress', async () => {
    const waiting = await ticketOf(EMAILS.employee, "status = 'waiting_for_employee'");
    const res = await employee.post(`/api/tickets/${waiting.id}/comments`).send({ body: 'My manager approved this request.' });
    assert.equal(res.status, 201);
    const row = (await query('SELECT status FROM tickets WHERE id = $1', [waiting.id])).rows[0];
    assert.equal(row.status, 'in_progress');
  });
});

describe('notifications feed', () => {
  test("employees are notified about others' activity on their tickets, never internal notes", async () => {
    const t = (await employee.post('/api/tickets').send(newTicket({ subject: 'Notification feed ticket' }))).body.data;
    await admin.patch(`/api/tickets/${t.id}`).send({ assigneeId: support.user.id });
    await support.post(`/api/tickets/${t.id}/comments`).send({ body: 'Secret triage detail', isInternal: true });
    await support.post(`/api/tickets/${t.id}/comments`).send({ body: 'Looking into it now.' });

    const res = await employee.get('/api/notifications');
    assert.equal(res.status, 200);
    const mine = res.body.data.filter((n) => n.ticket.id === t.id);
    assert.ok(mine.some((n) => n.action === 'comment_added'));
    assert.ok(mine.some((n) => n.action === 'assigned'));
    assert.equal(mine.some((n) => n.action === 'internal_note_added'), false);
    assert.equal(mine.some((n) => n.action === 'created'), false, 'own actions are not notifications');
    assert.ok(res.body.data.every((n) => n.ticket.id !== undefined));

    const others = await employee2.get('/api/notifications');
    assert.equal(others.body.data.some((n) => n.ticket.id === t.id), false);
  });
});
