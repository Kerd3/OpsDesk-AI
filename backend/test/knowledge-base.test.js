import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { signIn, resetAndSeed, pool, query, EMAILS } from './helpers.js';

let employee, support, admin, draft, archived;

before(async () => {
  await resetAndSeed();
  [employee, support, admin] = await Promise.all([signIn(EMAILS.employee), signIn(EMAILS.support), signIn(EMAILS.admin)]);
  draft = (await query(`SELECT * FROM knowledge_base_articles WHERE status = 'draft' LIMIT 1`)).rows[0];
  archived = (await query(`SELECT * FROM knowledge_base_articles WHERE status = 'archived' LIMIT 1`)).rows[0];
});
after(() => pool.end());

const article = (overrides = {}) => ({
  title: 'How to pair a Bluetooth headset',
  description: 'Pair a company-issued headset with your laptop.',
  content: 'Open Settings > Bluetooth & devices, choose Add device and select the headset while it is in pairing mode.',
  category: 'hardware',
  tags: ['bluetooth', 'Headset', 'headset'],
  ...overrides,
});

describe('knowledge base access', () => {
  test('employees can list and view published articles', async () => {
    const list = await employee.get('/api/knowledge-base?pageSize=50');
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length >= 8);
    assert.ok(list.body.data.every((a) => a.status === 'published'));

    const one = await employee.get(`/api/knowledge-base/${list.body.data[0].slug}`);
    assert.equal(one.status, 200);
    assert.ok(one.body.data.content.length > 50);
    assert.ok(Array.isArray(one.body.data.related));
  });

  test('employees cannot access unpublished articles — even by id, slug or status filter', async () => {
    for (const a of [draft, archived]) {
      assert.equal((await employee.get(`/api/knowledge-base/${a.id}`)).status, 404);
      assert.equal((await employee.get(`/api/knowledge-base/${a.slug}`)).status, 404);
    }
    const filtered = await employee.get('/api/knowledge-base?status=draft&pageSize=50');
    assert.ok(filtered.body.data.every((a) => a.status === 'published'));
    const search = await employee.get('/api/knowledge-base?search=imaging');
    assert.equal(search.body.data.some((a) => a.id === draft.id), false);
  });

  test('IT staff can see drafts', async () => {
    const res = await support.get('/api/knowledge-base?status=draft');
    assert.ok(res.body.data.some((a) => a.id === draft.id));
    assert.equal((await support.get(`/api/knowledge-base/${draft.id}`)).status, 200);
  });

  test('full-text search ranks the relevant article first', async () => {
    const res = await employee.get(`/api/knowledge-base?search=${encodeURIComponent('printer offline')}`);
    assert.equal(res.body.data[0].slug, 'troubleshoot-office-printer');
  });

  test('category filter', async () => {
    const res = await employee.get('/api/knowledge-base?category=network&pageSize=50');
    assert.ok(res.body.data.length >= 2);
    assert.ok(res.body.data.every((a) => a.category === 'network'));
  });

  test('viewing a published article increments its view count, editor loads (view=0) do not', async () => {
    const before = (await query(`SELECT view_count FROM knowledge_base_articles WHERE slug = 'connect-to-office-wifi'`)).rows[0].view_count;
    await employee.get('/api/knowledge-base/connect-to-office-wifi');
    await support.get('/api/knowledge-base/connect-to-office-wifi?view=0');
    const afterCount = (await query(`SELECT view_count FROM knowledge_base_articles WHERE slug = 'connect-to-office-wifi'`)).rows[0].view_count;
    assert.equal(afterCount, before + 1);
  });
});

describe('knowledge base management', () => {
  test('employees cannot create, edit or delete articles', async () => {
    assert.equal((await employee.post('/api/knowledge-base').send(article())).status, 403);
    const any = (await query(`SELECT id FROM knowledge_base_articles LIMIT 1`)).rows[0];
    assert.equal((await employee.patch(`/api/knowledge-base/${any.id}`).send({ title: 'Changed by employee' })).status, 403);
    assert.equal((await employee.delete(`/api/knowledge-base/${any.id}`)).status, 403);
  });

  test('IT staff create a draft article with a generated slug and normalized tags', async () => {
    const res = await support.post('/api/knowledge-base').send(article());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.slug, 'how-to-pair-a-bluetooth-headset');
    assert.equal(res.body.data.status, 'draft');
    assert.deepEqual(res.body.data.tags, ['bluetooth', 'headset']);
    assert.equal(res.body.data.author.fullName, 'Jordan Reyes');

    const dup = await support.post('/api/knowledge-base').send(article());
    assert.equal(dup.body.data.slug, 'how-to-pair-a-bluetooth-headset-2');
  });

  test('publish, unpublish and archive are audited and control employee visibility', async () => {
    const created = (await support.post('/api/knowledge-base').send(article({ title: 'Publishing lifecycle article' }))).body.data;
    assert.equal((await employee.get(`/api/knowledge-base/${created.id}`)).status, 404);

    const published = await support.patch(`/api/knowledge-base/${created.id}`).send({ status: 'published' });
    assert.equal(published.body.data.status, 'published');
    assert.ok(published.body.data.publishedAt);
    assert.equal((await employee.get(`/api/knowledge-base/${created.id}`)).status, 200);

    await support.patch(`/api/knowledge-base/${created.id}`).send({ status: 'draft' });
    assert.equal((await employee.get(`/api/knowledge-base/${created.id}`)).status, 404);

    const del = await support.delete(`/api/knowledge-base/${created.id}`);
    assert.equal(del.body.data.archived, true);

    const actions = (await query(`SELECT action FROM audit_logs WHERE resource_id = $1 ORDER BY created_at`, [created.id])).rows.map((r) => r.action);
    assert.deepEqual(actions, ['kb.article_created', 'kb.article_published', 'kb.article_unpublished', 'kb.article_archived']);
  });

  test('only administrators can permanently delete, and only archived articles', async () => {
    const created = (await support.post('/api/knowledge-base').send(article({ title: 'Article to delete permanently' }))).body.data;
    assert.equal((await admin.delete(`/api/knowledge-base/${created.id}?permanent=true`)).status, 409);
    await support.delete(`/api/knowledge-base/${created.id}`);
    assert.equal((await support.delete(`/api/knowledge-base/${created.id}?permanent=true`)).status, 403);
    const res = await admin.delete(`/api/knowledge-base/${created.id}?permanent=true`);
    assert.equal(res.status, 200);
    assert.equal((await query('SELECT 1 FROM knowledge_base_articles WHERE id = $1', [created.id])).rowCount, 0);
  });

  test('article validation', async () => {
    const res = await support.post('/api/knowledge-base').send({ title: 'x', content: 'short', category: 'nope', tags: 'not-an-array' });
    assert.equal(res.status, 422);
    const fields = res.body.error.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['category', 'content', 'tags', 'title']);
  });
});
