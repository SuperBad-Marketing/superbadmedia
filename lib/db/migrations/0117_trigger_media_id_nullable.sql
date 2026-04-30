-- Make media_id nullable on instagram_comment_triggers (for global/blanket triggers)
-- SQLite doesn't support ALTER COLUMN, so we recreate the table.

CREATE TABLE IF NOT EXISTS "instagram_comment_triggers_new" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "media_id" text,
  "trigger_type" text NOT NULL DEFAULT 'any_comment',
  "keyword" text,
  "action_type" text NOT NULL DEFAULT 'send_dm',
  "dm_message_text" text NOT NULL,
  "is_active" integer NOT NULL DEFAULT 1,
  "fires_count" integer NOT NULL DEFAULT 0,
  "created_at_ms" integer NOT NULL
);

INSERT OR IGNORE INTO "instagram_comment_triggers_new"
  SELECT * FROM "instagram_comment_triggers";

DROP TABLE IF EXISTS "instagram_comment_triggers";

ALTER TABLE "instagram_comment_triggers_new" RENAME TO "instagram_comment_triggers";

CREATE INDEX IF NOT EXISTS "ig_triggers_media_idx" ON "instagram_comment_triggers" ("media_id");
CREATE INDEX IF NOT EXISTS "ig_triggers_account_idx" ON "instagram_comment_triggers" ("account_id");
CREATE INDEX IF NOT EXISTS "ig_triggers_active_idx" ON "instagram_comment_triggers" ("is_active");
