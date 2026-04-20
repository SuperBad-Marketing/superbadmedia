CREATE TABLE IF NOT EXISTS hidden_egg_fires (
  id TEXT PRIMARY KEY,
  egg_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('public', 'admin', 'customer')),
  user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  visitor_id TEXT,
  fired_at_ms INTEGER NOT NULL,
  trigger_evidence TEXT NOT NULL DEFAULT '{}',
  session_id TEXT,
  outcome TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hef_egg_user_idx ON hidden_egg_fires(egg_id, user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hef_egg_visitor_idx ON hidden_egg_fires(egg_id, visitor_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hef_fired_idx ON hidden_egg_fires(fired_at_ms);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ambient_copy_cache (
  id TEXT PRIMARY KEY,
  slot TEXT NOT NULL CHECK (slot IN ('empty_state', 'error_page', 'loading_copy', 'success_toast', 'placeholder_text', 'morning_brief_narrative')),
  context_hash TEXT NOT NULL,
  generated_text TEXT NOT NULL,
  drift_check_score INTEGER,
  generated_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS acc_slot_hash_idx ON ambient_copy_cache(slot, context_hash);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS riddles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  answer_hash TEXT NOT NULL,
  public_reward_content TEXT NOT NULL,
  loggedin_reward_content TEXT NOT NULL,
  common_wrong_answers TEXT NOT NULL DEFAULT '[]',
  catch_all_wrong_content TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  retired_at_ms INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS riddles_slug_idx ON riddles(slug);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS riddle_resolutions (
  id TEXT PRIMARY KEY,
  riddle_id TEXT NOT NULL REFERENCES riddles(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('public', 'admin', 'customer')),
  user_id TEXT,
  input_hash TEXT NOT NULL,
  resolved_at_ms INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('correct', 'common_wrong', 'novel_wrong', 'catch_all_wrong', 'retired', 'unknown_riddle'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rr_riddle_idx ON riddle_resolutions(riddle_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rr_user_idx ON riddle_resolutions(user_id);
--> statement-breakpoint
ALTER TABLE user ADD COLUMN last_hidden_egg_fired_at_ms INTEGER;
--> statement-breakpoint
ALTER TABLE user ADD COLUMN hidden_egg_tricks_enabled INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE user ADD COLUMN fired_egg_ids_recent TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES ('surprise.hidden_eggs_enabled', 'true', 'boolean', 'Master toggle for hidden egg triggers', 0);
--> statement-breakpoint
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES ('surprise.public_egg_cadence_per_days', '14', 'integer', 'Max eggs per rolling window (days) for public visitors', 0);
--> statement-breakpoint
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES ('surprise.admin_egg_cadence_per_days', '7', 'integer', 'Max eggs per rolling window (days) for authenticated users', 0);
--> statement-breakpoint
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES ('surprise.ambient_copy_refresh_interval_days', '30', 'integer', 'Days before ambient copy auto-refreshes', 0);
--> statement-breakpoint
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES ('surprise.riddle_wrong_answer_fallback_budget_per_riddle', '100', 'integer', 'Max live Claude fallback calls per riddle for novel wrong answers', 0);
