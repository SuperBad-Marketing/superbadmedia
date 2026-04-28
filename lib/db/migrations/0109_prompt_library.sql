-- Prompt library for saving known-good generation prompts
CREATE TABLE IF NOT EXISTS prompt_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  engine TEXT,
  tags_json TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at_ms INTEGER,
  source_job_id TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS pl_category_idx ON prompt_library(category);
CREATE INDEX IF NOT EXISTS pl_use_count_idx ON prompt_library(use_count);
