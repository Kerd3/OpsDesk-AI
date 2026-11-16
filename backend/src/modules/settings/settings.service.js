import { query, withTransaction } from '../../database/pool.js';
import { recordAudit } from '../audit/audit.service.js';
import { WEBHOOK_EVENTS } from '../../utils/constants.js';

const DEFAULTS = {
  notifications: { enabled: true, events: Object.fromEntries(WEBHOOK_EVENTS.map((e) => [e, true])) },
  ai: { enabled: true },
};

export async function getSetting(key, db = { query }) {
  const { rows } = await db.query('SELECT value FROM system_settings WHERE key = $1', [key]);
  return { ...DEFAULTS[key], ...(rows[0]?.value ?? {}) };
}

export async function getAllSettings() {
  return { notifications: await getSetting('notifications'), ai: await getSetting('ai') };
}

/** Merge a partial update into a settings document and audit the change. */
export async function updateSetting(key, patch, actorId) {
  return withTransaction(async (db) => {
    const before = await getSetting(key, db);
    const after = {
      ...before,
      ...patch,
      ...(patch.events ? { events: { ...before.events, ...patch.events } } : {}),
    };
    await db.query(
      `INSERT INTO system_settings (key, value, updated_by_id, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by_id = EXCLUDED.updated_by_id, updated_at = now()`,
      [key, after, actorId],
    );
    await recordAudit(
      { actorId, action: 'integration.settings_updated', resourceType: 'system_setting', resourceId: key, metadata: { before, after } },
      db,
    );
    return after;
  });
}
