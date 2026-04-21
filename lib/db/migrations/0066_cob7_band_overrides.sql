CREATE TABLE IF NOT EXISTS band_overrides (
  job TEXT PRIMARY KEY,
  per_call_ceiling_aud REAL,
  daily_ceiling_aud REAL,
  learned_band_multiplier REAL,
  updated_at_ms INTEGER NOT NULL
);
