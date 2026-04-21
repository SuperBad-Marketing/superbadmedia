# SAP Handoff — Settings Audit Pass

**Date:** 2026-04-21
**Wave:** 23 (first session)
**Status:** COMPLETE

## What was done

Full-codebase audit of hardcoded numeric/string literals in autonomy-sensitive paths, with three deliverables:

### 1. Literal-to-settings.get() conversions (12 files patched)

**P0 — keys existed but weren't wired:**
- `lib/lead-gen/warmup.ts` — warmup ramp caps (5/10/15/20/30) now read from `warmup.week_one_cap` through `warmup.graduated_cap`
- `lib/lead-gen/autonomy.ts` — `AUTO_SEND_DELAY_MS` constant replaced with `getAutoSendDelayMs()` async function reading `lead_generation.auto_send_delay_minutes`
- `lib/lead-gen/sequence-engine.ts` — updated to call `getAutoSendDelayMs()`
- `lib/lead-gen/index.ts` — barrel export updated

**P1 — new keys added:**
- `lib/channels/sms/send.ts` — SMS quiet hours (8am/9pm) now from `sms.quiet_window_start_hour` / `sms.quiet_window_end_hour`
- `lib/graph/signal-noise.ts` — noise/spam retention now from `inbox.noise_retention_days_transactional` / `inbox.noise_retention_days_default` / `inbox.spam_retention_days`; `computeMessageKeepUntilMs` changed sync → async
- `lib/graph/router.ts` — spam keep days now from `inbox.spam_retention_days`
- `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts` — trash retention from `inbox.trash_retention_days`
- `lib/tasks/approve.ts` — approval reminder delay from `tasks.approval_reminder_hours`
- `lib/wizards/nudge/enqueue.ts` — expiry warning lead time from `wizards.expiry_warn_hours_before`

**P2 — new keys added:**
- `lib/eggs/admin-triggers/weekend-warrior.ts`, `three-wons.ts`, `inbox-zero.ts`, `crt-turn-off.ts` — per-egg cooldown from `surprise.per_egg_cooldown_days`
- `lib/eggs/admin-triggers/milestone-spotter.ts` — per-contact cooldown from `surprise.milestone_cooldown_days`
- `lib/scheduled-tasks/handlers/hidden-egg-fire-cleanup.ts` — fire retention from `surprise.fire_retention_days`
- `lib/scheduled-tasks/handlers/hiring-trial.ts` — auto-archive delay from `hiring.trial.auto_archive_delay_days`
- `app/api/admin/observatory/anomaly/route.ts` — acknowledge suppression from `observatory.anomaly_suppress_hours`

### 2. Registry reconciliation

- `lib/settings.ts` — 13 new keys added (165 → 178)
- `lib/db/migrations/0069_sap_settings_audit_keys.sql` — seed migration for all 13 new keys
- `docs/settings-registry.md` — updated from 107 documented keys to full 178. Added sections for: Branded Invoicing, SaaS Billing (additional), Unified Inbox (additional), Onboarding & Segmentation, Lead Generation, Warmup Ramp, Free Audit Tool, Surprise & Delight (expanded), Cost & Usage Observatory (expanded), Referral, Case Snippets, Retargeting, Autonomy Adjustment, SMS Transport, Inbox Retention, Task Approval, Wizard Expiry Warning, Hiring Trial Archive. Totals footer updated.

### 3. Borderline findings NOT converted (deliberate)

These were reviewed and judged as infrastructure/algorithm constants rather than autonomy-sensitive thresholds:
- Scoring engine weights/floors (`lib/lead-gen/scoring.ts` — comment says "changes are deploys, not config")
- Scheduled-task worker internals (stale timeout, max attempts, backoff)
- Calendar slot duration (`lib/intro-funnel/calendar.ts` — "v1 hardcoded per spec")
- Observatory kill-switch 365-day sentinel, learned-band warmup minimum
- Intro funnel abandon cadence timing (15m/1h/24h/3d — very spec-specific)
- Melbourne weather cache TTL, brief regen debounce, Graph token refresh buffer

## New files

- `lib/db/migrations/0069_sap_settings_audit_keys.sql`
- `tests/sap-settings-audit.test.ts`

## Edited files

- `lib/settings.ts` — 13 new registry entries
- `lib/lead-gen/warmup.ts` — settings.get() for all ramp caps
- `lib/lead-gen/autonomy.ts` — `getAutoSendDelayMs()` replaces `AUTO_SEND_DELAY_MS`
- `lib/lead-gen/sequence-engine.ts` — consumes new async function
- `lib/lead-gen/index.ts` — barrel export updated
- `lib/channels/sms/send.ts` — SMS quiet hours from settings
- `lib/graph/signal-noise.ts` — retention from settings, function now async
- `lib/graph/router.ts` — spam retention from settings
- `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts` — trash retention from settings
- `lib/tasks/approve.ts` — approval reminder from settings
- `lib/wizards/nudge/enqueue.ts` — expiry warning from settings
- `lib/eggs/admin-triggers/weekend-warrior.ts` — cooldown from settings
- `lib/eggs/admin-triggers/three-wons.ts` — cooldown from settings
- `lib/eggs/admin-triggers/inbox-zero.ts` — cooldown from settings
- `lib/eggs/admin-triggers/crt-turn-off.ts` — cooldown from settings
- `lib/eggs/admin-triggers/milestone-spotter.ts` — cooldown from settings
- `lib/scheduled-tasks/handlers/hidden-egg-fire-cleanup.ts` — retention from settings
- `lib/scheduled-tasks/handlers/hiring-trial.ts` — archive delay from settings
- `app/api/admin/observatory/anomaly/route.ts` — suppress duration from settings
- `lib/db/migrations/meta/_journal.json` — migration 0069 entry
- `docs/settings-registry.md` — full reconciliation (107 → 178 documented keys)
- `tests/lead-gen/lg8-autonomy.test.ts` — updated for async + settings mock
- `tests/lead-gen/lg9-sequence-engine.test.ts` — updated for async mock
- `tests/graph-signal-noise.test.ts` — async tests + settings mock
- `tests/settings.test.ts` — count updated 165 → 178

## Verification

- `npx tsc --noEmit` — 4 pre-existing errors (dc4 test + hp19 test), zero new
- `npx vitest run` — 287 files passed, 1 pre-existing failure (`sb10-headline-signals.test.ts`), zero new regressions
- Full suite: 2926 passed, 1 failed (pre-existing), 1 skipped
- SAP-specific tests: 4 passed (key presence, count, export shape)

## Rollback

- All changes are additive — git-revertable
- Migration uses INSERT OR IGNORE — safe to re-run, no data shape change
- Feature-flag-gated: individual feature kill switches already exist for all affected subsystems

## Pre-existing issues (unchanged)

- `sb10-headline-signals.test.ts` failure — confirmed pre-existing
- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)
- Egg build error (`lib/eggs/admin-triggers/three-wons.ts` → `pipeline-board.tsx` client component chain)

## Next session should know

- **SAP is complete.** All autonomy-sensitive literals converted. Registry, code, and migrations are in sync at 178 keys.
- **Wave 23 next: DRY** — synthetic-client dry-run. Full arc on staging: fake prospect → outreach touch → simulated reply → trial shoot booking → Brand DNA → retainer quote → invoice → portal.
- The `computeMessageKeepUntilMs` function in `lib/graph/signal-noise.ts` is now **async** — any future consumer must `await` it.
- The `AUTO_SEND_DELAY_MS` constant no longer exists. Use `getAutoSendDelayMs()` (async) from `lib/lead-gen/autonomy`.
