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

## Portal (owner: `docs/specs/client-management.md` §10; Intro Funnel consumes)

| Key | Default | Type | Description |
|---|---|---|---|
| `portal.non_converter_archive_days` | `60` | integer | Days post-shoot-completion before non-converter portal archives |
| `portal.chat_calls_per_day_pre_retainer` | `5` | integer | Daily Opus chat call cap in pre-retainer rendering mode |
| `portal.chat_calls_per_day_retainer` | `25` | integer | Daily Opus chat call cap for retainer clients |

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

---

## Totals

- Finance: 11
- Wizards: 6
- Plan: 8
- Portal: 3
- Hiring: 28
- **Total: 56 keys at v1.0 seed**

Phase 5 Session A (Foundations seed migration) reads this file and emits the corresponding `INSERT INTO settings` rows. Any key consumed by feature code without a row here is a bug — Phase 4 AUTONOMY_PROTOCOL lint catches it.
