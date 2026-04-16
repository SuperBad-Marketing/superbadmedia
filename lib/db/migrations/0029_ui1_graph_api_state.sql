-- UI-1: Graph API sync state table
CREATE TABLE IF NOT EXISTS "graph_api_state" (
  "id" text PRIMARY KEY NOT NULL,
  "integration_connection_id" text NOT NULL,
  "user_id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "client_id" text NOT NULL,
  "subscription_id" text,
  "subscription_expires_at_ms" integer,
  "last_delta_token" text,
  "last_full_sync_at_ms" integer,
  "initial_import_status" text NOT NULL DEFAULT 'not_started',
  "initial_import_progress_json" text,
  "created_at_ms" integer NOT NULL,
  "updated_at_ms" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "graph_api_state_user_idx"
  ON "graph_api_state" ("user_id");
CREATE INDEX IF NOT EXISTS "graph_api_state_integration_idx"
  ON "graph_api_state" ("integration_connection_id");
CREATE INDEX IF NOT EXISTS "graph_api_state_sub_expiry_idx"
  ON "graph_api_state" ("subscription_expires_at_ms");
