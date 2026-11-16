import { query } from '../../database/pool.js';
import { badRequest } from '../../utils/errors.js';

/** Resolve the reporting window. Defaults to the last 30 days (inclusive of today). */
export function resolveRange({ from, to } = {}) {
  const today = new Date();
  const toDate = to ?? today.toISOString().slice(0, 10);
  const fromDate = from ?? new Date(today.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  if (fromDate > toDate) throw badRequest('The start date must be before the end date');
  const days = (Date.parse(toDate) - Date.parse(fromDate)) / 86400000 + 1;
  if (days > 731) throw badRequest('The date range cannot exceed two years');
  return { from: fromDate, to: toDate, days };
}

// Tickets created inside [from, to] (to is inclusive, so compare against to + 1 day).
const IN_RANGE = "t.created_at >= $1::date AND t.created_at < ($2::date + interval '1 day')";

export async function getSummary(filters) {
  const range = resolveRange(filters);
  const params = [range.from, range.to];

  const [tickets, resolution, people, assets] = await Promise.all([
    query(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE status = 'open') AS open,
              count(*) FILTER (WHERE status = 'in_progress') AS in_progress,
              count(*) FILTER (WHERE status = 'waiting_for_employee') AS waiting,
              count(*) FILTER (WHERE status IN ('resolved', 'closed')) AS resolved,
              count(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('resolved', 'closed')) AS urgent_open,
              count(*) FILTER (WHERE assignee_id IS NULL AND status NOT IN ('resolved', 'closed')) AS unassigned
         FROM tickets t WHERE ${IN_RANGE}`,
      params,
    ),
    // Resolution time is measured on tickets RESOLVED inside the window.
    query(
      `SELECT avg(extract(epoch FROM (resolved_at - created_at)) / 3600) AS avg_hours,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (resolved_at - created_at)) / 3600) AS median_hours,
              count(*) AS n
         FROM tickets
        WHERE resolved_at >= $1::date AND resolved_at < ($2::date + interval '1 day')`,
      params,
    ),
    query(`SELECT count(*) FILTER (WHERE role = 'employee' AND is_active) AS employees, count(*) FILTER (WHERE role IN ('admin','it_support') AND is_active) AS staff FROM users`),
    query(`SELECT count(*) AS total, count(*) FILTER (WHERE status = 'assigned') AS assigned, count(*) FILTER (WHERE status = 'available') AS available, count(*) FILTER (WHERE status = 'under_maintenance') AS maintenance FROM assets WHERE status <> 'retired'`),
  ]);

  const t = tickets.rows[0];
  const r = resolution.rows[0];
  return {
    range,
    tickets: {
      total: t.total,
      open: t.open,
      inProgress: t.in_progress,
      waiting: t.waiting,
      resolved: t.resolved,
      urgentOpen: t.urgent_open,
      unassigned: t.unassigned,
    },
    resolution: {
      averageHours: r.avg_hours == null ? null : Number(r.avg_hours.toFixed(1)),
      medianHours: r.median_hours == null ? null : Number(r.median_hours.toFixed(1)),
      resolvedCount: r.n,
    },
    people: people.rows[0],
    assets: assets.rows[0],
  };
}

const INTERVALS = { day: '1 day', week: '1 week', month: '1 month' };

export async function getTicketReport(filters) {
  const range = resolveRange(filters);
  const interval = filters.interval ?? (range.days > 120 ? 'month' : range.days > 45 ? 'week' : 'day');
  const params = [range.from, range.to];
  const group = (column) =>
    query(`SELECT ${column} AS key, count(*) AS count FROM tickets t WHERE ${IN_RANGE} GROUP BY ${column} ORDER BY count DESC`, params);

  const [byCategory, byPriority, byStatus, perStaff, trend, assetsByCategory, assetsByStatus] = await Promise.all([
    group('category'),
    group('priority'),
    group('status'),
    query(
      `SELECT u.id, u.full_name, u.role,
              count(t.id) AS assigned,
              count(t.id) FILTER (WHERE t.status IN ('resolved', 'closed')) AS resolved,
              count(t.id) FILTER (WHERE t.status NOT IN ('resolved', 'closed')) AS active,
              avg(extract(epoch FROM (t.resolved_at - t.created_at)) / 3600) FILTER (WHERE t.resolved_at IS NOT NULL) AS avg_hours
         FROM users u
         LEFT JOIN tickets t ON t.assignee_id = u.id AND ${IN_RANGE}
        WHERE u.role IN ('admin', 'it_support') AND u.is_active
        GROUP BY u.id ORDER BY assigned DESC, u.full_name`,
      params,
    ),
    query(
      `WITH buckets AS (
         SELECT generate_series(date_trunc($3, $1::date), date_trunc($3, $2::date), $4::interval) AS bucket
       )
       SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
              (SELECT count(*) FROM tickets t WHERE date_trunc($3, t.created_at) = b.bucket AND ${IN_RANGE}) AS created,
              (SELECT count(*) FROM tickets t WHERE date_trunc($3, t.resolved_at) = b.bucket
                  AND t.resolved_at >= $1::date AND t.resolved_at < ($2::date + interval '1 day')) AS resolved
         FROM buckets b ORDER BY b.bucket`,
      [...params, interval, INTERVALS[interval]],
    ),
    query(`SELECT category AS key, count(*) AS count FROM assets GROUP BY category ORDER BY count DESC`),
    query(`SELECT status AS key, count(*) AS count FROM assets GROUP BY status ORDER BY count DESC`),
  ]);

  return {
    range: { ...range, interval },
    byCategory: byCategory.rows,
    byPriority: byPriority.rows,
    byStatus: byStatus.rows,
    perStaff: perStaff.rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      role: r.role,
      assigned: r.assigned,
      resolved: r.resolved,
      active: r.active,
      averageResolutionHours: r.avg_hours == null ? null : Number(r.avg_hours.toFixed(1)),
    })),
    trend: trend.rows,
    assets: { byCategory: assetsByCategory.rows, byStatus: assetsByStatus.rows },
  };
}
