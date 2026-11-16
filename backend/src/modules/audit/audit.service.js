import { query } from '../../database/pool.js';
import { SqlConditions, getPagination, paginationMeta } from '../../utils/pagination.js';

/**
 * Append an audit entry. Pass `db` (a transaction client) to make the entry
 * part of the same transaction as the change it records.
 * Metadata must never contain passwords, tokens or message bodies.
 */
export async function recordAudit({ actorId, action, resourceType, resourceId = null, metadata = {} }, db = { query }) {
  await db.query(
    `INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId ?? null, action, resourceType, resourceId == null ? null : String(resourceId), metadata],
  );
}

export async function listAuditLogs(filters) {
  const pagination = getPagination(filters, 25);
  const c = new SqlConditions();
  if (filters.action) c.add('a.action = ?', filters.action);
  if (filters.resourceType) c.add('a.resource_type = ?', filters.resourceType);
  if (filters.actorId) c.add('a.actor_id = ?', filters.actorId);
  if (filters.from) c.add('a.created_at >= ?', filters.from);
  if (filters.to) c.add("a.created_at < (?::date + interval '1 day')", filters.to);
  if (filters.search) {
    const p = c.param(`%${filters.search}%`);
    c.clauses.push(`(a.action ILIKE ${p} OR a.resource_id ILIKE ${p} OR u.full_name ILIKE ${p} OR u.email ILIKE ${p})`);
  }

  const where = c.where();
  const total = (await query(`SELECT count(*) AS n FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ${where}`, c.params))
    .rows[0].n;
  const { rows } = await query(
    `SELECT a.id, a.action, a.resource_type, a.resource_id, a.metadata, a.created_at,
            u.id AS actor_id, u.full_name AS actor_name, u.email AS actor_email, u.role AS actor_role
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       ${where}
      ORDER BY a.created_at DESC
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    c.params,
  );

  const items = rows.map((r) => ({
    id: r.id,
    action: r.action,
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    metadata: r.metadata,
    createdAt: r.created_at,
    actor: r.actor_id ? { id: r.actor_id, fullName: r.actor_name, email: r.actor_email, role: r.actor_role } : null,
  }));
  return { items, meta: paginationMeta(pagination, total) };
}

export async function listAuditActions() {
  const { rows } = await query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  return rows.map((r) => r.action);
}
