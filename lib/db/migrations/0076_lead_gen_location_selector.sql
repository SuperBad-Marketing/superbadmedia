-- Lead gen location: structured city/country selector with global mode
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES
  ('lead_generation.location_mode', 'local', 'string', 'Location targeting mode: local (city+country) or global (auto-targeting for SaaS)', strftime('%s','now') * 1000),
  ('lead_generation.location_country', 'Australia', 'string', 'Target country for local mode', strftime('%s','now') * 1000),
  ('lead_generation.location_country_code', 'AU', 'string', 'ISO 2-letter country code for local mode', strftime('%s','now') * 1000);
