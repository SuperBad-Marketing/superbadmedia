# `LG-6` — Lead Gen warmup ramp — Handoff

**Closed:** 2026-04-17
**Wave:** 13 — Lead Generation (6 of 10)
**Model tier:** Sonnet (native)

## What was built

- **`lib/lead-gen/warmup.ts`** (edited — stub replaced with real implementation):
  - `enforceWarmupCap(dbInstance?)` reads `resend_warmup_state` (id='default') from DB
  - Computes `daysElapsed = floor((now - started_at) / MS_PER_DAY)`
  - Maps to ramp cap: 0–6d→5, 7–13d→10, 14–20d→15, 21–27d→20, 28+d→30
  - Returns `{ cap, used: sent_today, remaining: max(0, cap-used), can_send: remaining>0 }`
  - No row found → returns day-1 default `{ cap: 5, used: 0, remaining: 5, can_send: true }`
  - Read-only (no DB mutations)

- **`tests/lead-gen/lg6-warmup.test.ts`** (new — 12 tests):
  - All 12 AC test cases covered (no-row default, each day boundary, remaining/clamping)

- **`tests/lead-gen/lg4-orchestrator.test.ts`** (patched — outside whitelist, required for G8):
  - Global `vi.mock("@/lib/db")` `where` mock updated to return thenable-with-limit
  - `runLeadGenDaily` `beforeEach` db.select mock updated same way
  - `enforceWarmupCap (stub)` describe renamed + assertions updated to match real behavior

## Key decisions

- Stub had `cap: 10` hardcoded. Real function with no row returns `cap: 5` (day-1 spec default). Updated lg4 tests accordingly.
- `daysElapsed < 7` (not `≤ 6`) for day-1..7 boundary — aligns with brief test cases (6 days elapsed → cap 5, 7 days elapsed → cap 10).
- `dbInstance = defaultDb` optional parameter pattern matches `deduplicateCandidates` convention; orchestrator calls `enforceWarmupCap()` without arg so the default applies in production.

## Artefacts produced

- `lib/lead-gen/warmup.ts` (edited)
- `tests/lead-gen/lg6-warmup.test.ts` (new — 12 tests)
- `tests/lead-gen/lg4-orchestrator.test.ts` (patched — out-of-whitelist fix for G8)
- `sessions/lg-7-brief.md` (new — G11.b)

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm test` → 176 test files, 1498 passed, 1 skipped (12 new in lg6)
- `npm run build` → clean
- `npm run lint` → 0 errors (72 warnings — pre-existing baseline)
- G10.5 (non-UI): fidelity grep — all AC keywords present. Out-of-whitelist edit to lg4-orchestrator.test.ts justified by G8 (real implementation broke mocks). PASS.

## Rollback strategy

`git-revertable, no data shape change` — single helper file edit + test files, no migrations.

## Memory-alignment declaration

No `MEMORY.md` in this project — no memory-alignment obligations apply.

## G4 — Settings-literal check

- Ramp thresholds (7, 14, 21, 28) and caps (5, 10, 15, 20, 30): spec §10.1 explicitly declares these "non-overrideable". Per spec §6.4 "changes ship as deploys, not config." Hard-coded constants are correct.
- `MS_PER_DAY = 24 * 60 * 60 * 1000`: unit conversion, not an autonomy-sensitive threshold.

## G10.5 verdict

Non-UI session — fidelity grep: PASS. All AC keywords (`enforceWarmupCap`, `WarmupCapResult`, `resend_warmup_state`, `started_at`, `can_send`, `remaining`, `cap: 5`, all ramp values, read-only) present in new/edited files. One out-of-whitelist edit (`tests/lead-gen/lg4-orchestrator.test.ts`) required to fix G8 breakage caused by this session's warmup.ts changes — justified and logged here.

## What LG-7 inherits

- `app/api/cron/lead-gen-daily/route.ts` exists (LG-4) and accepts `trigger` in body
- `lib/db/schema/lead-runs.ts` and `lib/db/schema/lead-candidates.ts` exist (LG-1)
- `CRON_SECRET` in `.env.example` (LG-4 patch)
- LG-7 brief scoped to runs log + manual trigger only; DNC deferred to LG-8
