-- Episode production pipeline — ideas pool + production tracker
CREATE TABLE IF NOT EXISTS productions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject_name TEXT,
  subject_type TEXT,
  initial_thought TEXT,
  status TEXT NOT NULL DEFAULT 'idea',

  generated_angles_json TEXT,

  narrative_angle TEXT,
  key_moments_json TEXT,
  voiceover_hook TEXT,
  shot_list_json TEXT,
  gear_notes TEXT,
  release_checklist_json TEXT,

  clips_json TEXT,

  shoot_date TEXT,
  location TEXT,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,

  published_url TEXT,
  thumbnail_url TEXT,

  sort_order INTEGER NOT NULL DEFAULT 0,
  promoted_at_ms INTEGER,
  published_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS prod_status_idx ON productions(status);
CREATE INDEX IF NOT EXISTS prod_created_idx ON productions(created_at_ms);
CREATE INDEX IF NOT EXISTS prod_company_idx ON productions(company_id);
CREATE INDEX IF NOT EXISTS prod_shoot_idx ON productions(shoot_date);

-- Per-episode chat thread for LLM brainstorming
CREATE TABLE IF NOT EXISTS production_chat_messages (
  id TEXT PRIMARY KEY,
  production_id TEXT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS pcm_production_idx ON production_chat_messages(production_id, created_at_ms);
