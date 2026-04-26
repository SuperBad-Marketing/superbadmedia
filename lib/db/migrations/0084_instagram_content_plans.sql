CREATE TABLE IF NOT EXISTS instagram_content_plans (
  id                  TEXT PRIMARY KEY,
  account_id          TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  strategy_report_id  TEXT,
  week_start_date     TEXT NOT NULL,
  week_end_date       TEXT NOT NULL,
  theme_summary       TEXT NOT NULL,
  slots_json          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'awaiting_review',
  nudge_sent          INTEGER NOT NULL DEFAULT 0,
  reviewed_at_ms      INTEGER,
  created_at_ms       INTEGER NOT NULL,
  updated_at_ms       INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ig_plans_account_week_idx ON instagram_content_plans(account_id, week_start_date);
CREATE INDEX IF NOT EXISTS ig_plans_status_idx ON instagram_content_plans(status);
