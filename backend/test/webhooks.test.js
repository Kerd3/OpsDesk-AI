import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { signIn, resetAndSeed, pool, query, config, EMAILS } from './helpers.js';
import { processDueDeliveries, enqueueEvent, computeBackoffMs } from '../src/modules/integrations/webhook.service.js';
import { withTransaction } from '../src/database/pool.js';

const SECRET = 'test-webhook-secret';

/** Minimal n8n stand-in that verifies signatures and records event ids. */
function startReceiver() {
  const state = { requests: [], respondWith: 200, seen: new Set(), duplicates: 0 };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const ts = req.headers['x-opsdesk-timestamp'];
      const expected = `sha256=${crypto.createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex')}`;
      const eventId = req.headers['x-opsdesk-event-id'];
      if (state.seen.has(eventId)) state.duplicates += 1;
      state.seen.add(eventId);
      state.requests.push({ headers: req.headers, body: JSON.parse(body), validSignature: expected === req.headers['x-opsdesk-signature'] });
      res.writeHead(state.respondWith, { 'Content-Type': 'application/json' }).end('{}');
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, state, url: `http://127.0.0.1:${server.address().port}/webhook/opsdesk` })));
}

let employee, support, admin, receiver;

before(async () => {
  await resetAndSeed();
  receiver = await startReceiver();
  config.webhook.secret = SECRET;
  config.webhook.maxAttempts = 3;
  [employee, support, admin] = await Promise.all([signIn(EMAILS.employee), signIn(EMAILS.support), signIn(EMAILS.admin)]);
});
beforeEach(async () => {
  config.webhook.url = receiver.url;
  receiver.state.requests.length = 0;
  receiver.state.respondWith = 200;
  receiver.state.seen.clear();
  receiver.state.duplicates = 0;
  // Clear anything left over so each test inspects only its own deliveries.
  await query('DELETE FROM webhook_deliveries');
});
after(async () => {
  receiver.server.close();
  await pool.end();
});

const createTicket = (subject = 'Webhook test ticket') =>
  employee.post('/api/tickets').send({ subject, description: 'Testing automation events for new tickets.', category: 'software', priority: 'high' });

describe('event emission', () => {
  test('ticket creation queues a ticket.created event with minimal personal data', async () => {
    const res = await createTicket();
    assert.equal(res.status, 201);
    const { rows } = await query(`SELECT * FROM webhook_deliveries WHERE resource_id = $1`, [res.body.data.id]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].event_type, 'ticket.created');
    assert.equal(rows[0].status, 'pending');
    const data = rows[0].payload.data;
    assert.equal(data.ticketNumber, res.body.data.ticketNumber);
    assert.equal(data.requester.email, EMAILS.employee);
    assert.equal('description' in data, false, 'ticket description is not sent to automation');
    assert.equal(rows[0].payload.id, rows[0].event_id);
  });

  test('assignment, status change and resolution emit their events', async () => {
    const t = (await createTicket('Lifecycle events')).body.data;
    await support.patch(`/api/tickets/${t.id}`).send({ assigneeId: support.user.id, status: 'in_progress' });
    await support.patch(`/api/tickets/${t.id}`).send({ status: 'resolved' });
    const types = (await query(`SELECT event_type FROM webhook_deliveries WHERE resource_id = $1 ORDER BY created_at, event_type`, [t.id])).rows.map((r) => r.event_type).sort();
    assert.deepEqual(types, ['ticket.assigned', 'ticket.created', 'ticket.resolved', 'ticket.status_changed', 'ticket.status_changed']);
  });

  test('events disabled by an administrator are not queued', async () => {
    await admin.patch('/api/admin/settings/notifications').send({ events: { 'ticket.created': false } });
    const t = (await createTicket('No event please')).body.data;
    assert.equal((await query(`SELECT 1 FROM webhook_deliveries WHERE resource_id = $1`, [t.id])).rowCount, 0);
    await admin.patch('/api/admin/settings/notifications').send({ events: { 'ticket.created': true } });
    const audit = await query(`SELECT 1 FROM audit_logs WHERE action = 'integration.settings_updated'`);
    assert.ok(audit.rowCount >= 2);
  });

  test('when no webhook URL is configured, tickets still work and the event is recorded as skipped', async () => {
    config.webhook.url = '';
    const res = await createTicket('No n8n configured');
    assert.equal(res.status, 201);
    const row = (await query(`SELECT status, last_error FROM webhook_deliveries WHERE resource_id = $1`, [res.body.data.id])).rows[0];
    assert.equal(row.status, 'skipped');
    assert.match(row.last_error, /not configured/);
  });
});

describe('delivery', () => {
  test('delivers signed events with an idempotency key and records success', async () => {
    const t = (await createTicket()).body.data;
    await processDueDeliveries();
    assert.equal(receiver.state.requests.length, 1);
    const req = receiver.state.requests[0];
    assert.equal(req.validSignature, true);
    assert.equal(req.headers['x-opsdesk-event-type'], 'ticket.created');
    assert.equal(req.body.data.ticketId, t.id);

    const row = (await query(`SELECT * FROM webhook_deliveries WHERE resource_id = $1`, [t.id])).rows[0];
    assert.equal(row.status, 'delivered');
    assert.equal(row.attempts, 1);
    assert.equal(row.last_status_code, 200);
    assert.equal(req.headers['x-opsdesk-event-id'], row.event_id);
  });

  test('a failing receiver does not cancel ticket creation; failures are retried with backoff', async () => {
    receiver.state.respondWith = 500;
    const res = await createTicket('Receiver is failing');
    assert.equal(res.status, 201);
    assert.equal((await query('SELECT 1 FROM tickets WHERE id = $1', [res.body.data.id])).rowCount, 1);

    await processDueDeliveries();
    let row = (await query(`SELECT * FROM webhook_deliveries WHERE resource_id = $1`, [res.body.data.id])).rows[0];
    assert.equal(row.status, 'pending');
    assert.equal(row.attempts, 1);
    assert.equal(row.last_status_code, 500);
    assert.ok(new Date(row.next_attempt_at) > new Date(), 'next attempt is scheduled in the future');

    // Make the retries due immediately and exhaust the attempt budget.
    for (let i = 0; i < 2; i += 1) {
      await query(`UPDATE webhook_deliveries SET next_attempt_at = now() WHERE id = $1`, [row.id]);
      await processDueDeliveries();
    }
    row = (await query(`SELECT * FROM webhook_deliveries WHERE id = $1`, [row.id])).rows[0];
    assert.equal(row.status, 'failed');
    assert.equal(row.attempts, 3);
  });

  test('an unreachable receiver is handled the same way', async () => {
    config.webhook.url = 'http://127.0.0.1:9/unreachable';
    const res = await createTicket('Receiver is down');
    assert.equal(res.status, 201);
    await processDueDeliveries();
    const row = (await query(`SELECT * FROM webhook_deliveries WHERE resource_id = $1`, [res.body.data.id])).rows[0];
    assert.equal(row.status, 'pending');
    assert.match(row.last_error, /Network error|Timed out/);
  });

  test('client errors (4xx) are not retried', async () => {
    receiver.state.respondWith = 400;
    const res = await createTicket('Receiver rejects payload');
    await processDueDeliveries();
    const row = (await query(`SELECT status, attempts FROM webhook_deliveries WHERE resource_id = $1`, [res.body.data.id])).rows[0];
    assert.equal(row.status, 'failed');
    assert.equal(row.attempts, 1);
  });

  test('backoff grows exponentially and is capped', () => {
    assert.equal(computeBackoffMs(1), 30000);
    assert.equal(computeBackoffMs(2), 60000);
    assert.equal(computeBackoffMs(3), 120000);
    assert.equal(computeBackoffMs(50), 3600000);
  });
});

describe('duplicates and idempotency', () => {
  test('the same event cannot be queued twice', async () => {
    const t = (await createTicket('Dedupe')).body.data;
    const dup = await withTransaction((db) =>
      enqueueEvent(db, { eventType: 'ticket.created', resourceType: 'ticket', resourceId: t.id, data: {}, dedupeKey: `ticket.created:${t.id}` }),
    );
    assert.equal(dup, null);
    assert.equal((await query(`SELECT count(*) AS n FROM webhook_deliveries WHERE resource_id = $1`, [t.id])).rows[0].n, 1);
  });

  test('concurrent workers deliver each event exactly once', async () => {
    await Promise.all(Array.from({ length: 4 }, (_, i) => createTicket(`Concurrent delivery ${i}`)));
    await Promise.all([processDueDeliveries(), processDueDeliveries(), processDueDeliveries()]);
    assert.equal(receiver.state.requests.length, 4);
    assert.equal(receiver.state.duplicates, 0);
  });

  test('an admin retry re-sends a failed delivery with the SAME event id so receivers can de-duplicate', async () => {
    receiver.state.respondWith = 400;
    const t = (await createTicket('Retry me')).body.data;
    await processDueDeliveries();
    const failed = (await query(`SELECT * FROM webhook_deliveries WHERE resource_id = $1`, [t.id])).rows[0];
    assert.equal(failed.status, 'failed');

    receiver.state.respondWith = 200;
    const retry = await admin.post(`/api/admin/integrations/deliveries/${failed.id}/retry`);
    assert.equal(retry.status, 200);
    await processDueDeliveries();
    const row = (await query(`SELECT * FROM webhook_deliveries WHERE id = $1`, [failed.id])).rows[0];
    assert.equal(row.status, 'delivered');
    const ids = receiver.state.requests.map((r) => r.headers['x-opsdesk-event-id']);
    assert.deepEqual(ids, [failed.event_id, failed.event_id]);
    assert.equal(receiver.state.duplicates, 1, 'the receiver saw a duplicate it can ignore by event id');

    // Delivered events cannot be "retried" again.
    assert.equal((await admin.post(`/api/admin/integrations/deliveries/${failed.id}/retry`)).status, 409);
  });
});

describe('admin integration endpoints', () => {
  test('status reports configuration presence but never the secret', async () => {
    await createTicket('Status');
    const res = await admin.get('/api/admin/integrations');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.webhook.configured, true);
    assert.equal(res.body.data.webhook.host, new URL(receiver.url).host);
    assert.equal(JSON.stringify(res.body).includes(SECRET), false);
  });

  test('delivery list and test event', async () => {
    const test = await admin.post('/api/admin/integrations/test');
    assert.equal(test.status, 200);
    assert.equal(test.body.data.status, 'delivered');
    const list = await admin.get('/api/admin/integrations/deliveries?status=delivered');
    assert.ok(list.body.data.some((d) => d.eventType === 'integration.test'));
  });

  test('non-admins cannot access integration endpoints', async () => {
    assert.equal((await support.get('/api/admin/integrations')).status, 403);
    assert.equal((await employee.post('/api/admin/integrations/test')).status, 403);
  });
});
