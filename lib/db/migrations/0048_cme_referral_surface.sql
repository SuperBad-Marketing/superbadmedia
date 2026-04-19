ALTER TABLE `deals` ADD `referral_from_company_id` text REFERENCES `companies`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `deals` ADD `referral_from_contact_id` text REFERENCES `contacts`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `contacts` ADD `last_referral_prompt_at_ms` integer;--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('referral.milestone_prompt_cooldown_days', '30', 'integer', 'Min days between contextual referral prompts per client', 0);
