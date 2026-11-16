import { config } from '../../config/env.js';
import { query, withTransaction } from '../../database/pool.js';
import { recordAudit } from '../audit/audit.service.js';
import { enqueueEvent, scheduleDelivery } from '../integrations/webhook.service.js';
import { SqlConditions, getPagination, paginationMeta } from '../../utils/pagination.js';
import { STAFF_ROLES, ROLES } from '../../utils/constants.js';
import { badRequest, forbidden } from '../../utils/errors.js';
import { visibilityCondition, assertCanView, assertCanUpdate, assertCanComment, canSeeInternal } from './tickets.policy.js';

const TICKET_NUMBER_RE = /^OPS-\d{4}-\d{4,}$/;

const TICKET_SELECT = `
  SELECT t.*,
         r.full_name AS requester_name, r.email AS requester_email, r.department AS requester_department,
         a.full_name AS assignee_name, a.email AS assignee_email
    FROM tickets t
    JOIN users r ON r.id = t.requester_id
    LEFT JOIN users a ON a.id = t.assignee_id`;

export function toTicketDto(row) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    subject: row.subject,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    source: row.source,
    requester: { id: row.requester_id, fullName: row.requester_name, email: row.requester_email, department: row.requester_department },
    assignee: row.assignee_id ? { id: row.assignee_id, fullName: row.assignee_name, email: row.assignee_email } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    ...(row.comment_count !== undefined ? { commentCount: row.comment_count } : {}),
  };
}

/** Minimal payload for automation: no description or comment text leaves the system. */
function eventData(ticket, extra = {}) {
  return {
    ticketId: ticket.id,
    ticketNumber: ticket.ticket_number,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    url: `${config.appBaseUrl}/tickets/${ticket.id}`,
    requester: { name: ticket.requester_name, email: ticket.requester_email },
    assignee: ticket.assignee_id ? { name: ticket.assignee_name, email: ticket.assignee_email } : null,
    ...extra,
  };
}

async function loadTicket(db, idOrNumber, { forUpdate = false } = {}) {
  const column = TICKET_NUMBER_RE.test(idOrNumber) ? 't.ticket_number' : 't.id';
  // FOR UPDATE OF t locks only the ticket row, not the joined users.
  const { rows } = await db.query(`${TICKET_SELECT} WHERE ${column} = $1 ${forUpdate ? 'FOR UPDATE OF t' : ''}`, [idOrNumber]);
  return rows[0] ?? null;
}

async function nextTicketNumber(db) {
  const year = new Date().getUTCFullYear();
  // The upsert takes a row lock, so concurrent inserts get distinct numbers.
  const { rows } = await db.query(
    `INSERT INTO ticket_counters (year, last_value) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_value = ticket_counters.last_value + 1
     RETURNING last_value`,
    [year],
  );
  return `OPS-${year}-${String(rows[0].last_value).padStart(4, '0')}`;
}

async function addActivity(db, ticketId, actorId, action, { from = null, to = null, isInternal = false, metadata = {} } = {}) {
  const { rows } = await db.query(
    `INSERT INTO ticket_activity (ticket_id, actor_id, action, from_value, to_value, is_internal, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [ticketId, actorId, action, from, to, isInternal, metadata],
  );
  return rows[0].id;
}

async function assertAssignableStaff(db, userId) {
  const { rows } = await db.query('SELECT role, is_active FROM users WHERE id = $1', [userId]);
  if (!rows[0] || !rows[0].is_active || !STAFF_ROLES.includes(rows[0].role)) {
    throw badRequest('Tickets can only be assigned to active IT support staff or administrators');
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const SORTS = {
  created: 't.created_at',
  updated: 't.updated_at',
  number: 't.ticket_number',
  priority: "array_position(ARRAY['low','medium','high','urgent'], t.priority)",
  status: "array_position(ARRAY['open','in_progress','waiting_for_employee','resolved','closed'], t.status)",
};

export async function listTickets(user, filters) {
  const pagination = getPagination(filters, 20);
  const c = new SqlConditions();
  visibilityCondition(user, c);

  if (filters.scope === 'mine') c.add('t.requester_id = ?', user.id);
  if (filters.scope === 'assigned') c.add('t.assignee_id = ?', user.id);
  if (filters.scope === 'unassigned') c.add('t.assignee_id IS NULL');
  if (filters.status?.length) c.add('t.status = ANY(?::text[])', filters.status);
  if (filters.priority?.length) c.add('t.priority = ANY(?::text[])', filters.priority);
  if (filters.category?.length) c.add('t.category = ANY(?::text[])', filters.category);
  if (filters.assigneeId) c.add('t.assignee_id = ?', filters.assigneeId);
  if (filters.requesterId) c.add('t.requester_id = ?', filters.requesterId);
  if (filters.from) c.add('t.created_at >= ?::date', filters.from);
  if (filters.to) c.add("t.created_at < (?::date + interval '1 day')", filters.to);
  if (filters.search) {
    const p = c.param(filters.search);
    const like = c.param(`%${filters.search}%`);
    c.clauses.push(`(t.search_vector @@ websearch_to_tsquery('english', ${p}) OR t.ticket_number ILIKE ${like} OR t.subject ILIKE ${like})`);
  }

  const where = c.where();
  const sortColumn = SORTS[filters.sort] ?? SORTS.created;
  const direction = filters.order === 'asc' ? 'ASC' : 'DESC';

  const total = (await query(`SELECT count(*) AS n FROM tickets t ${where}`, c.params)).rows[0].n;
  const { rows } = await query(
    `${TICKET_SELECT.replace('SELECT t.*,', `SELECT t.*, (SELECT count(*) FROM ticket_comments cm WHERE cm.ticket_id = t.id ${canSeeInternal(user) ? '' : 'AND NOT cm.is_internal'}) AS comment_count,`)}
     ${where}
     ORDER BY ${sortColumn} ${direction}, t.created_at DESC
     LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    c.params,
  );
  return { items: rows.map(toTicketDto), meta: paginationMeta(pagination, total) };
}

export async function getTicket(user, idOrNumber) {
  const row = await loadTicket({ query }, idOrNumber);
  assertCanView(user, row);
  const ticket = toTicketDto(row);
  const [comments, activity] = await Promise.all([listComments(user, row.id), listActivityRows(user, row.id)]);
  return {
    ...ticket,
    comments,
    activity,
    permissions: describePermissions(user, row),
  };
}

/** Tells the UI which controls to show. The API still re-checks every action. */
function describePermissions(user, ticket) {
  const isAdmin = user.role === ROLES.ADMIN;
  const isAssignedStaff = user.role === ROLES.IT_SUPPORT && ticket.assignee_id === user.id;
  const isRequester = ticket.requester_id === user.id;
  const staffManage = isAdmin || isAssignedStaff;
  return {
    canManage: staffManage,
    canAccept: user.role === ROLES.IT_SUPPORT && ticket.assignee_id === null,
    canAssign: isAdmin || isAssignedStaff,
    canEditDetails: staffManage || (isRequester && !['resolved', 'closed'].includes(ticket.status)),
    canAddInternalNote: canSeeInternal(user),
    canComment: canSeeInternal(user) || ticket.status !== 'closed',
    canConfirmResolution: isRequester && ticket.status === 'resolved',
  };
}

async function listComments(user, ticketId) {
  const { rows } = await query(
    `SELECT c.id, c.body, c.is_internal, c.created_at, u.id AS author_id, u.full_name, u.role
       FROM ticket_comments c JOIN users u ON u.id = c.author_id
      WHERE c.ticket_id = $1 ${canSeeInternal(user) ? '' : 'AND NOT c.is_internal'}
      ORDER BY c.created_at`,
    [ticketId],
  );
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    isInternal: r.is_internal,
    createdAt: r.created_at,
    author: { id: r.author_id, fullName: r.full_name, role: r.role },
  }));
}

async function listActivityRows(user, ticketId) {
  const { rows } = await query(
    `SELECT ta.id, ta.action, ta.from_value, ta.to_value, ta.is_internal, ta.metadata, ta.created_at,
            u.id AS actor_id, u.full_name AS actor_name, u.role AS actor_role
       FROM ticket_activity ta LEFT JOIN users u ON u.id = ta.actor_id
      WHERE ta.ticket_id = $1 ${canSeeInternal(user) ? '' : 'AND NOT ta.is_internal'}
      ORDER BY ta.created_at, ta.id`,
    [ticketId],
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    from: r.from_value,
    to: r.to_value,
    isInternal: r.is_internal,
    metadata: r.metadata,
    createdAt: r.created_at,
    actor: r.actor_id ? { id: r.actor_id, fullName: r.actor_name, role: r.actor_role } : null,
  }));
}

export async function getTicketActivity(user, idOrNumber) {
  const row = await loadTicket({ query }, idOrNumber);
  assertCanView(user, row);
  return listActivityRows(user, row.id);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function createTicket(user, input) {
  const isStaffUser = canSeeInternal(user);
  if (input.requesterId && !isStaffUser) throw forbidden('Only IT staff can create tickets on behalf of another user');

  const ticket = await withTransaction(async (db) => {
    const requesterId = input.requesterId ?? user.id;
    if (input.requesterId) {
      const r = await db.query('SELECT is_active FROM users WHERE id = $1', [requesterId]);
      if (!r.rows[0]?.is_active) throw badRequest('Requester must be an active user');
    }
    const ticketNumber = await nextTicketNumber(db);
    const { rows } = await db.query(
      `INSERT INTO tickets (ticket_number, subject, description, category, priority, source, requester_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [ticketNumber, input.subject, input.description, input.category, input.priority ?? 'medium', input.source ?? 'portal', requesterId],
    );
    const id = rows[0].id;
    await addActivity(db, id, user.id, 'created', { to: 'open', metadata: { source: input.source ?? 'portal' } });
    await recordAudit(
      { actorId: user.id, action: 'ticket.created', resourceType: 'ticket', resourceId: id, metadata: { ticketNumber, category: input.category, priority: input.priority ?? 'medium' } },
      db,
    );
    const created = await loadTicket(db, id);
    await enqueueEvent(db, { eventType: 'ticket.created', resourceType: 'ticket', resourceId: id, data: eventData(created), dedupeKey: `ticket.created:${id}` });
    return created;
  });

  scheduleDelivery();
  return toTicketDto(ticket);
}

const STATUS_TIMESTAMPS = {
  resolved: 'resolved_at = now(), closed_at = NULL',
  closed: 'closed_at = now(), resolved_at = COALESCE(resolved_at, now())',
  open: 'resolved_at = NULL, closed_at = NULL',
  in_progress: 'resolved_at = NULL, closed_at = NULL',
  waiting_for_employee: 'resolved_at = NULL, closed_at = NULL',
};

export async function updateTicket(user, idOrNumber, patch) {
  if (!Object.keys(patch).length) throw badRequest('No changes were provided');

  const updated = await withTransaction(async (db) => {
    const current = await loadTicket(db, idOrNumber, { forUpdate: true });
    assertCanUpdate(user, current, patch);
    if (patch.assigneeId) await assertAssignableStaff(db, patch.assigneeId);

    const columns = { subject: 'subject', description: 'description', category: 'category', priority: 'priority', status: 'status', assigneeId: 'assignee_id' };
    const sets = [];
    const params = [current.id];
    const changed = {};
    for (const [field, column] of Object.entries(columns)) {
      if (patch[field] === undefined || patch[field] === current[column]) continue;
      params.push(patch[field]);
      sets.push(`${column} = $${params.length}`);
      changed[field] = { from: current[column], to: patch[field] };
    }
    if (!sets.length) return { row: current, changed };
    if (changed.status) sets.push(STATUS_TIMESTAMPS[changed.status.to]);

    await db.query(`UPDATE tickets SET ${sets.join(', ')} WHERE id = $1`, params);
    const row = await loadTicket(db, current.id);

    // Activity history + audit trail + automation events, all in the same transaction.
    const audit = (action, metadata) =>
      recordAudit({ actorId: user.id, action, resourceType: 'ticket', resourceId: current.id, metadata: { ticketNumber: current.ticket_number, ...metadata } }, db);

    if (changed.status) {
      const activityId = await addActivity(db, current.id, user.id, 'status_changed', { from: changed.status.from, to: changed.status.to });
      await audit('ticket.status_changed', changed.status);
      await enqueueEvent(db, {
        eventType: 'ticket.status_changed',
        resourceType: 'ticket',
        resourceId: current.id,
        data: eventData(row, { change: changed.status }),
        dedupeKey: `ticket.status_changed:${activityId}`,
      });
      if (changed.status.to === 'resolved') {
        await enqueueEvent(db, { eventType: 'ticket.resolved', resourceType: 'ticket', resourceId: current.id, data: eventData(row), dedupeKey: `ticket.resolved:${activityId}` });
      }
    }
    if (changed.priority) {
      await addActivity(db, current.id, user.id, 'priority_changed', { from: changed.priority.from, to: changed.priority.to });
      await audit('ticket.priority_changed', changed.priority);
    }
    if (changed.category) {
      await addActivity(db, current.id, user.id, 'category_changed', { from: changed.category.from, to: changed.category.to });
      await audit('ticket.updated', { category: changed.category });
    }
    if (changed.assigneeId) {
      const to = changed.assigneeId.to;
      const activityId = await addActivity(db, current.id, user.id, to ? 'assigned' : 'unassigned', {
        from: current.assignee_name ?? null,
        to: row.assignee_name ?? null,
        metadata: { fromId: changed.assigneeId.from, toId: to },
      });
      await audit(to ? 'ticket.assigned' : 'ticket.unassigned', { fromId: changed.assigneeId.from, toId: to });
      if (to) {
        await enqueueEvent(db, { eventType: 'ticket.assigned', resourceType: 'ticket', resourceId: current.id, data: eventData(row), dedupeKey: `ticket.assigned:${activityId}` });
      }
    }
    if (changed.subject || changed.description) {
      await addActivity(db, current.id, user.id, 'details_updated', { metadata: { fields: Object.keys(changed).filter((f) => f === 'subject' || f === 'description') } });
      await audit('ticket.updated', { fields: ['subject', 'description'].filter((f) => changed[f]) });
    }
    return { row, changed };
  });

  scheduleDelivery();
  return toTicketDto(updated.row);
}

export async function addComment(user, idOrNumber, { body, isInternal = false }) {
  const result = await withTransaction(async (db) => {
    const ticket = await loadTicket(db, idOrNumber, { forUpdate: true });
    assertCanComment(user, ticket, isInternal);

    const { rows } = await db.query(
      `INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal) VALUES ($1, $2, $3, $4)
       RETURNING id, body, is_internal, created_at`,
      [ticket.id, user.id, body, isInternal],
    );
    await addActivity(db, ticket.id, user.id, isInternal ? 'internal_note_added' : 'comment_added', { isInternal, metadata: { commentId: rows[0].id } });
    await db.query('UPDATE tickets SET updated_at = now() WHERE id = $1', [ticket.id]);

    // When the requester replies to a ticket that was waiting on them, hand it back to IT.
    if (!isInternal && ticket.requester_id === user.id && ticket.status === 'waiting_for_employee') {
      await db.query(`UPDATE tickets SET status = 'in_progress' WHERE id = $1`, [ticket.id]);
      const activityId = await addActivity(db, ticket.id, user.id, 'status_changed', { from: 'waiting_for_employee', to: 'in_progress', metadata: { reason: 'requester_replied' } });
      const row = await loadTicket(db, ticket.id);
      await enqueueEvent(db, {
        eventType: 'ticket.status_changed',
        resourceType: 'ticket',
        resourceId: ticket.id,
        data: eventData(row, { change: { from: 'waiting_for_employee', to: 'in_progress' } }),
        dedupeKey: `ticket.status_changed:${activityId}`,
      });
    }
    return { ...rows[0], ticketId: ticket.id };
  });

  scheduleDelivery();
  return {
    id: result.id,
    body: result.body,
    isInternal: result.is_internal,
    createdAt: result.created_at,
    author: { id: user.id, fullName: user.full_name, role: user.role },
  };
}
