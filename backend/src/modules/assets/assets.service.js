import { query, withTransaction } from '../../database/pool.js';
import { recordAudit } from '../audit/audit.service.js';
import { SqlConditions, getPagination, paginationMeta } from '../../utils/pagination.js';
import { isStaff } from '../../utils/constants.js';
import { badRequest, notFound } from '../../utils/errors.js';

const ASSET_SELECT = `
  SELECT s.*, u.full_name AS assigned_name, u.email AS assigned_email, u.department AS assigned_department
    FROM assets s LEFT JOIN users u ON u.id = s.assigned_to_id`;

export function toAssetDto(row) {
  return {
    id: row.id,
    assetTag: row.asset_tag,
    name: row.name,
    category: row.category,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    assignedTo: row.assigned_to_id ? { id: row.assigned_to_id, fullName: row.assigned_name, email: row.assigned_email, department: row.assigned_department } : null,
    location: row.location,
    // DATE columns come back as JS Dates at local midnight; send the plain date.
    purchaseDate: row.purchase_date ? toIsoDate(row.purchase_date) : null,
    condition: row.condition,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toIsoDate(d) {
  if (typeof d === 'string') return d.slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function listAssets(user, filters) {
  const pagination = getPagination(filters, 20);
  const c = new SqlConditions();
  // Employees can only ever see equipment assigned to them.
  if (!isStaff(user)) c.add('s.assigned_to_id = ?', user.id);
  else if (filters.assignedToId) c.add('s.assigned_to_id = ?', filters.assignedToId);
  if (filters.category?.length) c.add('s.category = ANY(?::text[])', filters.category);
  if (filters.status?.length) c.add('s.status = ANY(?::text[])', filters.status);
  if (filters.search) {
    const p = c.param(`%${filters.search}%`);
    c.clauses.push(`(s.asset_tag ILIKE ${p} OR s.name ILIKE ${p} OR s.serial_number ILIKE ${p} OR s.model ILIKE ${p} OR s.manufacturer ILIKE ${p} OR u.full_name ILIKE ${p})`);
  }
  const where = c.where();
  const total = (await query(`SELECT count(*) AS n FROM assets s LEFT JOIN users u ON u.id = s.assigned_to_id ${where}`, c.params)).rows[0].n;
  const sort = { tag: 's.asset_tag', name: 's.name', purchased: 's.purchase_date', updated: 's.updated_at' }[filters.sort] ?? 's.asset_tag';
  const { rows } = await query(
    `${ASSET_SELECT} ${where} ORDER BY ${sort} ${filters.order === 'desc' ? 'DESC NULLS LAST' : 'ASC NULLS LAST'}
     LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    c.params,
  );
  return { items: rows.map(toAssetDto), meta: paginationMeta(pagination, total) };
}

export async function getAsset(user, id) {
  const { rows } = await query(`${ASSET_SELECT} WHERE s.id = $1`, [id]);
  const row = rows[0];
  if (!row || (!isStaff(user) && row.assigned_to_id !== user.id)) throw notFound('Asset');

  const history = isStaff(user)
    ? (
        await query(
          `SELECT e.id, e.action, e.details, e.created_at, u.full_name AS actor_name
             FROM asset_events e LEFT JOIN users u ON u.id = e.actor_id
            WHERE e.asset_id = $1 ORDER BY e.created_at DESC LIMIT 50`,
          [id],
        )
      ).rows.map((r) => ({ id: r.id, action: r.action, details: r.details, createdAt: r.created_at, actorName: r.actor_name }))
    : [];
  return { ...toAssetDto(row), history };
}

async function assertActiveUser(db, userId) {
  const { rows } = await db.query('SELECT full_name, is_active FROM users WHERE id = $1', [userId]);
  if (!rows[0]?.is_active) throw badRequest('Assets can only be assigned to active users');
  return rows[0];
}

/**
 * Keeps status and assignee consistent (mirrors the DB CHECK constraint):
 * assigning someone implies "assigned"; any other status clears the assignee.
 */
function resolveAssignment(current, patch) {
  let assignedToId = patch.assignedToId !== undefined ? patch.assignedToId : current?.assigned_to_id ?? null;
  let status = patch.status ?? current?.status ?? 'available';

  if (patch.assignedToId) status = 'assigned';
  else if (patch.assignedToId === null && status === 'assigned') status = 'available';
  else if (patch.status && patch.status !== 'assigned') assignedToId = null;
  if (status === 'assigned' && !assignedToId) throw badRequest('Choose an employee to assign this asset to');
  return { assignedToId, status };
}

const COLUMN_MAP = {
  name: 'name',
  category: 'category',
  manufacturer: 'manufacturer',
  model: 'model',
  serialNumber: 'serial_number',
  location: 'location',
  purchaseDate: 'purchase_date',
  condition: 'condition',
  notes: 'notes',
};

export async function createAsset(user, input) {
  return withTransaction(async (db) => {
    const { assignedToId, status } = resolveAssignment(null, input);
    if (assignedToId) await assertActiveUser(db, assignedToId);

    const { rows } = await db.query(
      `INSERT INTO assets (name, category, manufacturer, model, serial_number, location, purchase_date, condition, notes, status, assigned_to_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'good'), $9, $10, $11) RETURNING id, asset_tag`,
      [input.name, input.category, input.manufacturer ?? null, input.model ?? null, input.serialNumber || null, input.location ?? null, input.purchaseDate ?? null, input.condition ?? null, input.notes ?? null, status, assignedToId],
    );
    const { id, asset_tag: assetTag } = rows[0];
    await db.query('INSERT INTO asset_events (asset_id, actor_id, action, details) VALUES ($1, $2, $3, $4)', [id, user.id, 'registered', { status }]);
    await recordAudit({ actorId: user.id, action: 'asset.created', resourceType: 'asset', resourceId: id, metadata: { assetTag, name: input.name, category: input.category } }, db);
    if (assignedToId) {
      await db.query('INSERT INTO asset_events (asset_id, actor_id, action, details) VALUES ($1, $2, $3, $4)', [id, user.id, 'assigned', { toId: assignedToId }]);
      await recordAudit({ actorId: user.id, action: 'asset.assigned', resourceType: 'asset', resourceId: id, metadata: { assetTag, toId: assignedToId } }, db);
    }
    return toAssetDto((await db.query(`${ASSET_SELECT} WHERE s.id = $1`, [id])).rows[0]);
  });
}

export async function updateAsset(user, id, patch) {
  return withTransaction(async (db) => {
    const current = (await db.query(`${ASSET_SELECT} WHERE s.id = $1 FOR UPDATE OF s`, [id])).rows[0];
    if (!current) throw notFound('Asset');

    const { assignedToId, status } = resolveAssignment(current, patch);
    const assignee = assignedToId && assignedToId !== current.assigned_to_id ? await assertActiveUser(db, assignedToId) : null;

    const sets = [];
    const params = [id];
    const changed = [];
    for (const [field, column] of Object.entries(COLUMN_MAP)) {
      if (patch[field] === undefined) continue;
      const value = field === 'serialNumber' ? patch[field] || null : patch[field];
      if (field === 'purchaseDate' ? value === (current.purchase_date ? toIsoDate(current.purchase_date) : null) : value === current[column]) continue;
      params.push(value);
      sets.push(`${column} = $${params.length}`);
      changed.push(field);
    }
    if (status !== current.status) {
      params.push(status);
      sets.push(`status = $${params.length}`);
    }
    if (assignedToId !== current.assigned_to_id) {
      params.push(assignedToId);
      sets.push(`assigned_to_id = $${params.length}`);
    }
    if (!sets.length) return toAssetDto(current);

    await db.query(`UPDATE assets SET ${sets.join(', ')} WHERE id = $1`, params);

    const event = (action, details) => db.query('INSERT INTO asset_events (asset_id, actor_id, action, details) VALUES ($1, $2, $3, $4)', [id, user.id, action, details]);
    const audit = (action, metadata) => recordAudit({ actorId: user.id, action, resourceType: 'asset', resourceId: id, metadata: { assetTag: current.asset_tag, ...metadata } }, db);

    if (assignedToId !== current.assigned_to_id) {
      if (assignedToId) {
        const action = current.assigned_to_id ? 'reassigned' : 'assigned';
        await event(action, { fromId: current.assigned_to_id, fromName: current.assigned_name, toId: assignedToId, toName: assignee?.full_name });
        await audit(`asset.${action}`, { fromId: current.assigned_to_id, toId: assignedToId });
      } else {
        await event('unassigned', { fromId: current.assigned_to_id, fromName: current.assigned_name });
        await audit('asset.unassigned', { fromId: current.assigned_to_id });
      }
    }
    if (status !== current.status) {
      await event('status_changed', { from: current.status, to: status });
      if (status !== 'assigned' && current.status !== 'assigned') await audit('asset.status_changed', { from: current.status, to: status });
    }
    if (changed.length) {
      await event('updated', { fields: changed });
      await audit('asset.updated', { fields: changed });
    }
    return toAssetDto((await db.query(`${ASSET_SELECT} WHERE s.id = $1`, [id])).rows[0]);
  });
}
