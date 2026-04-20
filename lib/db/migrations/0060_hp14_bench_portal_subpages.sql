-- HP-14: Contractor portal sub-pages — invoices table + edit requests table

CREATE TABLE IF NOT EXISTS contractor_invoices (
  id TEXT PRIMARY KEY NOT NULL,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  amount_aud INTEGER NOT NULL,
  reference TEXT NOT NULL,
  pdf_filename TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  submitted_at_ms INTEGER NOT NULL,
  reviewed_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS contractor_invoices_candidate_idx ON contractor_invoices(candidate_id);
CREATE INDEX IF NOT EXISTS contractor_invoices_status_idx ON contractor_invoices(status);

CREATE TABLE IF NOT EXISTS candidate_edit_requests (
  id TEXT PRIMARY KEY NOT NULL,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at_ms INTEGER NOT NULL,
  reviewed_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS candidate_edit_requests_candidate_idx ON candidate_edit_requests(candidate_id);
CREATE INDEX IF NOT EXISTS candidate_edit_requests_status_idx ON candidate_edit_requests(status);
