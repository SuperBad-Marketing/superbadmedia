# `LG-3` — Enrichment pipeline part 2 — Handoff

**Closed:** 2026-04-17
**Wave:** 13 — Lead Generation (3 of 10)
**Model tier:** Sonnet (native — correct tier)

---

## What was built

- **`lib/lead-gen/enrichment/pagespeed.ts`** — `enrichPageSpeed(domain, _businessName)`: Google PageSpeed Insights API v5, populates `website.pagespeed_performance_score`. Logs `pagespeed:runPagespeed` to external_call_log. Graceful on null domain / HTTP error / network failure.
- **`lib/lead-gen/enrichment/domain-age.ts`** — `enrichDomainAge(domain)`: RDAP public API via `rdap.org`, populates `website.domain_age_years`. Logs `whois:domain_lookup`. Graceful on null domain / HTTP error.
- **`lib/lead-gen/enrichment/instagram.ts`** — `enrichInstagram(domain, _businessName, apiKey)`: scrapes homepage for instagram.com/username link via cheerio, then Meta Graph API. Populates `instagram.*`. Logs `meta:instagram_business_discovery`. `posts_last_30d` always null (see PATCHES_OWED).
- **`lib/lead-gen/enrichment/youtube.ts`** — `enrichYouTube(businessName, apiKey)`: YouTube Data API v3 (search + channel stats + playlist items). Populates `youtube.*` including `uploads_last_90d`. Logs `youtube:channel_search`.
- **`lib/lead-gen/enrichment/website-scrape.ts`** — `enrichWebsiteScrape(domain)`: fetches root + /about + /team + /pricing, cheerio-parses for `has_about_page`, `has_pricing_page`, `team_size_signal`, `stated_pricing_tier`. Does NOT log to external_call_log (free fetch).
- **`lib/lead-gen/enrichment/maps-photos.ts`** — `enrichMapsPhotos(businessName, location, apiKey)`: SerpAPI `google_maps` engine, populates `maps.photo_count` + `maps.last_photo_date` with empty defaults for category/rating/review_count so mergeProfiles preserves LG-2 Maps data. Logs `serpapi:maps_photos`.
- **`lib/lead-gen/enrichment/index.ts`** — barrel export for all 6 enrichers + `mergeProfiles(profiles)` helper. Deep-merges sub-objects (`website`, `instagram`, `youtube`, `maps`) field-by-field using `prefer()` (meaningful later value wins; null/empty/unknown/0 do not overwrite). Aggregates `fetch_errors`.
- **`lib/lead-gen/index.ts`** — updated to re-export all 6 enrichers + `mergeProfiles`.
- **`tests/lead-gen/lg3-enrichment.test.ts`** — 42 tests covering happy path, null domain, HTTP error, network failure, mergeProfiles merge semantics + fetch_errors aggregation + maps-photos non-overwrite.

## Pre-existing fix (outside whitelist — build gate blocker)

- **`app/lite/portal/subscription/page.tsx`** — removed `export { computeSaasExitMath }` (invalid Next.js page export). Tests import from `lib/saas-products/cancel-math` directly — no test regression. Logged to PATCHES_OWED as `lg_3_subscription_page_build_export` (gate: closed).

## Key decisions

- `enrichDomainAge` uses RDAP via `rdap.org` (free, no API key, returns JSON with `events[]`). No API key in signature per brief spec.
- `enrichPageSpeed` takes no apiKey (brief spec — unauthenticated mode, lower quota).
- `enrichInstagram` scrapes homepage for Instagram handle first (cheerio), then Graph API. `posts_last_30d: null` always — extra paginated calls deferred (PATCHES_OWED).
- `mergeProfiles` uses "meaningful wins" semantics per field: null/0/"unknown"/"" are treated as defaults and don't overwrite real values. Booleans use OR semantics.
- `maps-photos.ts` returns empty defaults for category/rating/review_count so they don't overwrite the google-maps adapter values when merged.
- cheerio was already installed (`^1.2.0`). No new npm packages installed.

## Artefacts produced

- `lib/lead-gen/enrichment/pagespeed.ts` (new)
- `lib/lead-gen/enrichment/domain-age.ts` (new)
- `lib/lead-gen/enrichment/instagram.ts` (new)
- `lib/lead-gen/enrichment/youtube.ts` (new)
- `lib/lead-gen/enrichment/website-scrape.ts` (new)
- `lib/lead-gen/enrichment/maps-photos.ts` (new)
- `lib/lead-gen/enrichment/index.ts` (new — barrel + mergeProfiles)
- `lib/lead-gen/index.ts` (edited — +enrichment exports)
- `tests/lead-gen/lg3-enrichment.test.ts` (new — 42 tests)
- `app/lite/portal/subscription/page.tsx` (edited — pre-existing build fix)
- `sessions/lg-4-brief.md` (new — G11.b rolling cadence)

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm test` → 173 files, 1463 passed, 1 skipped. Clean.
- `npm run lint` → 0 errors, 71 warnings (baseline)
- `npm run build --webpack` → clean (after pre-existing subscription page fix)

## Rollback strategy

`git-revertable, no data shape change` — pure helper files, no DB migrations.

## PATCHES_OWED (raised this session)

- `lg_3_subscription_page_build_export` — closed (fixed in-session)
- `lg_3_instagram_posts_last_30d_null` — deferred, LG-5 scoring review gate
- `lg_3_domain_age_subdomain_logic` — heuristic approximation, opportunistic gate

## Memory-alignment declaration

No `MEMORY.md` exists in this project — no memory-alignment obligations apply.

## G10.5 verdict

Non-UI session — fidelity grep: PASS. All 6 enricher exports, all 5 external_call_log job strings (`pagespeed:runPagespeed`, `whois:domain_lookup`, `meta:instagram_business_discovery`, `youtube:channel_search`, `serpapi:maps_photos`), `mergeProfiles`, and all acceptance-criterion keywords present in diff. No out-of-whitelist changes in LG-3 scope (subscription page fix is pre-existing infrastructure). No MEMORY.md violations.

## What LG-4 inherits

LG-4 builds the daily run orchestrator using LG-2 (discovery adapters), LG-3 (enrichment + mergeProfiles), and LG-1 (isBlockedFromOutreach, lead_candidates, lead_runs). Also needs `enforceWarmupCap()` (new in LG-4) and a scoring stub. See `sessions/lg-4-brief.md`.
