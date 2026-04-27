-- Add business context fields to brand_dna_profiles.
-- Stores free-text answers from the pre-assessment context step:
-- what the business does, who the customers are, competitive differentiator.
ALTER TABLE brand_dna_profiles ADD COLUMN business_context TEXT;
