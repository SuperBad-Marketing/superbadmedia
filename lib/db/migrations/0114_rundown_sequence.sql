-- Rundown post-completion nurture sequence
-- Adds city + location fields to rundown_sessions
-- Creates rundown_sequence_emails for per-email engagement tracking

ALTER TABLE rundown_sessions ADD COLUMN city TEXT;
ALTER TABLE rundown_sessions ADD COLUMN is_melbourne_area INTEGER;

CREATE TABLE IF NOT EXISTS rundown_sequence_emails (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  email_number INTEGER NOT NULL,
  track TEXT NOT NULL DEFAULT 'non_melbourne',
  scheduled_task_id TEXT,

  status TEXT NOT NULL DEFAULT 'pending',

  subject TEXT,
  body_html TEXT,

  sent_at_ms INTEGER,
  opened_at_ms INTEGER,
  open_count INTEGER NOT NULL DEFAULT 0,
  clicked_at_ms INTEGER,
  clicked_links TEXT,
  reply_received_at_ms INTEGER,
  reply_classification TEXT,
  resend_message_id TEXT,

  cancelled_at_ms INTEGER,
  cancel_reason TEXT,

  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS rundown_seq_session_idx ON rundown_sequence_emails(session_id);
CREATE INDEX IF NOT EXISTS rundown_seq_candidate_idx ON rundown_sequence_emails(candidate_id);
CREATE INDEX IF NOT EXISTS rundown_seq_status_idx ON rundown_sequence_emails(status, email_number);
CREATE INDEX IF NOT EXISTS rundown_seq_task_idx ON rundown_sequence_emails(scheduled_task_id);
