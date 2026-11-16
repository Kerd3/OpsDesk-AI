import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { config } from '../config/env.js';
import { pool, withTransaction } from './pool.js';
import { DEMO_USERS, DEMO_ARTICLES, DEMO_TICKETS, DEMO_ASSETS } from './seed-data.js';

const HOUR = 3600 * 1000;

/**
 * Loads FICTIONAL demo data for local development and tests.
 * Refuses to run in production or against a database that already has users.
 */
export async function seed({ password = config.seedDemoPassword, log = console.log, now = new Date() } = {}) {
  if (config.isProduction) throw new Error('Refusing to seed demo data in production');
  if (!password || password.length < 10) {
    throw new Error('Set SEED_DEMO_PASSWORD (at least 10 characters) in .env before seeding demo accounts');
  }

  await withTransaction(async (db) => {
    const existing = await db.query('SELECT count(*) AS n FROM users');
    if (existing.rows[0].n > 0) {
      throw new Error('The database already contains users. Run `npm run db:reset` to wipe and re-seed it.');
    }

    // ----- Users (one shared local-only password) -----
    const hash = await bcrypt.hash(password, 10);
    const users = {};
    for (const u of DEMO_USERS) {
      const { rows } = await db.query(
        `INSERT INTO users (email, full_name, password_hash, role, department, job_title, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, full_name, email`,
        [u.email, u.fullName, hash, u.role, u.department, u.jobTitle, u.isActive ?? true, new Date(now.getTime() - 90 * 24 * HOUR)],
      );
      users[u.key] = rows[0];
    }

    // ----- Knowledge base -----
    for (const [i, a] of DEMO_ARTICLES.entries()) {
      const status = a.status ?? 'published';
      const created = new Date(now.getTime() - (80 - i * 3) * 24 * HOUR);
      await db.query(
        `INSERT INTO knowledge_base_articles (slug, title, description, content, category, tags, status, author_id, updated_by_id, view_count, published_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $11)`,
        [a.slug, a.title, a.description, a.content, a.category, a.tags, status, i % 2 ? users.support2.id : users.support.id, status === 'published' ? 40 - i * 4 : 0, status === 'published' ? created : null, created],
      );
    }

    // ----- Tickets, comments and activity -----
    const counters = {};
    for (const t of DEMO_TICKETS) {
      const created = new Date(now.getTime() - t.daysAgo * 24 * HOUR - 6 * HOUR);
      const at = (hours) => new Date(created.getTime() + hours * HOUR);
      const year = created.getUTCFullYear();
      counters[year] = (counters[year] ?? 0) + 1;
      const number = `OPS-${year}-${String(counters[year]).padStart(4, '0')}`;
      const requester = users[t.requester];
      const assignee = t.assignee ? users[t.assignee] : null;
      const resolvedAt = t.resolvedAfterHours ? at(t.resolvedAfterHours) : null;
      const closedAt = t.status === 'closed' ? at(t.resolvedAfterHours + 24) : null;
      const updatedAt = closedAt ?? resolvedAt ?? (t.comments?.length ? at(t.comments.length + 1) : created);

      const { rows } = await db.query(
        `INSERT INTO tickets (ticket_number, subject, description, category, priority, status, requester_id, assignee_id, resolved_at, closed_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [number, t.subject, t.description, t.category, t.priority, t.status, requester.id, assignee?.id ?? null, resolvedAt, closedAt, created, updatedAt],
      );
      const ticketId = rows[0].id;
      const activity = (actorId, action, from, to, when, isInternal = false, metadata = {}) =>
        db.query(
          `INSERT INTO ticket_activity (ticket_id, actor_id, action, from_value, to_value, is_internal, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [ticketId, actorId, action, from, to, isInternal, metadata, when],
        );

      await activity(requester.id, 'created', null, 'open', created, false, { source: 'portal', seed: true });
      if (assignee) {
        await activity(assignee.id, 'assigned', null, assignee.full_name, at(0.5), false, { toId: assignee.id });
        if (t.status !== 'open') await activity(assignee.id, 'status_changed', 'open', 'in_progress', at(0.6));
      }
      for (const [ci, c] of (t.comments ?? []).entries()) {
        const author = users[c.author];
        const when = at(ci + 1);
        const { rows: cr } = await db.query(
          `INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`,
          [ticketId, author.id, c.body, Boolean(c.internal), when],
        );
        await activity(author.id, c.internal ? 'internal_note_added' : 'comment_added', null, null, when, Boolean(c.internal), { commentId: cr[0].id });
      }
      if (t.status === 'waiting_for_employee') await activity(assignee.id, 'status_changed', 'in_progress', 'waiting_for_employee', at((t.comments?.length ?? 0) + 1.1));
      if (resolvedAt) await activity(assignee.id, 'status_changed', 'in_progress', 'resolved', resolvedAt);
      if (closedAt) await activity(requester.id, 'status_changed', 'resolved', 'closed', closedAt);
    }
    for (const [year, value] of Object.entries(counters)) {
      await db.query('INSERT INTO ticket_counters (year, last_value) VALUES ($1, $2)', [Number(year), value]);
    }

    // ----- IT assets -----
    for (const a of DEMO_ASSETS) {
      const assignee = a.assignee ? users[a.assignee] : null;
      const status = a.status ?? (assignee ? 'assigned' : 'available');
      const { rows } = await db.query(
        `INSERT INTO assets (name, category, manufacturer, model, serial_number, assigned_to_id, location, purchase_date, condition, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [a.name, a.category, a.manufacturer, a.model, a.serial, assignee?.id ?? null, a.location, a.purchaseDate, a.condition, status, a.notes ?? 'Fictional demo asset.'],
      );
      await db.query(`INSERT INTO asset_events (asset_id, actor_id, action, details, created_at) VALUES ($1, $2, 'registered', $3, $4)`, [rows[0].id, users.admin.id, { status, seed: true }, new Date(a.purchaseDate)]);
      if (assignee) {
        await db.query(`INSERT INTO asset_events (asset_id, actor_id, action, details, created_at) VALUES ($1, $2, 'assigned', $3, $4)`, [rows[0].id, users.support.id, { toId: assignee.id, toName: assignee.full_name }, new Date(a.purchaseDate)]);
      }
    }

    await db.query(
      `INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, metadata) VALUES ($1, 'system.demo_data_seeded', 'system', NULL, $2)`,
      [users.admin.id, { users: DEMO_USERS.length, articles: DEMO_ARTICLES.length, tickets: DEMO_TICKETS.length, assets: DEMO_ASSETS.length, fictional: true }],
    );
  });

  log(`[seed] fictional demo data loaded: ${DEMO_USERS.length} users, ${DEMO_ARTICLES.length} articles, ${DEMO_TICKETS.length} tickets, ${DEMO_ASSETS.length} assets`);
  log('[seed] demo sign-ins: admin@opsdesk.local, support@opsdesk.local, employee@opsdesk.local (password = SEED_DEMO_PASSWORD)');
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  try {
    await seed();
  } catch (err) {
    console.error(`[seed] ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
