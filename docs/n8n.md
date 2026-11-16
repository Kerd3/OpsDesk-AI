# n8n workflow automation

OpsDesk AI sends ticket events to an n8n webhook, and the bundled workflow emails the right person through Gmail.

```
Ticket change ──(same DB transaction)──▶ webhook_deliveries row (status = pending)
                                            │
                     outbox worker (every 5 s, and right after each commit)
                                            │  POST + HMAC signature, 5 s timeout
                                            ▼
                                   n8n "OpsDesk webhook"
                     verify signature ─▶ de-duplicate ─▶ compose email ─▶ Gmail ─▶ mark processed ─▶ 200
                            │                 │
                          401            200 "duplicate"
```

## Events

| Event | Sent when | Email recipient (bundled workflow) |
| --- | --- | --- |
| `ticket.created` | A ticket is created | Requester (confirmation) |
| `ticket.assigned` | A ticket gets an assignee | Assignee |
| `ticket.status_changed` | Status changes (including a requester reply that reopens work) | Requester (skipped for → resolved, see next row) |
| `ticket.resolved` | Status changes to resolved | Requester (asks them to confirm) |
| `integration.test` | Administrator clicks **Send test event** | none (acknowledged only) |

Payload (only what the notification needs, with no description or comment text):

```json
{
  "id": "6a7c…",                      // equals the X-OpsDesk-Event-Id header
  "type": "ticket.created",
  "occurredAt": "2026-11-16T05:42:10.512Z",
  "source": "opsdesk-ai",
  "data": {
    "ticketId": "…", "ticketNumber": "OPS-2026-0015", "subject": "…",
    "category": "network", "priority": "high", "status": "open",
    "url": "http://localhost:8080/tickets/…",
    "requester": { "name": "Sam Carter", "email": "employee@opsdesk.local" },
    "assignee": null,
    "change": { "from": "open", "to": "in_progress" }   // status events only
  }
}
```

Headers: `X-OpsDesk-Event-Id`, `X-OpsDesk-Event-Type`, `X-OpsDesk-Timestamp` (Unix seconds) and `X-OpsDesk-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" using N8N_WEBHOOK_SECRET>`.

## Reliability guarantees

- **Never blocks core features.** Ticket requests only insert an outbox row. Delivery happens in the background, so if n8n is down the ticket is still created (verified: HTTP 201 in 87 ms with n8n stopped).
- **Retries with exponential backoff**: 30 s, 1 min, 2 min, 4 min … (capped at 1 h), up to `WEBHOOK_MAX_ATTEMPTS` (default 5). Timeouts, network errors, 5xx, 408 and 429 are retried; other 4xx fail immediately.
- **At-least-once delivery + idempotency.** Each event has a unique `event_id`, and retries (automatic or the admin **Retry** button) reuse it. The workflow stores processed ids for 7 days and answers duplicates with `200 {"status":"duplicate"}` without emailing again. An id is marked processed only **after** the email step succeeds, so a failed send is retried rather than lost.
- **Single delivery across workers**: rows are claimed with `FOR UPDATE SKIP LOCKED`, and rows stuck in `delivering` for 5 min after a crash are recovered.
- **Visible**: every attempt's status code and error are stored and shown on **Settings → Integrations**, where admins can filter failures and retry them.
- If `N8N_WEBHOOK_URL`/`N8N_WEBHOOK_SECRET` are not set, events are stored as `skipped`, so you can see what would have been sent.

## Setup

1. Set a shared secret in `.env` (any long random string):
   ```env
   N8N_WEBHOOK_SECRET=replace-with-a-long-random-string
   ```
2. Start n8n with the stack and point the API at it:
   ```bash
   # Docker: the API reaches n8n by its service name
   N8N_WEBHOOK_URL=http://n8n:5678/webhook/opsdesk-events docker compose --profile automation up -d
   ```
   For a locally running API (`npm run dev:api`) use `N8N_WEBHOOK_URL=http://localhost:5678/webhook/opsdesk-events` in `.env`.
   The compose file passes the secret to n8n as `OPSDESK_WEBHOOK_SECRET` and allows the Code nodes to use `crypto` and environment variables.
3. Open http://localhost:5678, create the owner account, then **Import from file** → `n8n/opsdesk-ticket-notifications.workflow.json`, or use the CLI:
   ```bash
   docker compose cp n8n/opsdesk-ticket-notifications.workflow.json n8n:/tmp/wf.json
   docker compose exec n8n n8n import:workflow --input=/tmp/wf.json
   ```
4. Open the **Send Gmail** node and connect a Gmail OAuth2 credential (n8n guides you through Google Cloud OAuth). n8n will not publish the workflow until the credential exists.
5. **Publish/activate** the workflow, then in OpsDesk go to **Settings → Integrations → Send test event**. The delivery should show **Delivered**.

## Verified behaviour (n8n 2.47.7)

The workflow was imported and exercised against a live n8n container (with the Gmail node temporarily disabled, because Gmail requires the owner's OAuth consent):

| Request | Response |
| --- | --- |
| Correctly signed event | `200 {"status":"processed"}` |
| Same event id again | `200 {"status":"duplicate"}` |
| Forged signature | `401 {"status":"rejected"}` |
| Ticket created in the Dockerised app | delivery row `delivered`, 1 attempt, HTTP 200 |
| Ticket created while n8n was stopped | ticket 201; attempt 1 `Timed out after 5000 ms` → retried → `delivered` on attempt 2 |
