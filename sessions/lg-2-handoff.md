# `lg-2` — Enrichment pipeline part 1: Discovery sources — Handoff

**Closed:** 2026-04-18
**Wave:** 13 — Lead Generation (2 of 10)
**Model tier:** Sonnet (as recommended — standard build session)

---

## What was built

### 1. ViabilityProfile type definition

**`lib/lead-gen/types.ts`** — TypeScript interfaces matching spec §5:

- `ViabilityProfile` — structured JSON shape for `lead_candidates.viability_profile_json`. All fields optional; scorers tolerate missing values.
- `DiscoveredCandidate` — common output shape for all three discovery sources (company_name, domain, source, partial_profile, raw_source_data).
- `DiscoverySearchParams` — search configuration derived from Settings → Lead Generation → Daily Search.
- `SourceResult` — per-source result envelope with timing and error capture.

### 2. Meta Ad Library fetcher

**`lib/lead-gen/sources/meta-ad-library.ts`** — `searchMetaAdLibrary(params)`:

- Queries Meta Ad Library API (`/ads_archive` endpoint) for active advertisers in AU.
- Uses `meta-ads` credential from vault via `getCredential()`.
- Deduplicates by `page_id` within results (same advertiser, multiple ads).
- Extracts domain from `ad_creative_link_captions` (Meta often includes the advertiser's domain there).
- Classifies estimated spend bracket from `estimated_audience_size` bounds (low/medium/high/unknown).
- Seeds `partial_profile.meta_ads` for downstream scoring.
- Logs to `external_call_log` (job: `meta.ad_library.search`, cost: $0 — free API).
- Graceful degradation: returns `{ candidates: [], error }` on any failure.

### 3. Google Maps fetcher (SerpAPI)

**`lib/lead-gen/sources/google-maps.ts`** — `searchGoogleMaps(params)`:

- Queries SerpAPI `google_maps` engine with `category + location` query shape.
- Reuses `serpapi` credential (shared with Content Engine).
- Maps `local_results` to `DiscoveredCandidate[]` with partial maps profile (category, rating, review_count, photo_count).
- Extracts domain from `website` field when present; null otherwise.
- Captures `place_id`, `address`, `phone`, `gps_coordinates` in `raw_source_data` for downstream use.
- Logs to `external_call_log` (job: `serpapi.google_maps`, cost: ~$0.005/query).

### 4. Google Ads Transparency fetcher (SerpAPI)

**`lib/lead-gen/sources/google-ads-transparency.ts`** — `searchGoogleAdsTransparency(params)`:

- Queries SerpAPI `google_ads_transparencycenter` engine with category/brief as text, region AU.
- Reuses `serpapi` credential.
- Handles both `advertiser_results` and `ads_results` response shapes (SerpAPI varies).
- Deduplicates by `advertiser_id` within results.
- Normalises domain from various URL formats (full URLs, bare domains, www-prefixed).
- Seeds `partial_profile.google_ads` (active_creative_count, has_active_campaigns).
- Logs to `external_call_log` (job: `serpapi.google_ads_transparency`, cost: ~$0.005/query).

### 5. Discovery orchestrator

**`lib/lead-gen/discovery.ts`** — `runDiscovery(params)`:

- Runs all three sources in parallel via `Promise.allSettled` (spec §3.4 step 2).
- Per-source failures captured in `source_results` (for `lead_runs.per_source_errors_json`).
- Deduplicates by domain (lowercased) in priority order: Meta > Transparency > Maps.
- Candidates without a domain are never deduped against each other.
- Returns `DiscoveryRunResult` with `candidates`, `source_results`, `total_found_before_dedup`, `dedup_removed`.

### 6. Barrel export

**`lib/lead-gen/index.ts`** updated with LG-2 exports: types, three source fetchers, discovery orchestrator.

## Files created

- `lib/lead-gen/types.ts`
- `lib/lead-gen/sources/meta-ad-library.ts`
- `lib/lead-gen/sources/google-maps.ts`
- `lib/lead-gen/sources/google-ads-transparency.ts`
- `lib/lead-gen/discovery.ts`
- `tests/lead-gen/lg2-types.test.ts`
- `tests/lead-gen/lg2-meta-ad-library.test.ts`
- `tests/lead-gen/lg2-google-maps.test.ts`
- `tests/lead-gen/lg2-google-ads-transparency.test.ts`
- `tests/lead-gen/lg2-discovery.test.ts`

## Files edited

- `lib/lead-gen/index.ts` — LG-2 barrel exports added

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Meta Ad Library uses the existing `meta-ads` credential.** The Ad Library API and the Marketing API use the same access token type. No separate credential needed.

2. **SerpAPI credential shared across Google Maps + Transparency + Content Engine.** Single `serpapi` vendor key. No per-engine credential split — SerpAPI bills per search regardless of engine.

3. **Dedup priority: Meta > Transparency > Maps.** Ad-running businesses (Meta/Google) are higher-signal than location-only discovery. When the same domain appears in multiple sources, the ad-running discovery wins because it carries richer partial profile data.

4. **No domain = no dedup.** Maps-sourced candidates without websites can't be meaningfully deduplicated. They pass through and rely on downstream DNC + existing-deal dedup (spec §3.4 step 3) to catch real collisions.

5. **Spend bracket heuristic uses estimated_audience_size.** Meta doesn't expose actual spend in the Ad Library. Audience size midpoint is a rough proxy: <5k = low, 5k–50k = medium, >50k = high. Good enough for scoring; not a financial claim.

6. **Google Ads Transparency uses `google_ads_transparencycenter` engine.** SerpAPI's engine name, not the official Google name. Handles both `advertiser_results` and `ads_results` response keys defensively.

## Verification (G0–G12)

- **G0** — LG-1 and CE-13 handoffs read. Spec §3.1, §3.2, §5 read. BUILD_PLAN Wave 13 read.
- **G1** — Preconditions verified: `getCredential()`, `external_call_log` table, `meta-ads` vendor manifest, `serpapi` vendor manifest, `META_GRAPH_API_VERSION`, `SERPAPI_API_BASE` — all present.
- **G2** — Files match LG-2 scope (types + three discovery sources + orchestrator + tests).
- **G3** — No motion work.
- **G4** — No numeric/string literals in autonomy-sensitive paths. Spend bracket thresholds are classification heuristics, not autonomy thresholds.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 176 test files / 1437 passed + 1 skipped (+43 new), clean production build.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1437 passed.
- **G9** — No browser-testable surface. Library-only session.
- **G10** — All three fetchers + orchestrator exercised by 43 unit tests covering happy path, error handling, dedup, priority, and edge cases.
- **G10.5** — N/A (standard build session).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`lg_2_enrichment_cost_logging`** — `external_call_log.estimated_cost_aud` uses rough SerpAPI per-query estimate ($0.005). Should be refined when real SerpAPI plan is known (per-search cost varies by plan tier).
- **`lg_2_meta_ad_library_pagination`** — Meta Ad Library API supports pagination (`paging.next`). Current implementation fetches one page only. For v1 daily cap of 8 candidates, single-page is sufficient. Pagination lands if daily cap increases.
- **`lg_2_google_maps_ll_param`** — Google Maps SerpAPI engine supports `ll` (lat,lng,zoom) for precise geo-targeting. Currently uses text `location` param only. Could improve with geocoding the Settings location to coordinates.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Types module
- Three source fetchers + sources directory
- Discovery orchestrator
- Barrel export additions
- Test files

## What the next session (LG-3) inherits

LG-3 is **Enrichment pipeline part 2: PageSpeed + whois + Instagram + YouTube + website scrape + Maps extras** — the six qualification signals. LG-2 provides:

- **`ViabilityProfile` type** ready for enrichment functions to populate remaining fields.
- **`DiscoveredCandidate` shape** with `partial_profile` seeded by discovery — enrichment merges into this.
- **`runDiscovery()` orchestrator** returns candidates ready for step 4 of §3.4 ("Enrich each survivor").
- **Pattern established** for external API calls: `getCredential()` → fetch → log to `external_call_log` → graceful error return.
- **SerpAPI and Meta Ad credential patterns** reusable for any enrichment signal that uses those APIs.
