import crypto from 'node:crypto';
import { config } from '../../config/env.js';
import { query } from '../../database/pool.js';
import { getSetting } from '../settings/settings.service.js';

/**
 * Outbound webhooks use a transactional outbox:
 *  1. The event row is inserted in the SAME transaction as the business change,
 *     so an event exists if and only if the change was committed.
 *  2. A background worker delivers due rows, signs them with HMAC-SHA256 and
 *     retries failures with exponential backoff.
 * Ticket requests never wait for n8n, and n8n being down cannot roll back a ticket.
 */

const RETRY_BASE_MS = 30 * 1000;
const RETRY_MAX_MS = 60 * 60 * 1000;
const STUCK_AFTER_MS = 5 * 60 * 1000;
const BATCH_SIZE = 10;

export function isWebhookConfigured() {
  return Boolean(config.webhook.url && config.webhook.secret);
}

/** Signature over `${timestamp}.${body}` so receivers can reject replays and tampering. */
export function signPayload(timestamp, body, secret = config.webhook.secret) {
  return `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

export function computeBackoffMs(attempt) {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), RETRY_MAX_MS);
}

/**
 * Queue an event. `db` should be the transaction client of the change that
 * produced the event. Returns the delivery row, or null when the event type is
 * disabled or was already queued under the same dedupe key.
 */
export async function enqueueEvent(db, { eventType, resourceType, resourceId, data, dedupeKey = null }) {
  const settings = await getSetting('notifications', db);
  if (!settings.enabled || settings.events?.[eventType] === false) return null;

  const eventId = crypto.randomUUID();
  const payload = { id: eventId, type: eventType, occurredAt: new Date().toISOString(), source: 'opsdesk-ai', data };
  const configured = isWebhookConfigured();

  const { rows } = await db.query(
    `INSERT INTO webhook_deliveries
       (event_id, dedupe_key, event_type, resource_type, resource_id, payload, status, max_attempts, last_error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING *`,
    [
      eventId,
      dedupeKey,
      eventType,
      resourceType,
      resourceId,
      payload,
      configured ? 'pending' : 'skipped',
      config.webhook.maxAttempts,
      configured ? null : 'Webhook URL or secret is not configured',
    ],
  );
  return rows[0] ?? null;
}

async function claimDueDeliveries() {
  // Recover rows left in "delivering" by a crashed process.
  await query(
    `UPDATE webhook_deliveries SET status = 'pending'
      WHERE status = 'delivering' AND last_attempt_at < now() - $1::int * interval '1 millisecond'`,
    [STUCK_AFTER_MS],
  );
  // SKIP LOCKED lets several workers run without delivering the same row twice.
  const { rows } = await query(
    `UPDATE webhook_deliveries d
        SET status = 'delivering', attempts = d.attempts + 1, last_attempt_at = now()
      WHERE d.id IN (
        SELECT id FROM webhook_deliveries
         WHERE status = 'pending' AND next_attempt_at <= now()
         ORDER BY next_attempt_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED)
      RETURNING d.*`,
    [BATCH_SIZE],
  );
  return rows;
}

async function sendDelivery(delivery) {
  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  try {
    const response = await fetch(config.webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OpsDesk-AI-Webhooks/1.0',
        'X-OpsDesk-Event-Id': delivery.event_id,
        'X-OpsDesk-Event-Type': delivery.event_type,
        'X-OpsDesk-Timestamp': timestamp,
        'X-OpsDesk-Signature': signPayload(timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(config.webhook.timeoutMs),
    });
    // Drain the body so the connection can be reused.
    await response.arrayBuffer().catch(() => {});
    if (response.ok) return { ok: true, statusCode: response.status };
    // Client errors other than timeout/rate-limit will not succeed on retry.
    const retryable = response.status >= 500 || response.status === 408 || response.status === 429;
    return { ok: false, statusCode: response.status, retryable, error: `Receiver responded with HTTP ${response.status}` };
  } catch (err) {
    const error = err.name === 'TimeoutError' ? `Timed out after ${config.webhook.timeoutMs} ms` : `Network error: ${err.cause?.code || err.message}`;
    return { ok: false, statusCode: null, retryable: true, error };
  }
}

async function recordResult(delivery, result) {
  if (result.ok) {
    await query(
      `UPDATE webhook_deliveries SET status = 'delivered', delivered_at = now(), last_status_code = $2, last_error = NULL
        WHERE id = $1`,
      [delivery.id, result.statusCode],
    );
    return 'delivered';
  }
  const exhausted = !result.retryable || delivery.attempts >= delivery.max_attempts;
  await query(
    `UPDATE webhook_deliveries
        SET status = $2, last_status_code = $3, last_error = $4,
            next_attempt_at = now() + $5::int * interval '1 millisecond'
      WHERE id = $1`,
    [delivery.id, exhausted ? 'failed' : 'pending', result.statusCode, result.error, computeBackoffMs(delivery.attempts)],
  );
  if (exhausted) console.warn(`[webhooks] delivery ${delivery.id} (${delivery.event_type}) failed permanently: ${result.error}`);
  return exhausted ? 'failed' : 'retry_scheduled';
}

let processing = null;

/** Deliver every due event once. Concurrent calls share the same run. */
export function processDueDeliveries() {
  if (!isWebhookConfigured()) return Promise.resolve({ processed: 0 });
  if (processing) return processing;
  processing = (async () => {
    let processed = 0;
    try {
      for (;;) {
        const batch = await claimDueDeliveries();
        if (!batch.length) break;
        for (const delivery of batch) {
          await recordResult(delivery, await sendDelivery(delivery));
          processed += 1;
        }
      }
    } catch (err) {
      console.error('[webhooks] worker error:', err.message);
    } finally {
      processing = null;
    }
    return { processed };
  })();
  return processing;
}

/** Fire-and-forget nudge after a commit so events go out without waiting for the next poll. */
export function scheduleDelivery() {
  if (config.isTest) return; // tests drive delivery explicitly
  setImmediate(() => processDueDeliveries());
}

let timer = null;
export function startWebhookWorker() {
  if (timer || !isWebhookConfigured()) return;
  timer = setInterval(() => processDueDeliveries(), config.webhook.pollIntervalMs);
  timer.unref();
  console.log('[webhooks] delivery worker started');
}
export function stopWebhookWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
export const isWorkerRunning = () => Boolean(timer);
