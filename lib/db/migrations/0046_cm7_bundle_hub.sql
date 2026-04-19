-- CM-7: Bundled first-visit hub (Gallery + Plan tiles)
-- Adds bundled_hub_seen_at_ms to contacts for one-shot hub tracking.
-- Temporary home — migrates to intro_funnel_submissions when IF-1 lands.

ALTER TABLE contacts ADD COLUMN bundled_hub_seen_at_ms INTEGER;
