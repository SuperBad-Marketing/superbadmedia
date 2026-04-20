-- FD-4: Finance export tracking + retention purge task type
CREATE TABLE IF NOT EXISTS finance_exports (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  period_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  file_path TEXT,
  filename TEXT,
  file_size_bytes INTEGER,
  error_message TEXT,
  requested_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL
);
