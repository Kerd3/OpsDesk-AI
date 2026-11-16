import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { signIn, resetAndSeed, pool, query, EMAILS, userId } from './helpers.js';

let employee, support, admin;

before(async () => {
  await resetAndSeed();
  [employee, support, admin] = await Promise.all([signIn(EMAILS.employee), signIn(EMAILS.support), signIn(EMAILS.admin)]);
});
after(() => pool.end());

const asset = (overrides = {}) => ({
  name: 'ThinkPad X1 Carbon',
  category: 'laptop',
  manufacturer: 'Lenovo',
  model: 'X1 Carbon Gen 12',
  serialNumber: `TEST-${Math.random().toString(36).slice(2, 10)}`,
  location: 'IT storage room',
  purchaseDate: '2026-01-15',
  condition: 'new',
  ...overrides,
});

describe('asset visibility', () => {
  test('employees only see equipment assigned to them', async () => {
    const res = await employee.get('/api/assets');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
    assert.ok(res.body.data.every((a) => a.assignedTo?.email === EMAILS.employee));
  });

  test("employees cannot open someone else's asset", async () => {
    const other = (await query(`SELECT s.id FROM assets s JOIN users u ON u.id = s.assigned_to_id WHERE u.email = $1 LIMIT 1`, [EMAILS.employee2])).rows[0];
    assert.equal((await employee.get(`/api/assets/${other.id}`)).status, 404);
  });

  test('staff see all assets with filters and search', async () => {
    const all = await support.get('/api/assets?pageSize=100');
    assert.equal(all.body.meta.total, (await query('SELECT count(*) AS n FROM assets')).rows[0].n);

    const laptops = await support.get('/api/assets?category=laptop&status=assigned');
    assert.ok(laptops.body.data.every((a) => a.category === 'laptop' && a.status === 'assigned'));

    const search = await support.get('/api/assets?search=DEMO-CSC');
    assert.equal(search.body.data[0].category, 'router');
  });
});

describe('asset management', () => {
  test('employees cannot create or modify assets', async () => {
    assert.equal((await employee.post('/api/assets').send(asset())).status, 403);
    const mine = (await employee.get('/api/assets')).body.data[0];
    assert.equal((await employee.patch(`/api/assets/${mine.id}`).send({ condition: 'new' })).status, 403);
  });

  test('IT staff register an asset with a readable asset tag', async () => {
    const res = await support.post('/api/assets').send(asset());
    assert.equal(res.status, 201);
    assert.match(res.body.data.assetTag, /^AST-\d{4}$/);
    assert.equal(res.body.data.status, 'available');
    assert.equal(res.body.data.purchaseDate, '2026-01-15');
    const audit = await query(`SELECT 1 FROM audit_logs WHERE action = 'asset.created' AND resource_id = $1`, [res.body.data.id]);
    assert.equal(audit.rowCount, 1);
  });

  test('assign, reassign, maintenance and unassign keep status consistent', async () => {
    const created = (await support.post('/api/assets').send(asset())).body.data;
    const empId = await userId(EMAILS.employee);
    const emp2Id = await userId(EMAILS.employee2);

    const assigned = await support.patch(`/api/assets/${created.id}`).send({ assignedToId: empId });
    assert.equal(assigned.body.data.status, 'assigned');
    assert.equal(assigned.body.data.assignedTo.id, empId);
    // The new owner can now see it.
    assert.equal((await employee.get(`/api/assets/${created.id}`)).status, 200);

    const reassigned = await admin.patch(`/api/assets/${created.id}`).send({ assignedToId: emp2Id });
    assert.equal(reassigned.body.data.assignedTo.id, emp2Id);
    assert.equal((await employee.get(`/api/assets/${created.id}`)).status, 404);

    const maintenance = await support.patch(`/api/assets/${created.id}`).send({ status: 'under_maintenance', notes: 'Keyboard replacement' });
    assert.equal(maintenance.body.data.status, 'under_maintenance');
    assert.equal(maintenance.body.data.assignedTo, null);

    const detail = await support.get(`/api/assets/${created.id}`);
    const actions = detail.body.data.history.map((h) => h.action);
    for (const a of ['registered', 'assigned', 'reassigned', 'unassigned', 'status_changed', 'updated']) assert.ok(actions.includes(a), a);

    const audits = (await query(`SELECT action FROM audit_logs WHERE resource_id = $1`, [created.id])).rows.map((r) => r.action);
    assert.ok(audits.includes('asset.assigned') && audits.includes('asset.reassigned'));
  });

  test('cannot mark an asset assigned without an assignee or assign to inactive users', async () => {
    const created = (await support.post('/api/assets').send(asset())).body.data;
    assert.equal((await support.patch(`/api/assets/${created.id}`).send({ status: 'assigned' })).status, 400);
    assert.equal((await support.patch(`/api/assets/${created.id}`).send({ assignedToId: await userId(EMAILS.inactive) })).status, 400);
  });

  test('duplicate serial numbers are rejected with 409', async () => {
    const res = await support.post('/api/assets').send(asset({ serialNumber: 'DEMO-LNV-0001' }));
    assert.equal(res.status, 409);
  });

  test('validation rejects bad categories and future purchase dates', async () => {
    const res = await support.post('/api/assets').send(asset({ category: 'spaceship', purchaseDate: '2999-01-01' }));
    assert.equal(res.status, 422);
    const fields = res.body.error.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['category', 'purchaseDate']);
  });

  test('clearing optional text fields with an empty string stores NULL', async () => {
    const created = (await support.post('/api/assets').send(asset())).body.data;
    const res = await support.patch(`/api/assets/${created.id}`).send({ location: '', manufacturer: null });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.location, null);
    assert.equal(res.body.data.manufacturer, null);
  });
});
