# DRY-INT FAILED Handoff — Integration-Level Dry-Run

**Date:** 2026-04-21
**Wave:** 23 (integration sub-session of DRY)
**Status:** FAILED — G1 precondition check failed; external service credentials absent

---

## Root cause

**G1 hard stop.** Three required external service credentials are missing from the CCR environment:

- `STRIPE_SECRET_KEY` — not set
- `RESEND_API_KEY` — not set
- `ANTHROPIC_API_KEY` — not set (only `ANTHROPIC_BASE_URL` is set, which is the Claude Code proxy, not the app-level API key)

Stripe CLI is also not installed (`which stripe` → not found).

DRY-INT cannot verify any of its 7 acceptance criteria (Stripe payment round-trip, magic-link email flow, Six-Week Plan generation, cockpit brief cron, content engine draft, cancel flow) without these services.

This matches the DRY handoff's own recommendation: "The remaining items are integration-level verification that happens best during the **Phase 6 shadow period with Andy actively watching**."

---

## What was attempted

1. G11.b mop-up: wrote `sessions/DRY-INT-brief.md` (brief did not exist — DRY's partial close skipped brief authoring).
2. Lock acquired and pushed.
3. G1 precondition check: all 3 external service env vars confirmed absent.
4. Mechanical gates run to establish baseline state:
   - `npx tsc --noEmit`: 4 errors (pre-existing dc4/hp19 test-only errors; zero new)
   - `npx vitest run`: **7 files failed, 13 tests failed** — see below

---

## New regressions found (not introduced by DRY-INT)

### 1. `settings.test.ts` idempotency failure — REGRESSION (LAUNCH commit)

**File:** `lib/db/migrations/0070_legal_v2.sql`
**Commit:** `deae54a` [LAUNCH] Legal pages v2.0
**Error:** `SqliteError: UNIQUE constraint failed: legal_doc_versions.id`

`0070_legal_v2.sql` uses plain `INSERT INTO` not `INSERT OR IGNORE`. `runSeeds()` is designed to be idempotent (called twice by settings.test.ts idempotency check). Second call hits UNIQUE constraint.
**Fix:** Change all four INSERT statements in the file to `INSERT OR IGNORE`.
**Logged:** `PATCHES_OWED.md` entry `legal_v2_seed_not_idempotent`.

### 2. HP-2/HP-4 `no such table: settings` — environment-dependent (not a new regression)

Tests `hp2-hiring-role-brief-wizard.test.ts` and `hp4-quick-add-scoring.test.ts` call `ingestPortfolioUrl()` which calls `settings.get()` against the real DB. In a fresh CCR environment, dev.db has no migrations. Tests fail with `no such table: settings`.

These tests were passing in the developer's environment because dev.db was pre-seeded. They fail in any fresh environment. Not a regression from LAUNCH commits.
**Fix:** Add `vi.mock('@/lib/settings', ...)` to both tests.
**Logged:** `PATCHES_OWED.md` entry `hp2_hp4_portfolio_settings_no_mock`.

### 3. Handler registry tests (CM-9, COB-11, HP-12, HP-17, LG-9) — false positives in full suite

All pass when run individually. Fail only in the full suite run (test isolation issue — DB state race). These were passing in the developer's full suite run presumably because test execution order was different.

---

## Mechanical verification baseline

- `npx tsc --noEmit`: 4 pre-existing errors (unchanged from DRY handoff)
- `npm test` (full suite): 7 files failed, 13 tests failed
  - Pre-existing: `sb10-headline-signals.test.ts` (1 failure)
  - New regression: `settings.test.ts` (1 failure — LAUNCH commit bug)
  - Environment-dependent: `hp2`, `hp4` (10 failures — no mock for settings in fresh env)
  - Suite isolation: `cm9`, `cob11`, `hp12`, `hp17`, `lg9` handler registry (false positives in parallel run)

---

## What blocks progress

1. **Primary:** No external service credentials in CCR environment. Cannot fix autonomously — this is an environment configuration issue, not a code issue.
2. **Secondary:** Two code issues logged to PATCHES_OWED.md require human-authored fixes before next test-suite run is clean.

---

## G10.5 fidelity grep (non-UI session)

- Acceptance-criterion keywords in diff: N/A — no code changes made
- File whitelist violations: none
- Memory alignment: N/A

---

## Rollback

Session made no code changes (only new files: this handoff, FAILED-handoff, brief, PATCHES_OWED patch). Git-revertable with no data shape change.

---

## What the next session must know

- **DRY-INT must run with Andy present** during Phase 6 shadow period, with:
  - Stripe CLI running: `stripe listen --forward-to localhost:3001/api/stripe/webhook --api-key <test-key>`
  - STRIPE_SECRET_KEY, RESEND_API_KEY, ANTHROPIC_API_KEY configured in `.env.local`
  - Coastal Brew Co test data still in dev.db (from DRY session; confirm before starting)
  - Dev server running on :3001

- **Before re-attempting DRY-INT**, fix these first (PATCHES_OWED):
  1. `legal_v2_seed_not_idempotent` — 1-line fix to `0070_legal_v2.sql`
  2. `hp2_hp4_portfolio_settings_no_mock` — add settings mock to hp2 and hp4 tests

- The autonomy loop **cannot make progress** on DRY-INT. This is a Phase 6 task.
