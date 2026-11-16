import { config } from '../../config/env.js';
import { query } from '../../database/pool.js';
import { recordAudit } from '../audit/audit.service.js';
import { getPagination, paginationMeta, SqlConditions } from '../../utils/pagination.js';
import { conflict, notFound } from '../../utils/errors.js';
import { isWebhookConfigured, isWorkerRunning, processDueDeliveries } from './webhook.service.js';
import { getAllSettings } from '../settings/settings.service.js';
import { getAiStatus } from '../ai/ai.service.js';

function toDeliveryDto(r) {
  return {
    id: r.id,
    eventId: r.event_id,
    eventType: r.event_type,
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    ticketNumber: r.payload?.data?.ticketNumber ?? null,
    status: r.status,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    nextAttemptAt: r.status === 'pending' ? r.next_attempt_at : null,
    lastAttemptAt: r.last_attempt_at,
    lastStatusCode: r.last_status_code,
    lastError: r.last_error,
    deliveredAt: r.delivered_at,
    createdAt: r.created_at,
  };
}

/** Overview for the admin Integrations page. Secrets are reported as present/absent only. */
export async function getIntegrationStatus() {
  let webhookHost = null;
  try {
    webhookHost = config.webhook.url ? new URL(config.webhook.url).host : null;
  } catch {
    webhookHost = 'invalid URL';
  }
  const [counts, recentFailures, settings, ai] = await Promise.all([
    query(
      `SELECT status, count(*) AS n FROM webhook_deliveries
        WHERE created_at >= now() - interval '7 days' GROUP BY status`,
    ),
    query(`SELECT * FROM webhook_deliveries WHERE status = 'failed' OR (status = 'pending' AND attempts > 0) ORDER BY updated_at DESC LIMIT 10`),
    getAllSettings(),
    getAiStatus(),
  ]);
  const byStatus = Object.fromEntries(counts.rows.map((r) => [r.status, r.n]));
  const lastDelivered = (await query(`SELECT max(delivered_at) AS at FROM webhook_deliveries`)).rows[0].at;

  return {
    webhook: {
      configured: isWebhookConfigured(),
      urlConfigured: Boolean(config.webhook.url),
      secretConfigured: Boolean(config.webhook.secret),
      host: webhookHost,
      workerRunning: isWorkerRunning(),
      maxAttempts: config.webhook.maxAttempts,
      last7Days: {
        delivered: byStatus.delivered ?? 0,
        pending: (byStatus.pending ?? 0) + (byStatus.delivering ?? 0),
        failed: byStatus.failed ?? 0,
        skipped: byStatus.skipped ?? 0,
      },
      lastDeliveredAt: lastDelivered,
      recentProblems: recentFailures.rows.map(toDeliveryDto),
    },
    ai,
    settings,
  };
}

export async function listDeliveries(filters) {
  const pagination = getPagination(filters, 20);
  const c = new SqlConditions();
  if (filters.status) c.add('status = ?', filters.status);
  if (filters.eventType) c.add('event_type = ?', filters.eventType);
  const where = c.where();
  const total = (await query(`SELECT count(*) AS n FROM webhook_deliveries ${where}`, c.params)).rows[0].n;
  const { rows } = await query(
    `SELECT * FROM webhook_deliveries ${where} ORDER BY created_at DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    c.params,
  );
  return { items: rows.map(toDeliveryDto), meta: paginationMeta(pagination, total) };
}

/** Re-queue a failed (or skipped) delivery with a fresh attempt budget. The event id is kept for idempotency. */
export async function retryDelivery(id, actorId) {
  const { rows } = await query('SELECT status, event_type FROM webhook_deliveries WHERE id = $1', [id]);
  if (!rows[0]) throw notFound('Delivery');
  if (!['failed', 'skipped'].includes(rows[0].status)) throw conflict('Only failed or skipped deliveries can be retried');
  if (!isWebhookConfigured()) throw conflict('Configure N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET before retrying deliveries');

  const updated = await query(
    `UPDATE webhook_deliveries SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = NULL
      WHERE id = $1 RETURNING *`,
    [id],
  );
  await recordAudit({ actorId, action: 'integration.delivery_retried', resourceType: 'webhook_delivery', resourceId: id, metadata: { eventType: rows[0].event_type } });
  if (!config.isTest) setImmediate(() => processDueDeliveries());
  return toDeliveryDto(updated.rows[0]);
}

/** Sends a signed test event straight away so admins can verify the n8n connection. */
export async function sendTestEvent(actorId) {
  if (!isWebhookConfigured()) throw conflict('Configure N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET first');
  const { rows } = await query(
    `INSERT INTO webhook_deliveries (event_type, resource_type, resource_id, payload, max_attempts)
     VALUES ('integration.test', 'integration', 'n8n', $1, 1) RETURNING *`,
    [{ type: 'integration.test', occurredAt: new Date().toISOString(), source: 'opsdesk-ai', data: { message: 'Test event from OpsDesk AI' } }],
  );
  // Align the payload id with the event id the receiver sees in the header.
  await query(`UPDATE webhook_deliveries SET payload = jsonb_set(payload, '{id}', to_jsonb(event_id::text)) WHERE id = $1`, [rows[0].id]);
  await recordAudit({ actorId, action: 'integration.test_sent', resourceType: 'webhook_delivery', resourceId: rows[0].id });
  await processDueDeliveries();
  const result = await query('SELECT * FROM webhook_deliveries WHERE id = $1', [rows[0].id]);
  return toDeliveryDto(result.rows[0]);
}
