# `LG-5` — Lead Gen scoring engine — Handoff

**Closed:** 2026-04-17
**Wave:** 13 — Lead Generation (5 of 10)
**Model tier:** Sonnet (native)

## What was built

- **`lib/lead-gen/scoring.ts`** (new) — Pure scoring engine:
  - `ScoringBreakdown` type alias (`Record<string, number>`)
  - `SAAS_QUALIFICATION_FLOOR = 40`, `RETAINER_QUALIFICATION_FLOOR = 55` (constants)
  - `scoreForSaasTrack(profile, softAdjustment?)` — max 100 raw: team_size (30), has_about_page (10), pagespeed ×0.15 (15), low_ad_spend (25), domain_age (20)
  - `scoreForRetainerTrack(profile, softAdjustment?)` — max 100 raw: meta_ad_spend (25), google_ads (10), instagram_followers (15), youtube_subscribers (10), domain_age (10), maps_review_count (8), maps_rating (5), pagespeed ×0.07 (7), has_pricing_page (5), team_size (5)
  - `assignTrack(profile)` — winner-takes-all: returns `{ track, score }` or `{ track: null, score: 0 }`
  - All three functions pure (no I/O, no DB imports). softAdjustment clamped via `clamp(raw + adj, 0, 100)`.

- **`lib/lead-gen/orchestrator.ts`** (edited):
  - Imported `scoreForSaasTrack`, `scoreForRetainerTrack` from `./scoring`
  - Removed local stub functions and `ScoreResult` interface
  - `ScoredCandidate.saasResult`/`retainerResult` now typed as `ReturnType<typeof scoreForSaasTrack/RetainerTrack>`

- **`lib/lead-gen/index.ts`** (edited):
  - Re-exports `scoreForSaasTrack`, `scoreForRetainerTrack`, `assignTrack`, `SAAS_QUALIFICATION_FLOOR`, `RETAINER_QUALIFICATION_FLOOR`, `ScoringBreakdown`

- **`tests/lead-gen/lg4-orchestrator.test.ts`** (patched):
  - Fixed pre-existing TS2352 cast errors: `as ReturnType<...>` → `as unknown as ReturnType<...>`

- **`tests/lead-gen/lg5-scoring.test.ts`** (new) — 11 tests covering all AC paths

## Key decisions

- SaaS signals (max contribution): team_size (30), low_ad_spend (25), domain_age (20), pagespeed (15), has_about_page (10). Absence of Meta ads when `meta_ads` is null contributes 0 (per spec "missing signal = 0"), not 25 — avoids rewarding data gaps.
- Retainer signals: meta_ad_spend (25), instagram_followers (15), google_ads (10), youtube_subscribers (10), domain_age (10), with smaller weights for maps/pagespeed/pricing page.
- Domain age for SaaS: `<1y=8`, `1-3y=20` (sweet spot), `3-7y=15`, `7+=8` — newer businesses are more DIY-leaning.
- `meta_ads.estimated_spend_bracket="unknown"` treated as "no ad spend" for SaaS purposes (active_ad_count=0 is the same path).

## Artefacts produced

- `lib/lead-gen/scoring.ts` (new)
- `lib/lead-gen/orchestrator.ts` (edited)
- `lib/lead-gen/index.ts` (edited)
- `tests/lead-gen/lg5-scoring.test.ts` (new — 11 tests)
- `tests/lead-gen/lg4-orchestrator.test.ts` (patched — TS cast fixes)

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm test` → 175 test files, 1486 tests passed (11 new in lg5), 1 skipped
- `npm run build` → clean
- `npm run lint` → 0 errors (72 warnings — pre-existing baseline)
- G10.5 (non-UI): fidelity grep — all AC keywords present, all whitelist files covered. PASS.

## Rollback strategy

`git-revertable, no data shape change` — pure helper file, no migrations.

## Memory-alignment declaration

No `MEMORY.md` in this project — no memory-alignment obligations apply.

## G10.5 verdict

Non-UI session — fidelity grep: PASS. All AC keywords (`scoreForSaasTrack`, `scoreForRetainerTrack`, `assignTrack`, `SAAS_QUALIFICATION_FLOOR`, `RETAINER_QUALIFICATION_FLOOR`, `ScoringBreakdown`, qualification floors 40/55, scoring stubs removed) present in new/edited files. No out-of-whitelist edits (except the pre-existing TS cast fix in lg4 test which was blocking the G1 carry-forward tsc gate). No memory violations.

## What LG-6 inherits

- `lib/lead-gen/warmup.ts` still has the `enforceWarmupCap()` stub returning `{ cap: 10, used: 0, remaining: 10, can_send: true }`.
- LG-6 replaces this with the real 4-week ramp reading from `resend_warmup_state` table.
- Ramp: days 1–7 → 5/day, 8–14 → 10/day, 15–21 → 15/day, 22–28 → 20/day, 29+ → 30/day.
- `resend_warmup_state` schema: `started_at` (timestamp_ms), `current_week` (int), `daily_cap` (int), `sent_today` (int), `sent_today_reset_at` (timestamp_ms), `manual_override` (boolean). Single row, id='default'.
- `enforceWarmupCap()` must remain read-only (no mutations) — orchestrator calls it at step 1.
