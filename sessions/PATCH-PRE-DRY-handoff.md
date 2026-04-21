# PATCH-PRE-DRY Handoff — Pre-DRY-INT Code Patches

**Date:** 2026-04-21
**Wave:** 23 (pre-requisite patch micro-session)
**Status:** COMPLETE — two PATCHES_OWED items applied

---

## What was done

DRY-INT remains blocked on missing external credentials (STRIPE_SECRET_KEY, RESEND_API_KEY, ANTHROPIC_API_KEY — same G1 block as previous attempt). Rather than re-fail identically, this session applied the two code patches that the DRY-INT FAILED handoff identified as required before DRY-INT could succeed even with credentials.

### Patch 1: `legal_v2_seed_not_idempotent`

- **File:** `lib/db/migrations/0070_legal_v2.sql`
- **Change:** `INSERT INTO` → `INSERT OR IGNORE` on the single INSERT statement
- **Effect:** `settings.test.ts` (7 tests, previously 1 failure) now passes: `runSeeds()` is idempotent and the second call no longer hits UNIQUE constraint on `legal_doc_versions.id`
- **PATCHES_OWED:** marked applied

### Patch 2: `hp2_hp4_portfolio_settings_no_mock`

- **Files:** `tests/hp2-hiring-role-brief-wizard.test.ts`, `tests/hp4-quick-add-scoring.test.ts`
- **Change:** Added `vi.mock("@/lib/settings", ...)` at the top of each file, returning `false` for the three settings keys used by `ingestPortfolioUrl`: `hiring.discovery.ig_on_demand_enabled`, `hiring.discovery.vimeo_enabled`, `hiring.discovery.behance_enabled`
- **Effect:** With `enabled = false`, all three platform handlers return `{ confidence: 0.2 }` early without making any network calls. The `platform` field is set before the handler call (from `detectPlatform(url)`) so it is unaffected. hp2: 32/32 pass. hp4: 27/27 pass.
- **Mock returns `false` not `true`:** returning `false` is cleaner for test isolation — it prevents any external calls from escaping into test runs, regardless of the test environment. The tests are verifying URL-to-platform detection logic, not the enabled-flag gating.
- **PATCHES_OWED:** marked applied

---

## Test suite state after patches

- `npx tsc --noEmit`: 4 pre-existing test-only errors (dc4, hp19) — unchanged, zero new
- `npx vitest run`: 6 files failed, 6 tests failed (was 7+ files, 13+ tests before patches)
  - Fixed: settings.test.ts, hp2, hp4 (10 failures removed)
  - Remaining: sb10 (1 pre-existing failure), cm9/cob11/hp12/hp17/lg9 (5 handler-registry suite-isolation false positives — pre-existing, all pass when run individually)
- `npm run build`: fails — pre-existing CCR environment issue (Resend constructor throws `Missing API key` at module initialization without RESEND_API_KEY). Confirmed present before this session's changes via `git stash` test.

---

## What's still blocked

DRY-INT requires live external service credentials. Cannot proceed until:
1. STRIPE_SECRET_KEY + Stripe CLI running
2. RESEND_API_KEY + test email inbox accessible
3. ANTHROPIC_API_KEY (app-level, not Claude Code proxy)
4. Coastal Brew Co test data in dev.db
5. Dev server on :3001
6. Andy present to click magic link + observe live events

This is a Phase 6 shadow-period task per the DRY handoff recommendation.

---

## Rollback

Git-revertable, no data shape change. Two test files + one SQL seed file modified.

---

## Files changed

- `lib/db/migrations/0070_legal_v2.sql` — INSERT → INSERT OR IGNORE
- `tests/hp2-hiring-role-brief-wizard.test.ts` — added settings mock
- `tests/hp4-quick-add-scoring.test.ts` — added settings mock
- `PATCHES_OWED.md` — marked two entries applied
- `sessions/PATCH-PRE-DRY-handoff.md` — this file
