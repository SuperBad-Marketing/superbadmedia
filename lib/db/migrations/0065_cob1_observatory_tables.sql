CREATE TABLE IF NOT EXISTS cost_anomalies (
  id TEXT PRIMARY KEY,
  detector TEXT NOT NULL CHECK (detector IN ('hard_threshold', 'rate', 'learned_band')),
  job TEXT NOT NULL,
  actor_scope TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('low', 'mid', 'severe')),
  first_fired_at_ms INTEGER NOT NULL,
  last_fired_at_ms INTEGER NOT NULL,
  fire_count INTEGER NOT NULL DEFAULT 1,
  observed_value REAL NOT NULL,
  expected_band TEXT NOT NULL,
  diagnosis_json TEXT,
  diagnosis_cost_aud REAL,
  acknowledged_at_ms INTEGER,
  acknowledged_until_ms INTEGER,
  kill_switch_triggered_at_ms INTEGER,
  resolved_at_ms INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cost_anomalies_job_idx ON cost_anomalies(job, first_fired_at_ms);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cost_anomalies_tier_idx ON cost_anomalies(tier, first_fired_at_ms);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cost_anomalies_unresolved_idx ON cost_anomalies(resolved_at_ms, tier, last_fired_at_ms);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS deploy_events (
  id TEXT PRIMARY KEY,
  commit_sha TEXT NOT NULL,
  deployed_at_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('deploying', 'ready', 'failed')),
  preview_url TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deploy_events_deployed_idx ON deploy_events(deployed_at_ms);
