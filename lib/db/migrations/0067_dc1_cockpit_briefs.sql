CREATE TABLE IF NOT EXISTS cockpit_briefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  brief_date TEXT NOT NULL,
  generated_at_ms INTEGER NOT NULL,
  trigger TEXT NOT NULL,
  trigger_event TEXT,
  prose TEXT NOT NULL,
  signals_snapshot TEXT NOT NULL,
  model_version TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cockpit_briefs_user_date_idx ON cockpit_briefs(user_id, brief_date);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS cockpit_briefs_unique_slot_idx ON cockpit_briefs(user_id, slot, brief_date);
