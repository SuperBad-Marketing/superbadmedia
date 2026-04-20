# HP-18 Handoff — Hiring Pipeline: Cockpit Waiting-Items + Health-Banners Contracts

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### `lib/hiring/cockpit.ts` — Daily Cockpit integration contracts per spec §14

Two exported functions implementing the `WaitingItem[]` and `HealthBanner[]` contracts consumed by Wave 22 (Daily Cockpit).

**`getHiringWaitingItems(nowMs?)`** — 7 waiting-item source kinds:

1. `candidate_application_unreviewed` — Applied candidates waiting > 24h
2. `candidate_followup_reply_received` — Applied + replied to followup, awaiting screen
3. `trial_task_delivered_unreviewed` — Delivered trial with no `andy_review_notes`
4. `trial_task_overdue` — Pending trial past `due_at_ms`
5. `draft_invites_awaiting` — Count of `pending_review` invite drafts
6. `bench_pause_ending_soon` — Bench members with `paused_until` within warn-days threshold
7. `role_brief_discovery_stale` — Open roles with `last_discovery_run_at_ms` > 10 days ago

**`getHiringHealthBanners(nowMs?)`** — 3 health banner kinds:

1. `hiring_trial_task_overdue` — Any trial past `due_at + grace_days` (warning < 3, critical >= 3)
2. `hiring_bench_empty_for_open_role` — Open Role Brief with 0 active bench for > 21 days
3. `hiring_discovery_cost_anomaly` — Weekly discovery spend exceeds `hiring.discovery.weekly_cost_warn_threshold_aud`

## New files

- `lib/hiring/cockpit.ts`
- `tests/hp18-hiring-cockpit-contracts.test.ts` (10 tests)

## Edited files

- `lib/hiring/index.ts` — added `export * from "./cockpit"`

## Verification

- `npx tsc --noEmit` — zero new errors (5 pre-existing in HP-17 test file)
- `npx vitest run` — 253 files, 2404 passed, 1 skipped (pre-existing)
- Browser check: not applicable (pure data contracts with no UI surface)

## Key decisions

- **Reused `WaitingItem` and `HealthBanner` interfaces from `lib/tasks/cockpit.ts`** — spec says Daily Cockpit owns these types; all specs contribute via the same interface.
- **Dynamic import for `external_call_log`** in the cost anomaly check — keeps the import lazy since it's only needed when the threshold setting exists. Avoids a circular dependency risk.
- **Grace period applied to health banner but not waiting item** — waiting items show any overdue trial (attention), health banner only fires after grace days (alarm). Matches spec §14.1 vs §14.2 distinction.
- **Severity thresholds** — trial overdue: critical at >= 3; bench empty: always warning (single-role concern). Cost anomaly: always critical (money).

## Settings keys consumed

- `hiring.bench.pause_ending_warn_days` (default 2) — reused from HP-17
- `hiring.trial.delivery_grace_days` — grace period before health banner fires
- `hiring.discovery.weekly_cost_warn_threshold_aud` — cost anomaly threshold

## Rollback

- Git-revertable: one new file + one new export line. No existing signatures changed.

## Next session should know

- **HP-19** — final Hiring Pipeline session. Check BUILD_PLAN.md for scope (likely the §14.3 morning brief narrative contract, or remaining cleanup).
- **Wave 22 (Daily Cockpit)** is the consumer — it will aggregate `getHiringWaitingItems()` + `getHiringHealthBanners()` alongside equivalent contracts from other specs.
- **Pre-existing HP-17 test TS errors** — 5 `TS2722` errors in `tests/hp17-bench-pause-availability.test.ts` (possibly undefined mock invocations). Not blocking; tests still pass at runtime. Next session can fix or the HP-19 session can clean up.
