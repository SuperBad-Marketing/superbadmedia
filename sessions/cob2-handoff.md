# COB-2 Handoff — Cost & Usage Observatory: Job Band Registry

**Date:** 2026-04-21
**Wave:** 21
**Status:** COMPLETE

## What was built

### 1. Unified job band registry

`lib/observatory/job-registry.ts` — the authoritative registry of every external-call job's cost bands. Spec §4.2.

- **80 LLM jobs** auto-derived from `lib/ai/models.ts` tier mapping with tier-based band defaults:
  - Opus: per_call $1.50, daily $75
  - Sonnet: per_call $0.25, daily $25
  - Haiku: per_call $0.05, daily $10
- **Heavy Opus overrides** for large-context jobs: cockpit-brief ($5.00/$150), six-week-plan-strategy ($5.00/$100), observatory-diagnose ($3.00/$50), brand-dna-prose-portrait ($3.00/$50), content-generate-blog-post ($3.00/$100), and 6 others
- **High-volume Haiku overrides** for classifiers: inbox-classify-*, content-score-*, hiring-candidate-score, drift-check-grader — daily ceiling raised to $25
- **20 non-LLM vendor jobs** covering all existing call sites: serpapi (3), hunter (1), meta (2), google (2), rdap (1), website scrape (1), hiring portfolio (2), weather (1), stripe (2), resend (2), graph (3)
- Free APIs have zero cost ceilings (rate detector still catches loops)
- `learned_band_multiplier: 3` on all jobs (default warmup period)
- All entries frozen at module load — immutable at runtime

Types exported: `JobBands`, `JobRegistryEntry`, `Vendor`

### 2. Unknown-job trap wired into `logExternalCall()`

`lib/observatory/log-external-call.ts` — per spec §4.2:
- Insert always succeeds (never lose data)
- Unregistered job in development: throws hard
- Unregistered job in production: creates a synthetic `cost_anomaly` row with `tier: 'severe'`, `detector: 'hard_threshold'`, `expected_band: { unregistered: true }`

### 3. `registerBands()` stub replaced with real bridge

`lib/integrations/registerBands.ts` — no longer a no-op stub. Now validates vendor job names against the Observatory registry and warns in development for unregistered names. Signature unchanged — callers (`registerIntegration`) keep working.

### 4. Observatory barrel updated

`lib/observatory/index.ts` — exports all registry functions and types.

## New files

- `lib/observatory/job-registry.ts`
- `tests/cob2-job-registry.test.ts`

## Edited files

- `lib/observatory/index.ts` — added registry exports
- `lib/observatory/log-external-call.ts` — added unknown-job trap
- `lib/integrations/registerBands.ts` — replaced stub with registry-aware bridge

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run` — 274 files, 2775 passed (+26 new), 1 skipped

## Rollback

- New file is additive — git-revertable
- `logExternalCall()` changes are backward-compatible (unknown-job check is a post-insert side effect)
- `registerBands()` signature unchanged — callers unaffected
- No schema changes, no migrations, no settings keys modified

## Key decisions

- **Registry lives in `lib/observatory/` not `lib/ai/`** — the spec says "lib/ai/models.ts + lib/integrations/registry.ts" but the cost-band registry is an Observatory concern. LLM tier data stays in models.ts; bands derive from it.
- **Tier-based defaults with surgical overrides** — instead of 80 individual band configs, bands derive from the model tier with per-job overrides where expected usage differs. Keeps the module readable and the overrides auditable.
- **Free APIs get zero cost ceilings** — per_call and daily ceilings of 0 mean the hard-threshold and learned-band detectors skip them. The rate detector still catches loops (it fires on call count, not cost).
- **Used `hard_threshold` detector for synthetic unregistered-job anomaly** — the cost_anomalies enum is `hard_threshold | rate | learned_band`. An unregistered job is closest to a hard-threshold violation. The `expected_band.unregistered: true` flag distinguishes it.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (CMS-6 or asset session)
- `sd11_deep_reader_link_target` — per-page config for "deeper piece" link (CMS-6 content)
- `sd11_rapid_scroller_per_page_summary` — per-page one-sentence summary (CMS-6 content)

## Next session should know

- **COB-3** should migrate direct `external_call_log` inserts to use `logExternalCall()`. Files to migrate: `lib/lead-gen/contact-discovery.ts`, `lib/lead-gen/enrich/youtube.ts`, `lib/lead-gen/enrich/pagespeed.ts`, `lib/lead-gen/enrich/whois.ts`, `lib/lead-gen/enrich/website-scrape.ts`, `lib/lead-gen/enrich/instagram.ts`, `lib/lead-gen/enrich/maps-extras.ts`, `lib/lead-gen/sources/google-maps.ts`, `lib/lead-gen/sources/google-ads-transparency.ts`, `lib/lead-gen/sources/meta-ad-library.ts`, `lib/hiring/portfolio.ts`. Each has a local `logExternalCall()` function that should be replaced with the observatory import.
- **Actor attribution** — after COB-3 wiring, callers that serve subscribers or prospects should pass correct `actorType` and `actorId`. Defaults to `"internal"` today.
- **Band values are starting defaults** — Andy tunes via the one-click band editor (COB-7). The detectors (COB-4..COB-6) read bands from the registry.
- **CMS-6** still required before COB-4+ (detectors + banners need dashboard content). COB-3 doesn't need CMS-6.
