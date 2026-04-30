CREATE TABLE IF NOT EXISTS "instagram_comment_triggers" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "media_id" text NOT NULL,
  "trigger_type" text NOT NULL DEFAULT 'any_comment',
  "keyword" text,
  "action_type" text NOT NULL DEFAULT 'send_dm',
  "dm_message_text" text NOT NULL,
  "is_active" integer NOT NULL DEFAULT 1,
  "fires_count" integer NOT NULL DEFAULT 0,
  "created_at_ms" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "ig_triggers_media_idx" ON "instagram_comment_triggers" ("media_id");
CREATE INDEX IF NOT EXISTS "ig_triggers_account_idx" ON "instagram_comment_triggers" ("account_id");
CREATE INDEX IF NOT EXISTS "ig_triggers_active_idx" ON "instagram_comment_triggers" ("is_active");

CREATE TABLE IF NOT EXISTS "instagram_trigger_fires" (
  "id" text PRIMARY KEY NOT NULL,
  "trigger_id" text NOT NULL,
  "ig_comment_id" text NOT NULL,
  "commenter_username" text NOT NULL,
  "dm_sent" integer NOT NULL DEFAULT 0,
  "error" text,
  "fired_at_ms" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "ig_trigger_fires_trigger_idx" ON "instagram_trigger_fires" ("trigger_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ig_trigger_fires_comment_idx" ON "instagram_trigger_fires" ("trigger_id", "ig_comment_id");
