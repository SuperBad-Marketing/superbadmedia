-- Decouple outreach sequences and sends from deals.
-- Sequences and sends can now be linked to a candidate_id directly,
-- without requiring a deal to exist first.

ALTER TABLE outreach_sequences ADD COLUMN candidate_id TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS outreach_sequences_candidate_idx ON outreach_sequences (candidate_id);
--> statement-breakpoint
ALTER TABLE outreach_sends ADD COLUMN candidate_id TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS outreach_sends_candidate_idx ON outreach_sends (candidate_id);
--> statement-breakpoint
ALTER TABLE outreach_sends ADD COLUMN delivered_at INTEGER;
