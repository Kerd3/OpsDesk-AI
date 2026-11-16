import { query } from '../../database/pool.js';
import { ROLES } from '../../utils/constants.js';
import { listTickets } from '../tickets/tickets.service.js';

const ACTIVE = "('open', 'in_progress', 'waiting_for_employee')";
const DONE = "('resolved', 'closed')";

async function recentActivity({ where = '', params = [], includeInternal = true, limit = 8 }) {
  const { rows } = await query(
    `SELECT ta.id, ta.action, ta.from_value, ta.to_value, ta.created_at,
            t.id AS ticket_id, t.ticket_number, t.subject, u.full_name AS actor_name
       FROM ticket_activity ta
       JOIN tickets t ON t.id = ta.ticket_id
       LEFT JOIN users u ON u.id = ta.actor_id
      WHERE true ${includeInternal ? '' : 'AND NOT ta.is_internal'} ${where}
      ORDER BY ta.created_at DESC LIMIT ${limit}`,
    params,
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    from: r.from_value,
    to: r.to_value,
    createdAt: r.created_at,
    actorName: r.actor_name,
    ticket: { id: r.ticket_id, ticketNumber: r.ticket_number, subject: r.subject },
  }));
}

async function adminDashboard(user) {
  const [counts, resolution, employees, byCategory, assets, activity, latest] = await Promise.all([
    query(`SELECT count(*) AS total,
                  count(*) FILTER (WHERE status = 'open') AS open,
                  count(*) FILTER (WHERE status = 'in_progress') AS in_progress,
                  count(*) FILTER (WHERE status = 'waiting_for_employee') AS waiting,
                  count(*) FILTER (WHERE status IN ${DONE}) AS resolved,
                  count(*) FILTER (WHERE assignee_id IS NULL AND status IN ${ACTIVE}) AS unassigned
             FROM tickets`),
    query(`SELECT avg(extract(epoch FROM (resolved_at - created_at)) / 3600) AS avg_hours FROM tickets WHERE resolved_at IS NOT NULL`),
    query(`SELECT count(*) AS n FROM users WHERE role = 'employee' AND is_active`),
    query(`SELECT category AS key, count(*) AS count FROM tickets GROUP BY category ORDER BY count DESC`),
    query(`SELECT status AS key, count(*) AS count FROM assets GROUP BY status ORDER BY count DESC`),
    recentActivity({}),
    listTickets(user, { pageSize: 5, sort: 'created' }),
  ]);
  const c = counts.rows[0];
  const avg = resolution.rows[0].avg_hours;
  return {
    role: user.role,
    stats: {
      totalEmployees: employees.rows[0].n,
      totalTickets: c.total,
      openTickets: c.open,
      inProgressTickets: c.in_progress,
      waitingTickets: c.waiting,
      resolvedTickets: c.resolved,
      unassignedTickets: c.unassigned,
      averageResolutionHours: avg == null ? null : Number(avg.toFixed(1)),
    },
    ticketsByCategory: byCategory.rows,
    assetsByStatus: assets.rows,
    recentActivity: activity,
    recentTickets: latest.items,
  };
}

async function supportDashboard(user) {
  const [counts, activity, queue] = await Promise.all([
    query(
      `SELECT count(*) FILTER (WHERE assignee_id = $1 AND status IN ${ACTIVE}) AS assigned,
              count(*) FILTER (WHERE assignee_id IS NULL AND status IN ${ACTIVE}) AS unassigned,
              count(*) FILTER (WHERE priority = 'urgent' AND status IN ${ACTIVE} AND (assignee_id = $1 OR assignee_id IS NULL)) AS urgent,
              count(*) FILTER (WHERE assignee_id = $1 AND status = 'waiting_for_employee') AS pending,
              count(*) FILTER (WHERE assignee_id = $1 AND status IN ${DONE}) AS resolved,
              count(*) FILTER (WHERE assignee_id = $1 AND status IN ${DONE} AND resolved_at >= now() - interval '7 days') AS resolved_this_week
         FROM tickets`,
      [user.id],
    ),
    recentActivity({ where: 'AND (t.assignee_id = $1 OR t.assignee_id IS NULL)', params: [user.id] }),
    listTickets(user, { pageSize: 6, sort: 'priority', order: 'desc', status: ['open', 'in_progress', 'waiting_for_employee'] }),
  ]);
  const c = counts.rows[0];
  return {
    role: user.role,
    stats: {
      assignedTickets: c.assigned,
      unassignedTickets: c.unassigned,
      urgentTickets: c.urgent,
      pendingTickets: c.pending,
      resolvedTickets: c.resolved,
      resolvedThisWeek: c.resolved_this_week,
    },
    queue: queue.items,
    recentActivity: activity,
  };
}

async function employeeDashboard(user) {
  const [counts, recent, popular, assets] = await Promise.all([
    query(
      `SELECT count(*) FILTER (WHERE status IN ('open', 'in_progress')) AS open,
              count(*) FILTER (WHERE status = 'waiting_for_employee') AS pending,
              count(*) FILTER (WHERE status IN ${DONE}) AS resolved
         FROM tickets WHERE requester_id = $1`,
      [user.id],
    ),
    listTickets(user, { pageSize: 5, sort: 'updated' }),
    query(`SELECT id, slug, title, description, category, view_count FROM knowledge_base_articles WHERE status = 'published' ORDER BY view_count DESC, title LIMIT 5`),
    query(`SELECT count(*) AS n FROM assets WHERE assigned_to_id = $1`, [user.id]),
  ]);
  const c = counts.rows[0];
  return {
    role: user.role,
    stats: { openTickets: c.open, pendingTickets: c.pending, resolvedTickets: c.resolved, assignedAssets: assets.rows[0].n },
    recentTickets: recent.items,
    popularArticles: popular.rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, description: r.description, category: r.category, viewCount: r.view_count })),
  };
}

/**
 * Notification feed for the top bar: recent activity by OTHER people on
 * tickets the user is involved in. Employees never see internal activity.
 */
export async function getNotifications(user) {
  if (user.role === ROLES.EMPLOYEE) {
    return recentActivity({ where: 'AND t.requester_id = $1 AND ta.actor_id IS DISTINCT FROM $1', params: [user.id], includeInternal: false, limit: 15 });
  }
  if (user.role === ROLES.IT_SUPPORT) {
    return recentActivity({
      where: `AND (t.assignee_id = $1 OR (t.assignee_id IS NULL AND ta.action = 'created')) AND ta.actor_id IS DISTINCT FROM $1`,
      params: [user.id],
      limit: 15,
    });
  }
  return recentActivity({ where: `AND ta.action IN ('created', 'status_changed', 'assigned') AND ta.actor_id IS DISTINCT FROM $1`, params: [user.id], limit: 15 });
}

export function getDashboard(user) {
  if (user.role === ROLES.ADMIN) return adminDashboard(user);
  if (user.role === ROLES.IT_SUPPORT) return supportDashboard(user);
  return employeeDashboard(user);
}
