-- SuperBad Profile — source of truth for business identity
-- Spec: docs/specs/superbad-profile.md

CREATE TABLE IF NOT EXISTS business_profile_sections (
  id                    TEXT PRIMARY KEY,
  section_key           TEXT NOT NULL,
  structured_data       TEXT NOT NULL DEFAULT '{}',
  prose_summary         TEXT,
  prose_generated_at_ms INTEGER,
  prose_manually_edited INTEGER NOT NULL DEFAULT 0,
  version               INTEGER NOT NULL DEFAULT 1,
  is_current            INTEGER NOT NULL DEFAULT 1,
  updated_by            TEXT NOT NULL,
  updated_at_ms         INTEGER NOT NULL,
  created_at_ms         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS bps_section_current_idx
  ON business_profile_sections (section_key, is_current);

CREATE INDEX IF NOT EXISTS bps_section_version_idx
  ON business_profile_sections (section_key, version);

CREATE TABLE IF NOT EXISTS business_profile_suggestions (
  id                TEXT PRIMARY KEY,
  section_key       TEXT NOT NULL,
  field_path        TEXT,
  suggestion_type   TEXT NOT NULL,
  source            TEXT NOT NULL,
  source_entity_id  TEXT,
  title             TEXT NOT NULL,
  detail            TEXT NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending',
  surfaced_in_brief INTEGER NOT NULL DEFAULT 0,
  created_at_ms     INTEGER NOT NULL,
  resolved_at_ms    INTEGER
);

CREATE INDEX IF NOT EXISTS bps_sugg_status_created_idx
  ON business_profile_suggestions (status, created_at_ms);

-- Seed profile settings keys
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES
  ('profile.stale_threshold_days', '90', 'integer', 'Days before a profile section is flagged as stale', strftime('%s','now') * 1000),
  ('profile.suggestion_expiry_days', '30', 'integer', 'Days before an unresolved profile suggestion auto-expires', strftime('%s','now') * 1000),
  ('profile.cache_ttl_minutes', '10', 'integer', 'In-memory cache TTL for assembled profile context', strftime('%s','now') * 1000),
  ('profile.health_check_hour', '4', 'integer', 'Melbourne hour (0-23) when the daily profile health check runs', strftime('%s','now') * 1000),
  ('profile.enforcement_enabled', 'true', 'boolean', 'Kill switch — disabling reverts all LLM calls to pre-profile behaviour', strftime('%s','now') * 1000);
