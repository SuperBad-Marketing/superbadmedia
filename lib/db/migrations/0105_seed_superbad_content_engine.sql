-- Seed SuperBad Marketing as a content engine company so the admin
-- can generate internal blog posts / newsletter content for superbadmedia.com.au.

INSERT OR IGNORE INTO companies (
  id, name, name_normalised, domain, industry, size_band,
  billing_mode, do_not_contact, trial_shoot_status,
  gst_applicable, payment_terms_days,
  first_seen_at_ms, created_at_ms, updated_at_ms
) VALUES (
  'co-superbad',
  'SuperBad Marketing',
  'superbad marketing',
  'superbadmedia.com.au',
  'creative_media',
  'small',
  'manual',
  0,
  'none',
  1,
  14,
  unixepoch() * 1000,
  unixepoch() * 1000,
  unixepoch() * 1000
);

INSERT OR IGNORE INTO content_engine_config (
  id, company_id,
  seed_keywords,
  send_window_day, send_window_time, send_window_tz,
  created_at_ms, updated_at_ms
) VALUES (
  'ce-superbad',
  'co-superbad',
  '[]',
  'tuesday',
  '10:00',
  'Australia/Melbourne',
  unixepoch() * 1000,
  unixepoch() * 1000
);
