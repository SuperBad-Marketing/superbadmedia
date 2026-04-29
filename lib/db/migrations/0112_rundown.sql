CREATE TABLE IF NOT EXISTS rundown_sessions (
  id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  resume_token TEXT,

  name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalised TEXT NOT NULL,
  business_name TEXT NOT NULL,
  website TEXT,
  instagram_handle TEXT,

  candidate_id TEXT,
  profile_id TEXT,
  outreach_candidate_id TEXT,

  status TEXT NOT NULL DEFAULT 'entry_submitted',
  source_type TEXT NOT NULL DEFAULT 'public',

  tier_preference TEXT,
  cta_clicked_at_ms INTEGER,
  booking_token TEXT,

  pack_downloaded_at_ms INTEGER,

  followup_email_sent_at_ms INTEGER,
  reveal_access_token TEXT,
  reveal_access_expires_at_ms INTEGER,

  entry_submitted_at_ms INTEGER NOT NULL,
  assessment_started_at_ms INTEGER,
  section_1_completed_at_ms INTEGER,
  section_2_completed_at_ms INTEGER,
  section_3_completed_at_ms INTEGER,
  section_4_completed_at_ms INTEGER,
  section_5_completed_at_ms INTEGER,
  reveal_reached_at_ms INTEGER,
  completed_at_ms INTEGER,

  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT,

  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rundown_sessions_email_idx ON rundown_sessions(email_normalised);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rundown_sessions_candidate_idx ON rundown_sessions(candidate_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rundown_sessions_token_idx ON rundown_sessions(session_token);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rundown_sessions_status_idx ON rundown_sessions(status, created_at_ms);
--> statement-breakpoint
ALTER TABLE brand_dna_profiles ADD COLUMN candidate_id TEXT;
--> statement-breakpoint
ALTER TABLE companies ADD COLUMN viability_profile_json TEXT;
--> statement-breakpoint
ALTER TABLE companies ADD COLUMN enrichment_summary TEXT;
--> statement-breakpoint
ALTER TABLE companies ADD COLUMN enriched_at_ms INTEGER;
--> statement-breakpoint
ALTER TABLE brand_dna_profiles ADD COLUMN brand_pack_json TEXT;
