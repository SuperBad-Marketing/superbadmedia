CREATE TABLE IF NOT EXISTS talking_head_session_packs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft',
  energy_level TEXT NOT NULL DEFAULT 'default',
  target_date TEXT,
  script_count INTEGER NOT NULL DEFAULT 4,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS th_packs_status_idx ON talking_head_session_packs (status, created_at_ms);

CREATE TABLE IF NOT EXISTS talking_head_scripts (
  id TEXT PRIMARY KEY,
  session_pack_id TEXT NOT NULL,
  pillar_slug TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generated',
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  estimated_duration_sec INTEGER NOT NULL,
  script_json TEXT NOT NULL DEFAULT '{}',
  edit_brief_json TEXT,
  publish_meta_json TEXT,
  energy_level TEXT NOT NULL DEFAULT 'default',
  signal_source TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS th_scripts_pack_idx ON talking_head_scripts (session_pack_id, sort_order);
CREATE INDEX IF NOT EXISTS th_scripts_status_idx ON talking_head_scripts (status);
