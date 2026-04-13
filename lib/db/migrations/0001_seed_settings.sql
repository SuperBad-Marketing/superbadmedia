-- Seeds the settings table with the v1.0 registry (67 keys).
-- Source of truth: docs/settings-registry.md.
-- Updating a default here requires the corresponding registry row change.

-- Finance (11)
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('finance.gst_rate', '0.10', 'decimal', 'Australian GST rate; onboarding-confirmed', 0),
  ('finance.income_tax_rate', '0.25', 'decimal', 'Andy''s income tax rate; onboarding-confirmed with accountant', 0),
  ('finance.bas_reminder_days_ahead', '14', 'integer', 'Days before BAS quarter end when cockpit banner fires', 0),
  ('finance.eofy_reminder_days_ahead', '30', 'integer', 'Days before FY end when cockpit banner fires', 0),
  ('finance.overdue_invoice_threshold_days', '30', 'integer', 'Days past due that triggers overdue banner', 0),
  ('finance.outstanding_invoices_threshold_aud', '5000', 'integer', 'Total outstanding AUD threshold for banner', 0),
  ('finance.snapshot_time_local', '06:00', 'string', 'Daily snapshot cron time, Australia/Melbourne', 0),
  ('finance.projection_horizon_days', '90', 'integer', 'Forward projection window', 0),
  ('finance.stage_age_decay_halflife_days', '30', 'integer', 'Days past expected stage dwell when probability halves', 0),
  ('finance.recurring_review_debounce_hours', '168', 'integer', 'Weekly cadence for the recurring-expense review chip', 0),
  ('finance.export_retention_days', '90', 'integer', 'Filesystem retention for generated export zips', 0);
--> statement-breakpoint

-- Setup Wizards (6)
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('wizards.expiry_days', '30', 'integer', 'Days from last activity before an in-flight wizard expires', 0),
  ('wizards.resume_nudge_hours', '24', 'integer', 'Hours of inactivity before a resume email sends', 0),
  ('wizards.admin_cockpit_banner_days', '7', 'integer', 'Days before an in-flight admin wizard shows a cockpit health banner', 0),
  ('wizards.help_escalation_failure_count', '2', 'integer', 'Consecutive step failures before the help affordance appears', 0),
  ('wizards.step_retry_max', '3', 'integer', 'Hard cap on retries per step before shell surfaces a permanent error state', 0),
  ('wizards.critical_flight_wizards', '["stripe-admin","resend","graph-api-admin"]', 'json', 'Ordered list of critical-flight wizard keys', 0);
--> statement-breakpoint

-- Six-Week Plan Generator (10)
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('plan.portal_access_days_post_shoot', '60', 'integer', 'Days of portal access for non-converters, from shoot completion', 0),
  ('plan.chat_calls_per_day_non_converter', '5', 'integer', 'Daily Opus chat call cap for pre-retainer portal chat', 0),
  ('plan.revision_note_min_chars', '40', 'integer', 'Minimum characters for a prospect''s revision note', 0),
  ('plan.observations_min_chars', '40', 'integer', 'Minimum characters for Andy''s shoot-day observations', 0),
  ('plan.regen_soft_warning_threshold', '4', 'integer', 'Regens on a single plan within 24h that triggers soft warning', 0),
  ('plan.pdf_cache_hours', '24', 'integer', 'Hours to cache a rendered PDF before regenerating', 0),
  ('plan.self_review_retry_on_fail', '1', 'integer', 'Max retries on stage 2 if self-review flags issues', 0),
  ('plan.extend_portal_days_on_manual_override', '30', 'integer', 'Default days added when Andy manually extends a non-converter portal', 0),
  ('plan.expiry_email_days_before_archive', '7', 'integer', 'Days before the day-60 archive at which the wind-down expiry email fires', 0),
  ('plan.refresh_review_block_escalation_hours', '24', 'integer', 'Hours before the cockpit pending-refresh-review banner escalates amber to red', 0);
--> statement-breakpoint

-- Portal (5)
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('portal.non_converter_archive_days', '60', 'integer', 'Days post-shoot-completion before non-converter portal archives', 0),
  ('portal.chat_calls_per_day_pre_retainer', '5', 'integer', 'Daily Opus chat call cap in pre-retainer rendering mode', 0),
  ('portal.chat_calls_per_day_retainer', '25', 'integer', 'Daily Opus chat call cap for retainer clients', 0),
  ('portal.magic_link_ttl_hours', '168', 'integer', 'TTL for magic-link OTTs embedded in journey-beat emails and recovery-form sends', 0),
  ('portal.session_cookie_ttl_days', '90', 'integer', 'Rolling TTL for the portal-guard session cookie', 0);
--> statement-breakpoint

-- Intro Funnel (1)
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('intro_funnel.reflection_delay_hours_after_deliverables', '24', 'integer', 'Hours after deliverables_ready before the reflection CTA appears', 0);
--> statement-breakpoint

-- Hiring Pipeline (28)
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('hiring.discovery.llm_run_cadence', 'weekly', 'enum', 'weekly / fortnightly / monthly / off (per Role Brief)', 0),
  ('hiring.discovery.llm_max_cost_aud_per_run', '1.00', 'decimal', 'Hard cap per Role per run', 0),
  ('hiring.discovery.llm_candidates_per_run', '5', 'integer', 'Top-N candidates surfaced', 0),
  ('hiring.discovery.weekly_cost_warn_threshold_aud', '10.00', 'decimal', 'Weekly spend warning', 0),
  ('hiring.discovery.vimeo_enabled', 'true', 'boolean', 'Vimeo adapter kill switch', 0),
  ('hiring.discovery.behance_enabled', 'true', 'boolean', 'Behance adapter kill switch', 0),
  ('hiring.discovery.ig_on_demand_enabled', 'true', 'boolean', 'Apify IG adapter kill switch', 0),
  ('hiring.discovery.llm_agent_enabled', 'true', 'boolean', 'Discovery agent master kill switch', 0),
  ('hiring.discovery.sourced_review_window_days', '5', 'integer', 'Sourced-column staleness nudge window', 0),
  ('hiring.discovery.auto_invite_score_threshold', '0.90', 'decimal', 'Auto-draft invites on discovery candidates scoring above this', 0),
  ('hiring.invite.auto_send_enabled', 'true', 'boolean', 'Invite send gate master kill switch', 0),
  ('hiring.invite.auto_send_confidence_threshold', '0.85', 'decimal', 'Confidence above which auto-send fires', 0),
  ('hiring.invite.ft_auto_send_confidence_threshold', '0.95', 'decimal', 'FT bar, higher', 0),
  ('hiring.invite.daily_send_cap_per_role', '3', 'integer', 'Per-Role daily ceiling', 0),
  ('hiring.invite.per_candidate_throttle_days', '90', 'integer', 'Same candidate + Role window', 0),
  ('hiring.invite.cross_role_max_per_candidate_per_year', '3', 'integer', 'Cross-Role anti-spam', 0),
  ('hiring.apply.followup_reply_wait_days', '7', 'integer', 'Wait before flagging no-reply', 0),
  ('hiring.apply.rate_bands', '[]', 'json', 'Closed-list rate band options (bands TBD by hiring spec)', 0),
  ('hiring.trial.delivery_deadline_days', '7', 'integer', 'Default due-date offset', 0),
  ('hiring.trial.delivery_grace_days', '3', 'integer', 'Grace before auto-archive', 0),
  ('hiring.trial.default_budget_cap_hours', '4', 'integer', 'Default budget = rate x hours', 0),
  ('hiring.brief.archive_retune_threshold', '10', 'integer', 'Cumulative archives before auto-retune', 0),
  ('hiring.brief.regen_on_bench_entry', 'true', 'boolean', 'Re-run on new bench entry', 0),
  ('hiring.bench.pause_ending_warn_days', '2', 'integer', 'Warn ahead of resume', 0),
  ('hiring.staleness.sourced_days', '14', 'integer', 'Sourced staleness threshold', 0),
  ('hiring.staleness.invited_days', '10', 'integer', 'Invited staleness threshold', 0),
  ('hiring.staleness.applied_days', '7', 'integer', 'Applied staleness threshold', 0),
  ('hiring.staleness.screened_days', '5', 'integer', 'Screened staleness threshold', 0);
--> statement-breakpoint

-- Email adapter (4 — A7 pre-reqs)
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('email.quiet_window_start_hour', '8', 'integer', 'A7 outreach quiet-window gate start hour (local)', 0),
  ('email.quiet_window_end_hour', '18', 'integer', 'A7 outreach quiet-window gate end hour (local)', 0),
  ('email.drift_check_threshold', '0.7', 'decimal', 'A7 brand-voice drift grader threshold', 0),
  ('email.drift_retry_count', '1', 'integer', 'A7 drift-grader retry count before flagging for review', 0);
--> statement-breakpoint

-- Alerts (3 — B1 pre-reqs)
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('alerts.anthropic_daily_cap_aud', '25.00', 'decimal', 'Daily Anthropic spend cap before cost alert fires', 0),
  ('alerts.stripe_fee_anomaly_multiplier', '2.0', 'decimal', 'Multiplier on weekly-median Stripe fees that triggers anomaly alert', 0),
  ('alerts.resend_bounce_rate_threshold', '0.05', 'decimal', 'Resend bounce-rate threshold that triggers sender-reputation alert', 0);
--> statement-breakpoint

-- Legal (2 — B3)
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('legal.dsr_email', 'privacy@superbadmedia.com.au', 'string', 'Privacy Act DSR contact address — disclosed in Privacy Policy', 0),
  ('legal.dsr_response_days', '30', 'integer', 'Statutory DSR response commitment (days) — Privacy Act 1988 (Cth)', 0);
