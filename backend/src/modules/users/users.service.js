import bcrypt from 'bcrypt';
import { query, withTransaction } from '../../database/pool.js';
import { recordAudit } from '../audit/audit.service.js';
import { SqlConditions, getPagination, paginationMeta } from '../../utils/pagination.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';

export const BCRYPT_ROUNDS = 12;

export function toUserDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    department: row.department,
    jobTitle: row.job_title,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at,
  };
}

const USER_COLUMNS = 'id, email, full_name, role, department, job_title, is_active, last_login_at, created_at';

export async function getUserById(id) {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  if (!rows[0]) throw notFound('User');
  return toUserDto(rows[0]);
}

export async function listUsers(filters) {
  const pagination = getPagination(filters, 25);
  const c = new SqlConditions();
  if (filters.role) c.add('role = ?', filters.role);
  if (filters.status === 'active') c.add('is_active = true');
  if (filters.status === 'inactive') c.add('is_active = false');
  if (filters.search) {
    const p = c.param(`%${filters.search}%`);
    c.clauses.push(`(full_name ILIKE ${p} OR email ILIKE ${p} OR department ILIKE ${p})`);
  }
  const where = c.where();
  const total = (await query(`SELECT count(*) AS n FROM users ${where}`, c.params)).rows[0].n;
  const { rows } = await query(
    `SELECT ${USER_COLUMNS},
            (SELECT count(*) FROM tickets t WHERE t.requester_id = users.id) AS ticket_count,
            (SELECT count(*) FROM assets a WHERE a.assigned_to_id = users.id) AS asset_count
       FROM users ${where}
      ORDER BY is_active DESC, full_name
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    c.params,
  );
  return {
    items: rows.map((r) => ({ ...toUserDto(r), ticketCount: r.ticket_count, assetCount: r.asset_count })),
    meta: paginationMeta(pagination, total),
  };
}

/** Lightweight directory used by pickers (assignee, asset owner). Staff-only routes call this. */
export async function listDirectory({ roles }) {
  const { rows } = await query(
    `SELECT id, full_name, email, role, department FROM users
      WHERE is_active AND role = ANY($1::text[]) ORDER BY full_name`,
    [roles],
  );
  return rows.map((r) => ({ id: r.id, fullName: r.full_name, email: r.email, role: r.role, department: r.department }));
}

export async function createUser(input, actorId) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  return withTransaction(async (db) => {
    const existing = await db.query('SELECT 1 FROM users WHERE email = $1', [input.email]);
    if (existing.rowCount) throw conflict('A user with this email address already exists');
    const { rows } = await db.query(
      `INSERT INTO users (email, full_name, password_hash, role, department, job_title)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${USER_COLUMNS}`,
      [input.email, input.fullName, passwordHash, input.role, input.department ?? null, input.jobTitle ?? null],
    );
    const user = toUserDto(rows[0]);
    await recordAudit(
      { actorId, action: 'user.created', resourceType: 'user', resourceId: user.id, metadata: { email: user.email, role: user.role } },
      db,
    );
    return user;
  });
}

export async function updateUser(id, input, actor) {
  if (id === actor.id && (input.role !== undefined || input.isActive === false)) {
    throw badRequest('You cannot change your own role or deactivate your own account');
  }
  const passwordHash = input.password ? await bcrypt.hash(input.password, BCRYPT_ROUNDS) : null;

  return withTransaction(async (db) => {
    const current = (await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!current) throw notFound('User');

    const fields = { full_name: input.fullName, role: input.role, department: input.department, job_title: input.jobTitle, is_active: input.isActive };
    const sets = [];
    const params = [id];
    const changes = {};
    for (const [column, value] of Object.entries(fields)) {
      if (value === undefined || value === current[column]) continue;
      params.push(value);
      sets.push(`${column} = $${params.length}`);
      changes[column] = { from: current[column], to: value };
    }
    if (passwordHash) {
      params.push(passwordHash);
      sets.push(`password_hash = $${params.length}`);
      changes.password = 'reset'; // never log the value
    }
    if (!sets.length) return toUserDto(current);

    const { rows } = await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING ${USER_COLUMNS}`, params);

    // Deactivated users lose their sessions immediately.
    if (input.isActive === false || passwordHash) {
      await db.query(`DELETE FROM "session" WHERE sess->>'userId' = $1`, [id]);
    }
    const action = input.isActive === false ? 'user.deactivated' : input.isActive === true && !current.is_active ? 'user.reactivated' : 'user.updated';
    await recordAudit({ actorId: actor.id, action, resourceType: 'user', resourceId: id, metadata: { changes } }, db);
    return toUserDto(rows[0]);
  });
}
