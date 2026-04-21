CREATE TABLE IF NOT EXISTS riddle_novel_wrong_cache (
  id TEXT PRIMARY KEY,
  riddle_id TEXT NOT NULL REFERENCES riddles(id) ON DELETE CASCADE,
  input_hash TEXT NOT NULL,
  response TEXT NOT NULL,
  drift_check_score INTEGER,
  created_at_ms INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rnwc_riddle_hash_idx ON riddle_novel_wrong_cache(riddle_id, input_hash);
