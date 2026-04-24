-- Trial shoot tiered pricing: Session ($397) and Production ($597)
ALTER TABLE intro_funnel_submissions ADD COLUMN selected_tier TEXT NOT NULL DEFAULT 'session';
ALTER TABLE intro_funnel_submissions ADD COLUMN submitted_website_url TEXT;
ALTER TABLE intro_funnel_submissions ADD COLUMN submitted_intent TEXT;

INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES
  ('trial_shoot.session_price_cents', '39700', 'number', 'Session tier price in cents (GST inclusive)', strftime('%s','now') * 1000),
  ('trial_shoot.production_price_cents', '59700', 'number', 'Production tier price in cents (GST inclusive)', strftime('%s','now') * 1000),
  ('trial_shoot.session_duration_minutes', '90', 'number', 'Session tier shoot duration in minutes', strftime('%s','now') * 1000),
  ('trial_shoot.production_duration_minutes', '120', 'number', 'Production tier shoot duration in minutes', strftime('%s','now') * 1000);
