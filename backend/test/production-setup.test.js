import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetAndSeed, pool, query, signIn } from './helpers.js';
import { createAdmin, validateAdminInput } from '../src/database/create-admin.js';
import { seedKnowledgeBase } from '../src/database/seed-knowledge-base.js';

before(resetAndSeed);
after(() => pool.end());

describe('create-admin script', () => {
  test('rejects invalid input with every problem listed', () => {
    const problems = validateAdminInput({ email: 'not-an-email', fullName: 'A', password: 'short' });
    assert.equal(problems.length, 3);
    assert.deepEqual(validateAdminInput({ email: 'a@b.co', fullName: 'Al', password: 'only-letters-here' }).length, 1);
  });

  test('creates an administrator who can sign in; the email is normalized and the password hashed', async () => {
    const password = 'Owner-password-2026';
    const user = await createAdmin({ email: 'Owner@Example.COM ', fullName: ' Site Owner ', password });
    assert.equal(user.email, 'owner@example.com');
    assert.equal(user.role, 'admin');
    assert.equal(user.fullName, 'Site Owner');
    const row = (await query('SELECT password_hash FROM users WHERE id = $1', [user.id])).rows[0];
    assert.notEqual(row.password_hash, password);
    const owner = await signIn('owner@example.com', password);
    assert.equal((await owner.get('/api/admin/users')).status, 200);
  });

  test('refuses to overwrite an existing account', async () => {
    await assert.rejects(createAdmin({ email: 'owner@example.com', fullName: 'Someone Else', password: 'Another-password-1' }), /already exists/);
  });
});

describe('seed-knowledge-base script', () => {
  test('publishes the sample articles once, without demo accounts, and is safe to re-run', async () => {
    await query('DELETE FROM knowledge_base_articles');
    const usersBefore = (await query('SELECT count(*) AS n FROM users')).rows[0].n;

    const first = await seedKnowledgeBase({ log: () => {} });
    assert.equal(first.created, 9);
    const rows = (await query('SELECT status FROM knowledge_base_articles')).rows;
    assert.equal(rows.length, 9);
    assert.ok(rows.every((r) => r.status === 'published'), 'drafts and archived samples are not loaded');

    const second = await seedKnowledgeBase({ log: () => {} });
    assert.deepEqual(second, { created: 0, skipped: 9 });
    assert.equal((await query('SELECT count(*) AS n FROM users')).rows[0].n, usersBefore, 'no accounts are created');
  });
});
