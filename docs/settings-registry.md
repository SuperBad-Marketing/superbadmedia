# Settings Key Registry

Authoritative source of truth for every `settings.get(key)` key consumed by Lite at v1.0. Seeded into the `settings` table at the Phase 5 foundation session.

## How this file works

- **Source of truth at v1.0** — this file compiles every key declared in each spec's `## Settings keys` section.
- **Never edit in feature code.** Feature code reads via `settings.get(key)` only. Adding a literal to code is a bug.
- **Adding a key:** update this table, update the owner spec's `## Settings keys` section, add the row to the seed migration produced in Phase 5 Session A.
- **Editor UI is v1.1.** At v1.0 Andy edits values via direct DB write or a seed-migration follow-up. Per `project_settings_table_v1_architecture` memory.

## Key format

- Lowercase dot-notation. First segment = owning feature (`finance`, `wizards`, `plan`, `portal`, `hiring`).
- Keys are stable identifiers. Renaming a key requires a migration + every consumer patched.
- Defaults listed here are the seeded values. Live overrides stored in `settings` table take precedence.

---

## Finance (owner: `docs/specs/finance-dashboard.md` §5)

| Key | Default | Type | Description |
|---|---|---|---|
| `finance.gst_rate` | `0.10` | decimal | Australian GST rate; onboarding-confirmed |
| `finance.income_tax_rate` | `0.25` | decimal | Andy's income tax rate; onboarding-confirmed with accountant |
| `finance.bas_reminder_days_ahead` | `14` | integer | Days before BAS quarter end when cockpit banner fires |
| `finance.eofy_reminder_days_ahead` | `30` | integer | Days before FY end when cockpit banner fires |
| `finance.overdue_invoice_threshold_days` | `30` | integer | Days past due that triggers overdue banner |
| `finance.outstanding_invoices_threshold_aud` | `5000` | integer | Total outstanding AUD threshold for banner |
| `finance.snapshot_time_local` | `"06:00"` | string | Daily snapshot cron time, Australia/Melbourne |
| `finance.projection_horizon_days` | `90` | integer | Forward projection window |
| `finance.stage_age_decay_halflife_days` | `30` | integer | Days past expected stage dwell when probability halves |
| `finance.recurring_review_debounce_hours` | `168` | integer | Weekly cadence for the "3 recurring expenses booked — review" chip |
| `finance.export_retention_days` | `90` | integer | Filesystem retention for generated export zips |

## Setup Wizards (owner: `docs/specs/setup-wizards.md` §12)

| Key | Default | Type | Description |
|---|---|---|---|
| `wizards.expiry_days` | `30` | integer | Days from last activity before an in-flight wizard expires |
| `wizards.resume_nudge_hours` | `24` | integer | Hours of inactivity before a resume email sends |
| `wizards.admin_cockpit_banner_days` | `7` | integer | Days before an in-flight admin wizard shows a cockpit health banner |
| `wizards.help_escalation_failure_count` | `2` | integer | Consecutive step failures before the help affordance appears |
| `wizards.step_retry_max` | `3` | integer | Hard cap on retries per step before shell surfaces a permanent error state |
| `wizards.critical_flight_wizards` | `['stripe-admin','resend','graph-api-admin']` | string[] | Ordered list of critical-flight wizard keys |
| `wizards.dns_verify_poll_interval_ms` | `10000` | integer | `dns-verify` step — resolver poll interval (ms), per SW-2 (2026-04-14) |
| `wizards.async_check_timeout_ms` | `600000` | integer | `async-check` step — long-running job max wait (ms, 10 min), per SW-2 (2026-04-14) |
| `wizards.webhook_probe_timeout_ms` | `300000` | integer | `webhook-probe` step — inbound POST max wait (ms, 5 min), per SW-2 (2026-04-14) |
| `wizards.verify_timeout_ms` | `4000` | integer | Completion-contract `verify()` timeout (ms), per SW-3 (2026-04-14) |

## Six-Week Plan Generator (owner: `docs/specs/six-week-plan-generator.md` §9)

| Key | Default | Type | Description |
|---|---|---|---|
| `plan.portal_access_days_post_shoot` | `60` | integer | Days of portal access for non-converters, from shoot completion |
| `plan.chat_calls_per_day_non_converter` | `5` | integer | Daily Opus chat call cap for pre-retainer portal chat |
| `plan.revision_note_min_chars` | `40` | integer | Minimum characters for a prospect's revision note |
| `plan.observations_min_chars` | `40` | integer | Minimum characters for Andy's shoot-day observations |
| `plan.regen_soft_warning_threshold` | `4` | integer | Regens on a single plan within 24h that triggers soft warning |
| `plan.pdf_cache_hours` | `24` | integer | Hours to cache a rendered PDF before regenerating |
| `plan.self_review_retry_on_fail` | `1` | integer | Max retries on stage 2 if self-review flags issues |
| `plan.extend_portal_days_on_manual_override` | `30` | integer | Default days added when Andy manually extends a non-converter's portal |
| `plan.expiry_email_days_before_archive` | `7` | integer | Days before the day-60 archive at which the wind-down expiry email fires (default: day 53), per F3.d (2026-04-13) |
| `plan.refresh_review_block_escalation_hours` | `24` | integer | Hours since a queued retainer payment after which the cockpit pending-refresh-review banner escalates amber → red, per F4.a (2026-04-13) |

## Portal (owner: `docs/specs/client-management.md` §10; Intro Funnel consumes)

| Key | Default | Type | Description |
|---|---|---|---|
| `portal.non_converter_archive_days` | `60` | integer | Days post-shoot-completion before non-converter portal archives |
| `portal.chat_calls_per_day_pre_retainer` | `5` | integer | Daily Opus chat call cap in pre-retainer rendering mode |
| `portal.chat_calls_per_day_retainer` | `25` | integer | Daily Opus chat call cap for retainer clients |
| `portal.data_export_zip_ttl_days` | `7` | integer | Days before a client data export ZIP expires |
| `portal.magic_link_ttl_hours` | `168` | integer | TTL for magic-link OTTs embedded in journey-beat emails + recovery-form sends; 7 days default, per F1.a (2026-04-13) |
| `portal.session_cookie_ttl_days` | `90` | integer | Rolling TTL for the portal-guard session cookie, per F1.a (2026-04-13) |

## Subscriber auth (owner: `docs/specs/saas-subscription-billing.md`)

| Key | Default | Type | Description |
|---|---|---|---|
| `subscriber.magic_link_ttl_hours` | `24` | integer | TTL for SaaS subscriber login magic-links issued by `invoice.payment_succeeded` + `/get-started/welcome` resend. Single-use. SB-6a (2026-04-15). |

## Intro Funnel (owner: `docs/specs/intro-funnel.md`)

| Key | Default | Type | Description |
|---|---|---|---|
| `intro_funnel.reflection_delay_hours_after_deliverables` | `24` | integer | Hours after the bundled `deliverables_ready` transition (§15.1) before the reflection CTA appears in the prospect portal |

> **Note.** Other Intro Funnel autonomy thresholds (abandon cadence: 15 min / 24 h / 3 d; advance notice: 5 business days; per-week cap: 3; reschedule limit: 2; refund window: 48 h; SMS quiet hours: 8 a.m.–9 p.m. local; email quiet hours: 7 a.m.–10 p.m. local; shoot duration: 60 min) are still expressed as literals in `intro_funnel_config` or in §11/§12/§14/§16 spec prose. **Phase 3.5 Batch C step 15 (literal grep) owes a sweep that registers the remaining Intro Funnel keys.** Tracked in `PATCHES_OWED.md`.

## Email adapter (owner: Phase 5 Wave 2 B3 — email adapter / drift grader; A5 seeded the keys)

| Key | Default | Type | Description |
|---|---|---|---|
| `email.quiet_window_start_hour` | `8` | integer | Outreach-only quiet-window start (local hour), per FOUNDATIONS §11.4 |
| `email.quiet_window_end_hour` | `18` | integer | Outreach-only quiet-window end (local hour), per FOUNDATIONS §11.4 |
| `email.drift_check_threshold` | `0.7` | decimal | `checkBrandVoiceDrift()` score threshold, per FOUNDATIONS §11.5 |
| `email.drift_retry_count` | `1` | integer | Drift-grader retry count before flagging for review |

## Alerts (owner: Phase 5 Wave 2 B1 — observability; A5 seeded the keys)

| Key | Default | Type | Description |
|---|---|---|---|
| `alerts.anthropic_daily_cap_aud` | `25.00` | decimal | Daily Anthropic spend cap before cost alert fires |
| `alerts.stripe_fee_anomaly_multiplier` | `2.0` | decimal | Multiplier on weekly-median Stripe fees that triggers anomaly alert |
| `alerts.resend_bounce_rate_threshold` | `0.05` | decimal | Resend bounce-rate threshold that triggers sender-reputation alert |

## Legal (owner: `docs/specs/legal-pages.md` §3; B3 seeds)

| Key | Default | Type | Description |
|---|---|---|---|
| `legal.dsr_email` | `"privacy@superbadmedia.com.au"` | string | Privacy Act DSR contact address — disclosed in Privacy Policy |
| `legal.dsr_response_days` | `30` | integer | Statutory DSR response commitment (days) — Privacy Act 1988 (Cth) |

## Hiring Pipeline (owner: `docs/specs/hiring-pipeline.md` §18)

| Key | Default | Type | Description |
|---|---|---|---|
| `hiring.discovery.llm_run_cadence` | `weekly` | enum | weekly / fortnightly / monthly / off (per Role Brief) |
| `hiring.discovery.llm_max_cost_aud_per_run` | `1.00` | decimal | Hard cap per Role per run |
| `hiring.discovery.llm_candidates_per_run` | `5` | integer | Top-N candidates surfaced |
| `hiring.discovery.weekly_cost_warn_threshold_aud` | `10.00` | decimal | Weekly spend warning |
| `hiring.discovery.vimeo_enabled` | `true` | boolean | Vimeo adapter kill switch |
| `hiring.discovery.behance_enabled` | `true` | boolean | Behance adapter kill switch |
| `hiring.discovery.ig_on_demand_enabled` | `true` | boolean | Apify IG adapter kill switch |
| `hiring.discovery.llm_agent_enabled` | `true` | boolean | Discovery agent master kill switch |
| `hiring.discovery.sourced_review_window_days` | `5` | integer | Sourced-column staleness nudge window |
| `hiring.discovery.auto_invite_score_threshold` | `0.90` | decimal | Auto-draft invites on discovery candidates scoring ≥ this |
| `hiring.invite.auto_send_enabled` | `true` | boolean | Invite send gate master kill switch |
| `hiring.invite.auto_send_confidence_threshold` | `0.85` | decimal | Confidence above which auto-send fires |
| `hiring.invite.ft_auto_send_confidence_threshold` | `0.95` | decimal | FT bar, higher |
| `hiring.invite.daily_send_cap_per_role` | `3` | integer | Per-Role daily ceiling |
| `hiring.invite.per_candidate_throttle_days` | `90` | integer | Same candidate + Role window |
| `hiring.invite.cross_role_max_per_candidate_per_year` | `3` | integer | Cross-Role anti-spam |
| `hiring.apply.followup_reply_wait_days` | `7` | integer | Wait before flagging no-reply |
| `hiring.apply.rate_bands` | `[bands array]` | json | Closed-list rate band options |
| `hiring.trial.delivery_deadline_days` | `7` | integer | Default due-date offset |
| `hiring.trial.delivery_grace_days` | `3` | integer | Grace before auto-archive |
| `hiring.trial.default_budget_cap_hours` | `4` | integer | Default budget = rate × hours |
| `hiring.brief.archive_retune_threshold` | `10` | integer | Cumulative archives before auto-retune |
| `hiring.brief.regen_on_bench_entry` | `true` | boolean | Re-run on new bench entry |
| `hiring.bench.pause_ending_warn_days` | `2` | integer | Warn ahead of resume |
| `hiring.staleness.sourced_days` | `14` | integer | Sourced staleness threshold |
| `hiring.staleness.invited_days` | `10` | integer | Invited staleness threshold |
| `hiring.staleness.applied_days` | `7` | integer | Applied staleness threshold |
| `hiring.staleness.screened_days` | `5` | integer | Screened staleness threshold |

## Sales Pipeline (owner: `docs/specs/sales-pipeline.md` §8)

| Key | Default | Type | Description |
|---|---|---|---|
| `pipeline.stale_thresholds.lead_days` | `14` | integer | Days in lead stage before stale halo fires |
| `pipeline.stale_thresholds.contacted_days` | `5` | integer | Days in contacted stage before stale halo fires |
| `pipeline.stale_thresholds.conversation_days` | `7` | integer | Days in conversation stage before stale halo fires |
| `pipeline.stale_thresholds.trial_shoot_days` | `14` | integer | Days in trial_shoot stage before stale halo fires |
| `pipeline.stale_thresholds.quoted_days` | `5` | integer | Days in quoted stage before stale halo fires |
| `pipeline.stale_thresholds.negotiating_days` | `3` | integer | Days in negotiating stage before stale halo fires |
| `pipeline.snooze_default_days` | `3` | integer | Default snooze duration when Andy snoozes a stale deal |
| `pipeline.stripe_webhook_dispatch_enabled` | `true` | boolean | Master kill switch for Stripe webhook business dispatch (signature verification + idempotency still run when `false`, only deal/company mutations are skipped) |
| `pipeline.resend_webhook_dispatch_enabled` | `true` | boolean | Master kill switch for Resend webhook business dispatch (signature verification + idempotency still run when `false`, only contact/deal/company mutations are skipped) |
| `pipeline.sd_three_wons_last_fired_ms` | `0` | integer | Unix-ms timestamp of the last "three Wons in a session" S&D egg fire (sales-pipeline §11A.4 + surprise-and-delight admin egg #3). Enforces the ≤ once/30-day cap server-side. `0` = never fired. |

## Quote Builder (owner: `docs/specs/quote-builder.md` §8 + Q8; consumers: QB-2..QB-8 + SaaS Subscription Billing)

| Key | Default | Type | Description |
|---|---|---|---|
| `quote.default_expiry_days` | `14` | integer | Default expiry window (days) for newly-drafted quotes; per-quote picker in the QB-2 editor overrides. Source: spec Q8 / §4.1. |
| `quote.setup_fee_monthly_saas` | `0` | integer | One-off setup fee in cents applied to SaaS subscription signups; `0` = no fee. Consumed by QB-5 + SaaS Subscription Billing. |
| `quote.reminder_days` | `3` | integer | Days after quote-send before the `quote_reminder_3d` task fires if the client has not viewed. Source: spec §3.1.5 + §8. |
| `quote.intro_paragraph_redraft_hourly_cap` | `5` | integer | Soft cap on Opus redraft calls for the "What you told us" paragraph, per quote per rolling hour. Source: spec §6.2. |

---

## SaaS Subscription Billing (owner: `docs/specs/saas-subscription-billing.md` §4.5; consumers: SB-2b product publish wizard, SB-6 subscription creation)

| Key | Default | Type | Description |
|---|---|---|---|
| `billing.saas.monthly_setup_fee_cents` | `0` | integer | Default one-off setup fee (cents, inc-GST) pre-populated per tier in the SaaS product publish wizard. Per-tier override allowed. Source: spec §4.5. |
| `saas.headline_window_days` | `30` | integer | Rolling window (days) used by the SaaS admin headlines strip for new signups / churn / MRR-delta. Source: spec §8.1 + §8.3. Consumed by `lib/saas-products/headline-signals.ts`. |
| `saas.near_cap_threshold` | `0.8` | decimal | Fractional threshold (0–1) at which a subscriber dimension is counted as near-cap on the admin headlines strip. Source: spec §8.1. Consumed by `lib/saas-products/headline-signals.ts`. |

---

## Unified Inbox — Graph API sync (owner: `docs/specs/unified-inbox.md` §6; consumer: UI-1 lib/graph/)

| Key | Default | Type | Description |
|---|---|---|---|
| `inbox.graph_sync_interval_seconds` | `300` | integer | Polling interval (seconds) for delta sync fallback when webhook misses. Source: BUILD_PLAN cron table `inbox_graph_sync` every 5 min. |
| `inbox.graph_subscription_ttl_hours` | `48` | integer | Requested TTL (hours) for Graph webhook subscriptions. Graph max is ~70.5h (4230 min). Source: spec §16 discipline 51. |
| `inbox.graph_subscription_renew_buffer_hours` | `6` | integer | Renew subscriptions this many hours before expiry. Source: spec §16 discipline 51. |

---

## Content Engine (owner: `docs/specs/content-engine.md` §3; consumers: CE-2..CE-13)

| Key | Default | Type | Description |
|---|---|---|---|
| `content.tier` | `small` | string | Default Content Engine SaaS tier for new subscribers. Governs posts/month + subscriber cap. Source: spec §3.1. |
| `content.send_window_day` | `tuesday` | string | Default newsletter send day of week. Per-owner override in `content_engine_config`. Source: spec §3.3. |
| `content.send_window_hour` | `10` | integer | Default newsletter send hour (24h, local tz). Source: spec §3.3. |
| `content.max_posts_per_month` | `4` | integer | Default max posts per billing cycle (small tier). Source: spec §3.1. |
| `content.max_subscribers_per_tier` | `{"small":500,"medium":2500,"large":10000}` | string (JSON) | Newsletter subscriber cap per tier. Source: spec §3.1. |

---

### Task Manager (TM-6, TM-7)

| Key | Default | Type | Description |
|---|---|---|---|
| `tasks.deliverable_approval_token_ttl_days` | `14` | integer | How long an approval magic-link token is valid before expiry. Source: spec §Approval workflow. |
| `tasks.morning_digest_enabled` | `true` | boolean | Whether the 08:00 morning task digest email fires. Source: spec §Notifications. |
| `tasks.morning_digest_time` | `08:00` | string | Local time (Melbourne) for morning digest. Source: spec §Notifications. |

---

### Daily Cockpit (DC-2)

| Key | Default | Type | Description |
|---|---|---|---|
| `cockpit.quiet_slot_cost_threshold` | `0.50` | decimal | Max estimated Opus cost (AUD) per brief before quiet-slot skip rule considers cost. Source: spec §Quiet-slot skip rule. |
| `cockpit.material_event_debounce_minutes` | `10` | integer | Debounce window (minutes) for material-event brief regeneration per slot. Source: spec §Material-event regen. |
| `cockpit.waiting_items_rail_cap` | `6` | integer | Max chips shown on the attention rail before overflow. Source: spec §Attention rail. |

---

## Branded Invoicing (owner: `docs/specs/branded-invoicing.md`; consumer: BI-1..BI-4)

| Key | Default | Type | Description |
|---|---|---|---|
| `invoice.review_window_days` | `3` | integer | Days before an auto-generated invoice auto-sends without manual review |
| `invoice.overdue_reminder_days` | `14` | integer | Days past due before overdue reminder email fires |

---

## SaaS Subscription Billing — additional keys (SB-7, SB-9)

| Key | Default | Type | Description |
|---|---|---|---|
| `saas.usage_warn_threshold_percent` | `80` | integer | Percentage of tier limit at which a usage warning fires |
| `saas.data_loss_warning_days` | `30` | integer | Days before data deletion after subscription cancellation |

---

## Unified Inbox — additional keys (UI-10, UI-12, UI-13)

| Key | Default | Type | Description |
|---|---|---|---|
| `inbox.ticket_auto_resolve_idle_days` | `7` | integer | Days of inactivity before a support ticket auto-resolves |
| `inbox.history_import_months` | `6` | integer | Months of email history to import on initial Graph API sync |
| `inbox.digest_hour` | `8` | integer | Local hour (Melbourne) for morning inbox digest email |
| `inbox.digest_silent_window_hours` | `4` | integer | Hours after digest send during which no incremental notifications fire |
| `inbox.digest_no_send_on_zero` | `false` | boolean | Skip digest email when there are zero actionable items |

---

## Onboarding & Segmentation (owner: `docs/specs/onboarding-segmentation.md`; consumer: OS-2)

| Key | Default | Type | Description |
|---|---|---|---|
| `onboarding.retainer_non_start_nudge_hours` | `48` | integer | Hours before nudging a new retainer client who hasn't started onboarding |
| `onboarding.saas_nudge_first_hours` | `24` | integer | First SaaS nudge after signup |
| `onboarding.saas_nudge_second_hours` | `72` | integer | Second SaaS nudge |
| `onboarding.saas_nudge_weekly_hours` | `168` | integer | Recurring weekly SaaS nudge cadence |
| `onboarding.practical_nudge_first_hours` | `24` | integer | First practical-step nudge |
| `onboarding.practical_nudge_second_hours` | `72` | integer | Second practical-step nudge |
| `onboarding.practical_nudge_weekly_hours` | `168` | integer | Recurring weekly practical-step nudge |
| `onboarding.upsell_revenue_floor` | `"50000"` | string | Minimum annual revenue (AUD) to qualify for upsell targeting |
| `onboarding.upsell_engagement_login_days` | `5` | integer | Minimum login days in window to qualify for upsell |
| `onboarding.upsell_engagement_login_window_days` | `14` | integer | Rolling window for login-day counting |
| `onboarding.upsell_engagement_feature_count` | `3` | integer | Minimum distinct features used to qualify for upsell |
| `onboarding.upsell_engagement_feature_window_days` | `14` | integer | Rolling window for feature-count measurement |
| `onboarding.upsell_location_gate` | `"AU"` | string | ISO country code gate for upsell targeting |
| `onboarding.brand_dna_retake_nudge_months` | `6` | integer | Months since last Brand DNA before nudging a retake |

---

## Lead Generation (owner: `docs/specs/lead-generation.md`; consumer: LG-1..LG-11)

| Key | Default | Type | Description |
|---|---|---|---|
| `lead_generation.daily_search_enabled` | `true` | boolean | Master kill switch for daily lead search |
| `lead_generation.daily_max_per_day` | `10` | integer | Max new leads surfaced per daily run |
| `lead_generation.dedup_window_days` | `90` | integer | Window for deduplicating previously-surfaced leads |
| `lead_generation.location_radius_km` | `50` | integer | Search radius from location centre |
| `lead_generation.location_centre` | `"Melbourne, AU"` | string | Default search centre |
| `lead_generation.category` | `"restaurant"` | string | Default business category for search |
| `lead_generation.standing_brief` | `""` | string | Standing brief for LLM-augmented search |
| `lead_generation.run_time` | `"06:00"` | string | Daily search cron time (Melbourne local) |
| `lead_generation.auto_send_delay_minutes` | `15` | integer | Delay in minutes before auto-send fires on approved drafts |

---

## Warmup Ramp (owner: LG-6; consumer: LG-8, LG-9)

| Key | Default | Type | Description |
|---|---|---|---|
| `warmup.week_one_cap` | `5` | integer | Daily send cap, week 1 |
| `warmup.week_two_cap` | `10` | integer | Daily send cap, week 2 |
| `warmup.week_three_cap` | `15` | integer | Daily send cap, week 3 |
| `warmup.week_four_cap` | `20` | integer | Daily send cap, week 4 |
| `warmup.graduated_cap` | `30` | integer | Daily send cap, graduated (week 5+) |

---

## Free Audit Tool (owner: `docs/specs/free-audit-tool.md`; consumer: AT-1)

| Key | Default | Type | Description |
|---|---|---|---|
| `audit.daily_cap` | `50` | integer | Max audits per day across all IPs |
| `audit.rate_limit_per_ip` | `3` | integer | Max audits per IP per day |
| `audit.scoring_boost` | `10` | integer | Score boost for audit leads entering pipeline |
| `audit.profile_reuse_days` | `7` | integer | Days to cache a business profile before re-fetching |

---

## Surprise & Delight (owner: `docs/specs/surprise-and-delight.md`; consumer: SD-1..SD-14)

| Key | Default | Type | Description |
|---|---|---|---|
| `surprise.hidden_eggs_enabled` | `true` | boolean | Master kill switch for hidden eggs |
| `surprise.public_egg_cadence_per_days` | `30` | integer | Minimum days between public egg fires per user |
| `surprise.admin_egg_cadence_per_days` | `30` | integer | Minimum days between admin egg fires per user |
| `surprise.ambient_copy_refresh_interval_days` | `7` | integer | Days between ambient copy rotation |
| `surprise.riddle_wrong_answer_fallback_budget_per_riddle` | `3` | integer | Max wrong-answer fallback attempts per riddle |
| `surprise.per_egg_cooldown_days` | `30` | integer | Per-trigger cooldown (days) for individual admin eggs (SAP) |
| `surprise.milestone_cooldown_days` | `60` | integer | Per-contact cooldown (days) for milestone-spotter egg (SAP) |
| `surprise.fire_retention_days` | `30` | integer | Days to retain hidden_egg_fires rows before cleanup (SAP) |

---

## Cost & Usage Observatory (owner: `docs/specs/cost-observatory.md`; consumer: COB-1..COB-11)

| Key | Default | Type | Description |
|---|---|---|---|
| `observatory.monthly_threshold_1_aud` | `50.00` | decimal | First monthly spend threshold (amber) |
| `observatory.monthly_threshold_2_aud` | `100.00` | decimal | Second monthly spend threshold (red) |
| `observatory.monthly_threshold_3_aud` | `200.00` | decimal | Third monthly spend threshold (critical) |
| `observatory.projection_alert_enabled` | `true` | boolean | Whether projection-based alerts fire |
| `observatory.weekly_digest_enabled` | `true` | boolean | Whether weekly cost digest email fires |
| `observatory.anomaly_suppress_hours` | `24` | integer | Hours an acknowledged anomaly stays suppressed (SAP) |

---

## Referral (owner: `docs/specs/client-management.md` CM-E)

| Key | Default | Type | Description |
|---|---|---|---|
| `referral.milestone_prompt_cooldown_days` | `90` | integer | Days between referral milestone prompt nudges per client |

---

## Case Snippets (owner: LG-11)

| Key | Default | Type | Description |
|---|---|---|---|
| `snippet.auto_approve_hours` | `48` | integer | Hours before an auto-generated case snippet auto-approves |

---

## Retargeting (owner: LG-11)

| Key | Default | Type | Description |
|---|---|---|---|
| `retargeting.meta_pixel_id` | `null` | string (nullable) | Meta pixel ID for retargeting clicks |
| `retargeting.google_conversion_id` | `null` | string (nullable) | Google conversion ID for retargeting clicks |

---

## Autonomy Adjustment (owner: LG-11)

| Key | Default | Type | Description |
|---|---|---|---|
| `autonomy.graduation_threshold` | `10` | integer | Clean approvals needed to graduate from manual to probation |
| `autonomy.minor_edit_char_threshold` | `50` | integer | Max character diff for an edit to count as "minor" |
| `autonomy.material_edit_ratio_threshold` | `0.3` | decimal | Levenshtein ratio above which an edit counts as "material" |

---

## SMS Transport (owner: SAP; consumer: IF-2)

| Key | Default | Type | Description |
|---|---|---|---|
| `sms.quiet_window_start_hour` | `8` | integer | SMS quiet window start (local hour, inclusive) |
| `sms.quiet_window_end_hour` | `21` | integer | SMS quiet window end (local hour, exclusive) |

---

## Inbox Retention (owner: SAP; consumer: UI-4, UI-7)

| Key | Default | Type | Description |
|---|---|---|---|
| `inbox.noise_retention_days_transactional` | `180` | integer | Days to keep noise/transactional messages before soft-delete |
| `inbox.noise_retention_days_default` | `30` | integer | Days to keep noise (non-transactional) messages before soft-delete |
| `inbox.spam_retention_days` | `7` | integer | Days to keep spam messages before soft-delete |
| `inbox.trash_retention_days` | `14` | integer | Days soft-deleted messages survive before hard-delete |

---

## Task Approval (owner: SAP; consumer: TM-6)

| Key | Default | Type | Description |
|---|---|---|---|
| `tasks.approval_reminder_hours` | `48` | integer | Hours before a reminder fires for unanswered approval requests |

---

## Wizard Expiry Warning (owner: SAP; consumer: SW-8)

| Key | Default | Type | Description |
|---|---|---|---|
| `wizards.expiry_warn_hours_before` | `24` | integer | Hours before wizard expiry to fire the warning notification |

---

## Hiring Trial Archive (owner: SAP; consumer: HP-14)

| Key | Default | Type | Description |
|---|---|---|---|
| `hiring.trial.auto_archive_delay_days` | `2` | integer | Days after trial overdue notification before auto-archive |

---

## Business Profile (owner: `docs/specs/superbad-profile.md` §15)

| Key | Default | Type | Description |
|---|---|---|---|
| `profile.stale_threshold_days` | `90` | integer | Days before a profile section is flagged as stale |
| `profile.suggestion_expiry_days` | `30` | integer | Days before an unresolved profile suggestion auto-expires |
| `profile.cache_ttl_minutes` | `10` | integer | In-memory cache TTL for assembled profile context |
| `profile.health_check_hour` | `4` | integer | Melbourne hour (0–23) when the daily profile health check runs |
| `profile.enforcement_enabled` | `true` | boolean | Kill switch — disabling reverts all LLM calls to pre-profile behaviour |

---

## Totals

- Finance: 11
- Wizards: 10 (was 9; +1 SAP `wizards.expiry_warn_hours_before`)
- Plan: 10
- Portal: 5 (+1 `subscriber.magic_link_ttl_hours` listed under Subscriber auth)
- Subscriber auth: 1
- Intro Funnel: 1
- Email adapter: 4
- Alerts: 3
- Legal: 2
- Hiring: 29 (was 28; +1 SAP `hiring.trial.auto_archive_delay_days`)
- Sales Pipeline: 10
- Quote Builder: 4
- Branded Invoicing: 2 (BI-1)
- SaaS Subscription Billing: 5 (was 1; +2 SB-7/SB-9, +2 `saas.headline_window_days` + `saas.near_cap_threshold`)
- Unified Inbox: 8 (was 3; +5 UI-10/UI-12/UI-13)
- Content Engine: 5
- Task Manager: 4 (was 3; +1 SAP `tasks.approval_reminder_hours`)
- Daily Cockpit: 3
- Onboarding & Segmentation: 14 (OS-2)
- Lead Generation: 9 (LG-1)
- Warmup Ramp: 5 (LG-6)
- Free Audit Tool: 4 (AT-1)
- Surprise & Delight: 8 (was 5; +3 SAP per-egg/milestone/retention)
- Cost & Usage Observatory: 6 (was 5; +1 SAP `observatory.anomaly_suppress_hours`)
- Referral: 1 (CM-E)
- Case Snippets: 1 (LG-11)
- Retargeting: 2 (LG-11)
- Autonomy Adjustment: 3 (LG-11)
- SMS Transport: 2 (SAP)
- Inbox Retention: 4 (SAP)
- Business Profile: 5 (BP-1)
- **Total: 183 keys at v1.0 seed** (was 178 pre-BP; +5 Business Profile keys)

Phase 5 Session A5 (Foundations seed migration) reads this file and emits the corresponding `INSERT INTO settings` rows. Any key consumed by feature code without a row here is a bug — Phase 4 AUTONOMY_PROTOCOL lint catches it.
