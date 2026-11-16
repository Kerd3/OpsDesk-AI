# REST API reference

Base path: `/api`. All bodies are JSON.

- **Auth**: HTTP-only session cookie `opsdesk.sid` (set by `POST /auth/login`).
- **CSRF**: every `POST`/`PATCH`/`DELETE` must send `X-CSRF-Token`. Get the token from `GET /auth/csrf` (anonymous), `POST /auth/login` or `GET /auth/me`.
- **Success**: `{ "data": … }`. Lists add `"meta": { "page", "pageSize", "total", "totalPages" }`.
- **Errors**: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "field", "message" }] } }`.

| Status | Meaning |
| --- | --- |
| 400 | Bad request / business rule (e.g. assigning a ticket to a non-staff user) |
| 401 | Not signed in, or the session was revoked |
| 403 | Signed in but not allowed (`FORBIDDEN`) or missing CSRF token (`CSRF_INVALID`) |
| 404 | Not found, **or not visible to you** (private tickets return 404, not 403) |
| 409 | Conflict (duplicate email/serial, editing a closed ticket, retrying a delivered webhook) |
| 422 | Validation error with per-field `details` |
| 429 | Rate limited (`RATE_LIMITED`, `AI_RATE_LIMITED`) |
| 502/503/504 | AI provider unavailable / not configured / timed out (`AI_*` codes) |

Roles: **A** administrator, **S** IT support, **E** employee.

## Authentication

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/auth/csrf` | anyone | `{ csrfToken }` |
| POST | `/auth/login` | anyone | `{ email, password }` → `{ user, csrfToken }`. Rate limited (failed attempts only). New session id on success. |
| POST | `/auth/logout` | any | Destroys the session |
| GET | `/auth/me` | A S E | `{ user, csrfToken }` |
| PATCH | `/auth/me` | A S E | `{ fullName?, department?, jobTitle? }`. Role and email cannot be changed here. |
| POST | `/auth/change-password` | A S E | `{ currentPassword, newPassword }`. Signs out the user's other sessions. |

## Dashboard and notifications

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/dashboard` | A S E | Role-specific statistics, all computed from the database |
| GET | `/notifications` | A S E | Recent activity by other people on the user's tickets (no internal activity for employees) |
| GET | `/users/directory?roles=staff\|all` | A S | Active people for assignee/owner pickers |

## Tickets

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/tickets` | A S E | Query: `scope=all\|mine\|assigned\|unassigned`, `status`, `priority`, `category` (comma lists), `assigneeId`, `requesterId`, `from`, `to` (YYYY-MM-DD), `search`, `sort=created\|updated\|number\|priority\|status`, `order`, `page`, `pageSize` (≤100). Results are always limited to what the caller may see. |
| POST | `/tickets` | A S E | `{ subject, description, category, priority?, source? }`. Staff may add `requesterId`. Returns `OPS-YYYY-NNNN`. |
| GET | `/tickets/:id` | A S E | `:id` = UUID or ticket number. Includes `comments`, `activity` (internal entries removed for employees) and a `permissions` hint for the UI. |
| PATCH | `/tickets/:id` | A S E | `{ subject?, description?, category?, priority?, status?, assigneeId? }` (`assigneeId: null` unassigns). See rules below. |
| POST | `/tickets/:id/comments` | A S E | `{ body, isInternal? }`. Only staff may set `isInternal: true`. |
| GET | `/tickets/:id/activity` | A S E | Activity history |

**Ticket rules (enforced in `tickets.policy.js`)**

- Employees see and change only their own tickets. They may edit subject/description while the ticket is active, and only move a *resolved* ticket to *closed* (confirm) or *open* (reopen). Any other field returns 403.
- IT support see tickets assigned to them, unassigned tickets and tickets they requested. They must accept an unassigned ticket (`assigneeId` = self) before changing it, and cannot change tickets assigned to colleagues.
- Administrators can do everything. Tickets can only be assigned to active staff.
- A requester reply to a `waiting_for_employee` ticket moves it back to `in_progress`.

## Knowledge base

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/knowledge-base` | A S E | `search`, `category`, `tag`, `sort=recent\|popular\|title`, `page`. Employees only ever receive published articles. Staff can filter `status`. |
| GET | `/knowledge-base/tags` | A S E | Popular tags |
| GET | `/knowledge-base/:idOrSlug` | A S E | Includes `related`. Unpublished → 404 for employees. `?view=0` skips the view counter (editor). |
| POST | `/knowledge-base` | A S | `{ title, content, category, description?, tags?, status?, slug? }` |
| PATCH | `/knowledge-base/:id` | A S | Any of the above. Publishing sets `published_at`. |
| DELETE | `/knowledge-base/:id` | A S | Archives. `?permanent=true` (admin only, archived articles only) hard-deletes. |

## AI assistant

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/ai/status` | A S E | `{ configured, enabled, available, provider, model }` |
| POST | `/ai/chat` | A S E | `{ message (2–2000 chars), history?: [{ role: "user"\|"assistant", content }] (≤30, last 10 used) }` → `{ answer, steps[], nextStep, suggestedCategory, suggestedPriority, needsHumanSupport, confidence, grounded, sources[{ id, slug, title }], retrievedCount }`. Per-user rate limit. |
| POST | `/ai/ticket-assist` | A S E | `{ messages: [...] }` → draft `{ subject, description, category, priority, attemptedSteps, requiresReview: true }`. Never creates a ticket. |

When no API key is configured the AI endpoints return **503 `AI_NOT_CONFIGURED`**. There are no fallback or fake answers.

## Assets

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/assets` | A S E | `search`, `category`, `status`, `assignedToId`, `sort`, `page`. Employees only see their own equipment. |
| POST | `/assets` | A S | `{ name, category, manufacturer?, model?, serialNumber?, location?, purchaseDate?, condition?, status?, assignedToId?, notes? }` |
| GET | `/assets/:id` | A S E | Staff also receive `history` |
| PATCH | `/assets/:id` | A S | Assigning sets status `assigned`. Any other status clears the owner. |

## Reports (administrator)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/reports/summary?from&to` | Ticket totals by state, urgent/unassigned counts, average and median resolution time, people and asset counts |
| GET | `/reports/tickets?from&to&interval=day\|week\|month` | By category, priority and status; per staff member; created-vs-resolved trend; asset distribution. Range ≤ 2 years, default last 30 days. |

## Administration (administrator)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/users` | `search`, `role`, `status=active\|inactive`, `page` |
| POST | `/admin/users` | `{ email, fullName, role, password, department?, jobTitle? }` |
| PATCH | `/admin/users/:id` | `{ fullName?, role?, department?, jobTitle?, isActive?, password? }`. Deactivation or password reset revokes the user's sessions. Admins cannot demote or deactivate themselves. |
| GET | `/admin/audit-logs` | `action`, `resourceType`, `actorId`, `search`, `from`, `to`, `page` |
| GET | `/admin/audit-logs/actions` | Distinct actions for filters |
| GET | `/admin/integrations` | Webhook/AI configuration status (secrets reported only as present/absent), 7-day delivery counts, recent problems |
| GET | `/admin/integrations/deliveries` | `status`, `eventType`, `page` |
| POST | `/admin/integrations/deliveries/:id/retry` | Re-queues a failed/skipped delivery with the **same event id** |
| POST | `/admin/integrations/test` | Sends a signed `integration.test` event now |
| GET | `/admin/settings` | `{ notifications, ai }` |
| PATCH | `/admin/settings/notifications` | `{ enabled?, events?: { "ticket.created": bool, … } }` (audited) |
| PATCH | `/admin/settings/ai` | `{ enabled }` (audited) |

## Health

`GET /api/health` → `{ status: "ok", database: "ok", latencyMs, uptimeSeconds }` (503 if the database is unreachable).
