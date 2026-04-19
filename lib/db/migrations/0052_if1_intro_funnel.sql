CREATE TABLE `intro_funnel_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`deal_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`submitted_name` text NOT NULL,
	`submitted_business_name` text NOT NULL,
	`submitted_email` text NOT NULL,
	`submitted_phone` text NOT NULL,
	`sms_opt_in` integer DEFAULT true NOT NULL,
	`sms_consent_at_ms` integer,
	`shape` text NOT NULL,
	`funnel_state` text DEFAULT 'contact_submitted' NOT NULL,
	`questionnaire_answers_json` text,
	`questionnaire_sections_completed` integer DEFAULT 0 NOT NULL,
	`signal_tags_json` text,
	`abandon_sequence_state` text DEFAULT 'pending' NOT NULL,
	`last_activity_at_ms` integer NOT NULL,
	`gallery_ready_at_ms` integer,
	`plan_ready_at_ms` integer,
	`deliverables_ready_at_ms` integer,
	`bundled_hub_seen_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intro_funnel_submissions_token_unique` ON `intro_funnel_submissions` (`token`);--> statement-breakpoint
CREATE INDEX `ifs_deal_idx` ON `intro_funnel_submissions` (`deal_id`);--> statement-breakpoint
CREATE INDEX `ifs_contact_idx` ON `intro_funnel_submissions` (`contact_id`);--> statement-breakpoint
CREATE INDEX `ifs_token_idx` ON `intro_funnel_submissions` (`token`);--> statement-breakpoint
CREATE INDEX `ifs_state_idx` ON `intro_funnel_submissions` (`funnel_state`);--> statement-breakpoint
CREATE TABLE `intro_funnel_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`deal_id` text NOT NULL,
	`stripe_payment_intent_id` text NOT NULL,
	`stripe_customer_id` text,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'aud' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`refund_amount_cents` integer,
	`refund_reason_code` text,
	`refunded_at_ms` integer,
	`paid_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `intro_funnel_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intro_funnel_payments_stripe_payment_intent_id_unique` ON `intro_funnel_payments` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `ifp_submission_idx` ON `intro_funnel_payments` (`submission_id`);--> statement-breakpoint
CREATE INDEX `ifp_deal_idx` ON `intro_funnel_payments` (`deal_id`);--> statement-breakpoint
CREATE INDEX `ifp_stripe_pi_idx` ON `intro_funnel_payments` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE TABLE `intro_funnel_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`deal_id` text NOT NULL,
	`payment_id` text NOT NULL,
	`slot_start_at_ms` integer NOT NULL,
	`slot_end_at_ms` integer NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`reschedule_count` integer DEFAULT 0 NOT NULL,
	`cancelled_at_ms` integer,
	`cancelled_by` text,
	`cancelled_reason_code` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `intro_funnel_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payment_id`) REFERENCES `intro_funnel_payments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ifb_submission_idx` ON `intro_funnel_bookings` (`submission_id`);--> statement-breakpoint
CREATE INDEX `ifb_deal_idx` ON `intro_funnel_bookings` (`deal_id`);--> statement-breakpoint
CREATE INDEX `ifb_slot_idx` ON `intro_funnel_bookings` (`slot_start_at_ms`);--> statement-breakpoint
CREATE TABLE `intro_funnel_reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`deal_id` text NOT NULL,
	`answers_json` text NOT NULL,
	`safety_valve_triggered` integer DEFAULT false NOT NULL,
	`synthesis_text` text,
	`synthesis_model` text,
	`synthesis_prompt_version` text,
	`synthesis_drift_check_passed` integer,
	`synthesis_generated_at_ms` integer,
	`decision_cta_choice` text,
	`decision_made_at_ms` integer,
	`completed_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `intro_funnel_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ifr_submission_idx` ON `intro_funnel_reflections` (`submission_id`);--> statement-breakpoint
CREATE INDEX `ifr_deal_idx` ON `intro_funnel_reflections` (`deal_id`);--> statement-breakpoint
CREATE TABLE `intro_funnel_retainer_fit` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`deal_id` text NOT NULL,
	`recommendation_type` text NOT NULL,
	`confidence` text NOT NULL,
	`reasoning_text` text NOT NULL,
	`flags_json` text,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`drift_check_passed` integer DEFAULT true NOT NULL,
	`generated_at_ms` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `intro_funnel_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ifrf_submission_idx` ON `intro_funnel_retainer_fit` (`submission_id`);--> statement-breakpoint
CREATE INDEX `ifrf_deal_idx` ON `intro_funnel_retainer_fit` (`deal_id`);--> statement-breakpoint
CREATE TABLE `intro_funnel_config` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`price_cents` integer DEFAULT 29700 NOT NULL,
	`currency` text DEFAULT 'aud' NOT NULL,
	`landing_hero_copy` text,
	`landing_commitment_copy` text,
	`confirmation_email_subject` text,
	`confirmation_email_body` text,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_type` text NOT NULL,
	`start_at_ms` integer NOT NULL,
	`end_at_ms` integer NOT NULL,
	`subject_ref_table` text NOT NULL,
	`subject_ref_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata_json` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cb_type_start_idx` ON `calendar_bookings` (`booking_type`,`start_at_ms`);--> statement-breakpoint
CREATE INDEX `cb_ref_idx` ON `calendar_bookings` (`subject_ref_table`,`subject_ref_id`);--> statement-breakpoint
CREATE TABLE `calendar_config` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`timezone` text DEFAULT 'Australia/Melbourne' NOT NULL,
	`business_hours_json` text NOT NULL,
	`blackout_dates_json` text,
	`intro_funnel_advance_notice_business_days` integer DEFAULT 5 NOT NULL,
	`intro_funnel_per_week_cap` integer DEFAULT 3 NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dnc_phones` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`reason` text NOT NULL,
	`source_note` text,
	`added_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dnc_phones_phone_unique` ON `dnc_phones` (`phone`);--> statement-breakpoint
CREATE TABLE `twilio_sms_log` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text,
	`deal_id` text,
	`direction` text NOT NULL,
	`twilio_message_sid` text NOT NULL,
	`from_number` text NOT NULL,
	`to_number` text NOT NULL,
	`body` text NOT NULL,
	`status` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `intro_funnel_submissions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `twilio_sms_log_twilio_message_sid_unique` ON `twilio_sms_log` (`twilio_message_sid`);--> statement-breakpoint
CREATE INDEX `tsl_submission_idx` ON `twilio_sms_log` (`submission_id`);--> statement-breakpoint
CREATE INDEX `tsl_deal_idx` ON `twilio_sms_log` (`deal_id`);--> statement-breakpoint
CREATE INDEX `tsl_sid_idx` ON `twilio_sms_log` (`twilio_message_sid`);--> statement-breakpoint
ALTER TABLE `contacts` ADD `sms_opt_in` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `sms_consent_at_ms` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `funnel_submission_id` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `funnel_state` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `post_trial_signal` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `reschedule_count` integer DEFAULT 0 NOT NULL;
