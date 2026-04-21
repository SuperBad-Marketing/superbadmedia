# COB-1 Handoff — Cost & Usage Observatory: Schema + Logging Primitives

**Date:** 2026-04-21
**Wave:** 21
**Status:** COMPLETE

## What was built

### 1. `cost_anomalies` table + Drizzle schema

`lib/db/schema/cost-anomalies.ts` + migration `0065_cob1_observatory_tables.sql`:
- 16 columns matching spec §4.1 exactly
- Enums: `COST_ANOMALY_DETECTORS` (hard_threshold, rate, learned_band), `COST_ANOMALY_TIERS` (low, mid, severe)
- 3 indexes: by_job, by_tier, unresolved (for active anomaly queries)
- CHECK constraints on detector and tier columns

### 2. `deploy_events` table + Drizzle schema

`lib/db/schema/deploy-events.ts`:
- 5 columns: id, commit_sha, deployed_at_ms, status, preview_url
- Enum: `DEPLOY_EVENT_STATUSES` (deploying, ready, failed)
- 1 index: by_deployed_at
- CHECK constraint on status

### 3. Observatory settings keys (5 new)

Added to `lib/settings.ts` registry + `0001_seed_settings.sql`:
- `observatory.monthly_threshold_1_aud` — default $250
- `observatory.monthly_threshold_2_aud` — default $500
- `observatory.monthly_threshold_3_aud` — default $1000
- `observatory.projection_alert_enabled` — default true
- `observatory.weekly_digest_enabled` — default true

Settings count: 157 → 162.

### 4. Pricing module

`lib/observatory/pricing.ts`:
- `estimateAnthropicCostAud(tier, usage)` — per-tier token pricing with USD→AUD conversion
- Helper functions for Stripe, Resend, Twilio, SerpAPI per-call estimates
- Hardcoded rate card (May 2025) — spec accepts ±15% accuracy

### 5. `logExternalCall()` helper

`lib/observatory/log-external-call.ts`:
- Central insert helper for `external_call_log`
- Takes job, actor attribution, units, estimated cost
- Accepts optional DB argument for testing
- Feature code uses this, never inserts directly

### 6. Wired into `invoke.ts` — every LLM call now logs cost

- All 3 Anthropic entry points (`invokeLlmText`, `invokeLlmTextWithMeta`, `invokeLlmVision`) now log to `external_call_log` after every call
- Fire-and-forget via `.catch(() => {})` — never blocks the response
- Defensive `safeUsage()` handles missing `response.usage` gracefully (test mocks don't always include it)
- New optional params `actorType` and `actorId` on all functions for caller attribution

## New files

- `lib/db/schema/cost-anomalies.ts`
- `lib/db/schema/deploy-events.ts`
- `lib/db/migrations/0065_cob1_observatory_tables.sql`
- `lib/observatory/index.ts`
- `lib/observatory/log-external-call.ts`
- `lib/observatory/pricing.ts`
- `tests/cob1-observatory-schema.test.ts`

## Edited files

- `lib/db/schema/index.ts` — added exports for 2 new schema files
- `lib/db/migrations/meta/_journal.json` — added migration entry (idx 65)
- `lib/db/migrations/0001_seed_settings.sql` — added 5 observatory settings
- `lib/settings.ts` — added 5 observatory keys to registry
- `lib/ai/invoke.ts` — added cost logging to all 3 entry points
- `tests/settings.test.ts` — updated count 157→162, relaxed key regex to allow digits

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run` — 273 files, 2749 passed (+21 new), 1 skipped
- All 6 previously failing tests fixed and passing

## Rollback

- New tables additive — git-revertable
- Settings seed is INSERT OR IGNORE — idempotent
- `invoke.ts` changes are backward-compatible (new params are optional, logging is fire-and-forget)
- No data shape changes to existing tables

## Key decisions

- **Used the central settings system** instead of the spec's `observatory_settings` single-row table. Consistent with every other feature's settings pattern. The spec's table shape maps 1:1 to settings keys.
- **Defensive `safeUsage()`** — extracts `response.usage` with optional chaining. 6 existing test suites mock the Anthropic SDK without `usage` in the response; defensive extraction keeps them green without requiring mock updates.
- **Skip logging when usage is zero** — `logCost()` returns early when both token counts are 0 (mocked responses). Real calls always have non-zero usage.
- **Migration hand-written** — drizzle-kit generate has a snapshot collision (known issue). Hand-wrote SQL + journal entry following the project's established pattern.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (CMS-6 or asset session)
- `sd11_deep_reader_link_target` — per-page config for "deeper piece" link (CMS-6 content)
- `sd11_rapid_scroller_per_page_summary` — per-page one-sentence summary (CMS-6 content)

## Next session should know

- **COB-2** should build the job band registry — extending `lib/ai/models.ts` with per-job bands (per_call_ceiling_aud, daily_ceiling_aud, learned_band_multiplier) per spec §4.2. The pricing formulas in `lib/observatory/pricing.ts` provide the AUD estimation; bands define the alert thresholds.
- **CMS-6** (content mini-session) is still outstanding and required before COB-4+ (detectors + banners). COB-2 and COB-3 (wiring remaining vendors) don't need CMS-6.
- **`external_call_log` already existed** from A6. No migration was needed for it.
- **Existing call sites** in `lib/lead-gen/contact-discovery.ts` and similar files already insert into `external_call_log` directly — these should be migrated to use `logExternalCall()` in COB-3.
- **Actor attribution** in `invoke.ts` defaults to `"internal"` — callers that serve subscribers or prospects must pass the correct `actorType` and `actorId`. This is a wiring task for each feature's LLM call site across the codebase.
