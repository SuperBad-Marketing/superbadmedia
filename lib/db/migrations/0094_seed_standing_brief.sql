-- Seed: standing brief for lead generation outreach.
-- Replaces the empty default with a strategic brief that anchors every outreach email.

UPDATE settings
SET value = 'Service businesses in Melbourne and greater Victoria with strong reputations but weak online presence. The kind of business where the owner is too busy doing the work to market it properly — great Google reviews, loyal customers, but their website and social media don''t reflect what they actually deliver. Ideal revenue range: $300k–$2M+. Any vertical. If there''s a story behind the business and they have ambition, they''re a good fit. We''re not looking for businesses that need saving. We''re looking for good businesses that should be more visible than they are.',
    updated_at_ms = 1745712000000
WHERE key = 'lead_generation.standing_brief'
  AND (value = '' OR value IS NULL);
