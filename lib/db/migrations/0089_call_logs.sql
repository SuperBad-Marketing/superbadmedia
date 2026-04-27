CREATE TABLE IF NOT EXISTS call_logs (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  stage_at_time TEXT NOT NULL,
  template_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prep',
  temperature TEXT,
  agreed_next_step TEXT,
  follow_up_date_ms INTEGER,
  blockers TEXT,
  sections_data TEXT,
  llm_briefing TEXT,
  llm_custom_questions TEXT,
  llm_synthesis TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS call_logs_deal_idx ON call_logs(deal_id);
CREATE INDEX IF NOT EXISTS call_logs_company_idx ON call_logs(company_id);
CREATE INDEX IF NOT EXISTS call_logs_status_idx ON call_logs(status);
