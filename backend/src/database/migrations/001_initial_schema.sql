-- OpsDesk AI initial schema.
-- Enumerations are TEXT + CHECK constraints so values can evolve with a simple migration.

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('admin', 'it_support', 'employee')),
  department     TEXT,
  job_title      TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);
CREATE UNIQUE INDEX users_email_key ON users (email);
CREATE INDEX users_role_idx ON users (role) WHERE is_active;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
-- Per-year counter that produces readable identifiers such as OPS-2026-0001.
CREATE TABLE ticket_counters (
  year        INTEGER PRIMARY KEY,
  last_value  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number  TEXT NOT NULL UNIQUE,
  subject        TEXT NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 200),
  description    TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 10000),
  category       TEXT NOT NULL CHECK (category IN ('hardware', 'software', 'network', 'printer', 'email_accounts', 'access_permissions', 'other')),
  priority       TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_for_employee', 'resolved', 'closed')),
  source         TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'ai_assist')),
  requester_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  assignee_id    UUID REFERENCES users (id) ON DELETE SET NULL,
  resolved_at    TIMESTAMPTZ,
  closed_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector  TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(ticket_number, '') || ' ' || coalesce(subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED
);
CREATE INDEX tickets_requester_idx ON tickets (requester_id, created_at DESC);
CREATE INDEX tickets_assignee_idx ON tickets (assignee_id, status);
CREATE INDEX tickets_status_idx ON tickets (status);
CREATE INDEX tickets_priority_idx ON tickets (priority);
CREATE INDEX tickets_category_idx ON tickets (category);
CREATE INDEX tickets_created_idx ON tickets (created_at DESC);
CREATE INDEX tickets_search_idx ON tickets USING GIN (search_vector);
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE ticket_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  -- Internal notes are visible to IT support and administrators only.
  is_internal  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ticket_comments_ticket_idx ON ticket_comments (ticket_id, created_at);
CREATE TRIGGER ticket_comments_updated_at BEFORE UPDATE ON ticket_comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE ticket_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users (id) ON DELETE SET NULL,
  action      TEXT NOT NULL CHECK (action IN ('created', 'status_changed', 'priority_changed', 'category_changed', 'assigned', 'unassigned', 'details_updated', 'comment_added', 'internal_note_added')),
  from_value  TEXT,
  to_value    TEXT,
  -- Internal activity (e.g. internal notes) is hidden from employees.
  is_internal BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ticket_activity_ticket_idx ON ticket_activity (ticket_id, created_at);
CREATE INDEX ticket_activity_created_idx ON ticket_activity (created_at DESC);

-- ---------------------------------------------------------------------------
-- Knowledge base
-- ---------------------------------------------------------------------------
CREATE TABLE knowledge_base_articles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title          TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description    TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  content        TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 50000),
  category       TEXT NOT NULL CHECK (category IN ('hardware', 'software', 'network', 'printer', 'email_accounts', 'access_permissions', 'other')),
  tags           TEXT[] NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  author_id      UUID REFERENCES users (id) ON DELETE SET NULL,
  updated_by_id  UUID REFERENCES users (id) ON DELETE SET NULL,
  view_count     INTEGER NOT NULL DEFAULT 0,
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector  TSVECTOR
);
CREATE INDEX kb_status_category_idx ON knowledge_base_articles (status, category);
CREATE INDEX kb_search_idx ON knowledge_base_articles USING GIN (search_vector);
CREATE INDEX kb_tags_idx ON knowledge_base_articles USING GIN (tags);
CREATE TRIGGER kb_updated_at BEFORE UPDATE ON knowledge_base_articles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The search vector is maintained by a trigger because array_to_string() is not
-- IMMUTABLE and therefore cannot be used in a generated column.
CREATE OR REPLACE FUNCTION kb_articles_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '') || ' ' || array_to_string(NEW.tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER kb_search_vector BEFORE INSERT OR UPDATE OF title, description, tags, content
  ON knowledge_base_articles FOR EACH ROW EXECUTE FUNCTION kb_articles_search_vector();

-- ---------------------------------------------------------------------------
-- IT assets
-- ---------------------------------------------------------------------------
CREATE SEQUENCE asset_tag_seq START 1;

CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag       TEXT NOT NULL UNIQUE DEFAULT ('AST-' || lpad(nextval('asset_tag_seq')::text, 4, '0')),
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 150),
  category        TEXT NOT NULL CHECK (category IN ('laptop', 'desktop', 'monitor', 'printer', 'router', 'keyboard', 'mouse', 'other')),
  manufacturer    TEXT,
  model           TEXT,
  serial_number   TEXT UNIQUE,
  assigned_to_id  UUID REFERENCES users (id) ON DELETE SET NULL,
  location        TEXT,
  purchase_date   DATE,
  condition       TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')),
  status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'under_maintenance', 'retired')),
  notes           TEXT CHECK (char_length(notes) <= 5000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- An asset is "assigned" exactly when it has an assignee.
  CONSTRAINT assets_assignment_consistent CHECK ((status = 'assigned') = (assigned_to_id IS NOT NULL))
);
CREATE INDEX assets_category_status_idx ON assets (category, status);
CREATE INDEX assets_assigned_idx ON assets (assigned_to_id);
CREATE TRIGGER assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Per-asset history shown on the asset details page (assignment, maintenance...).
CREATE TABLE asset_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users (id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX asset_events_asset_idx ON asset_events (asset_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       UUID REFERENCES users (id) ON DELETE RESTRICT,
  action         TEXT NOT NULL,
  resource_type  TEXT NOT NULL,
  resource_id    TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX audit_logs_resource_idx ON audit_logs (resource_type, resource_id);
CREATE INDEX audit_logs_action_idx ON audit_logs (action);

CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_immutable();

-- ---------------------------------------------------------------------------
-- Outbound webhook deliveries (transactional outbox for n8n)
-- ---------------------------------------------------------------------------
CREATE TABLE webhook_deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sent as X-OpsDesk-Event-Id so receivers can de-duplicate retried deliveries.
  event_id          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- Optional deterministic key that stops the application from enqueueing the same event twice.
  dedupe_key        TEXT UNIQUE,
  event_type        TEXT NOT NULL,
  resource_type     TEXT NOT NULL,
  resource_id       TEXT,
  payload           JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivering', 'delivered', 'failed', 'skipped')),
  attempts          INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 5,
  next_attempt_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at   TIMESTAMPTZ,
  last_status_code  INTEGER,
  last_error        TEXT,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX webhook_deliveries_due_idx ON webhook_deliveries (next_attempt_at) WHERE status IN ('pending', 'delivering');
CREATE INDEX webhook_deliveries_status_idx ON webhook_deliveries (status, created_at DESC);
CREATE TRIGGER webhook_deliveries_updated_at BEFORE UPDATE ON webhook_deliveries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Administrator-editable settings (non-secret). Secrets stay in environment variables.
-- ---------------------------------------------------------------------------
CREATE TABLE system_settings (
  key            TEXT PRIMARY KEY,
  value          JSONB NOT NULL,
  updated_by_id  UUID REFERENCES users (id) ON DELETE SET NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO system_settings (key, value) VALUES
  ('notifications', '{"enabled": true, "events": {"ticket.created": true, "ticket.assigned": true, "ticket.status_changed": true, "ticket.resolved": true}}'),
  ('ai', '{"enabled": true}');

-- ---------------------------------------------------------------------------
-- Session store used by connect-pg-simple
-- ---------------------------------------------------------------------------
CREATE TABLE "session" (
  sid     VARCHAR NOT NULL PRIMARY KEY,
  sess    JSON NOT NULL,
  expire  TIMESTAMP(6) NOT NULL
);
CREATE INDEX session_expire_idx ON "session" (expire);
