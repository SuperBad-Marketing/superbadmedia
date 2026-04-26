-- Seed GPS coordinates for geo-anchored lead gen search (Google Maps ll parameter).
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES
  ('lead_generation.location_lat', '-37.8136', 'number', 'Latitude of search centre for Google Maps discovery', strftime('%s','now') * 1000),
  ('lead_generation.location_lng', '144.9631', 'number', 'Longitude of search centre for Google Maps discovery', strftime('%s','now') * 1000);
