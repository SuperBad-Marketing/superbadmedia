CREATE TABLE IF NOT EXISTS brief_storyboards (
  id                TEXT PRIMARY KEY,
  brief_id          TEXT NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'generating',
  scenes_json       TEXT,
  shotlist_json     TEXT,
  chat_history_json TEXT DEFAULT '[]',
  error_message     TEXT,
  generated_at_ms   INTEGER,
  created_at_ms     INTEGER NOT NULL,
  updated_at_ms     INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS brief_storyboards_brief_idx ON brief_storyboards(brief_id);
