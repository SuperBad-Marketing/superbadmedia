# `LG-3` — Enrichment pipeline part 2 — Handoff

**Closed:** 2026-04-17
**Wave:** 13 — Lead Generation (3 of 10)
**Model tier:** Sonnet (native — brief pre-compiled by LG-2 per G11.b)

---

## What was built

- **`lib/lead-gen/enrichment/pagespeed.ts`** — `enrichPageSpeed(domain, businessName)`: calls Google PageSpeed Insights API (free, no key). Returns `website.pagespeed_performance_score`. Logs `pagespeed:runPagespeed`. Graceful degradation.
- **`lib/lead-gen/enrichment/domain-age.ts`** — `enrichDomainAge(domain)`: queries RDAP bootstrap service (`rdap.org`, no key). Calendar-based age calculation. Returns `website.domain_age_years`. Logs `whois:domain_lookup`. Graceful degradation.
- **`lib/lead-gen/enrichment/instagram.ts`** — `enrichInstagram(domain, businessName, apiKey)`: Facebook Graph API page search → linked Instagram Business Account → follower/post/cadence signals. Returns `instagram.*`. Logs `meta:instagram_business_discovery`. Graceful degradation.
- **`lib/lead-gen/enrichment/youtube.ts`** — `enrichYouTube(businessName, apiKey)`: YouTube Data API v3 channel search → stats → uploads playlist. Returns `youtube.*`. Logs `youtube:channel_search`. Graceful degradation.
- **`lib/lead-gen/enrichment/website-scrape.ts`** — `enrichWebsiteScrape(domain)`: fetches root/about/team/pricing via cheerio. Returns `website.has_about_page`, `has_pricing_page`, `team_size_signal`, `stated_pricing_tier`. No external_call_log (free fetch). Graceful degradation.
- **`lib/lead-gen/enrichment/maps-photos.ts`** — `enrichMapsPhotos(businessName, location, apiKey)`: SerpAPI `google_maps` engine targeted search. Returns `maps.photo_count` + `maps.last_photo_date`. Logs `serpapi:maps_photos`. Graceful degradation.
- **`lib/lead-gen/enrichment/index.ts`** — barrel export + `mergeProfiles(profiles)` helper. Deep field-level merge: non-null wins for nullable numerics, true wins for booleans, non-'unknown' wins for enum-like strings. `fetch_errors` always aggregated.
- **`lib/lead-gen/index.ts`** — updated to re-export enrichment barrel.
- **`tests/lead-gen/lg3-enrichment.test.ts`** — 42 tests: happy path, error path, null-domain guard, mergeProfiles merge + fetch_errors aggregation.

## Key decisions

- RDAP bootstrap (`rdap.org`) chosen over whoisxmlapi.com for domain age — no API key required, IANA-standard JSON format.
- Calendar-based age calculation (`computeAgeYears`) uses year/month/day arithmetic instead of Julian years — Julian approach was off by 1 year for "exactly N years ago" dates.
- Each enricher fills ALL required fields of its sub-object with defaults (null/false/'unknown') to satisfy `ViabilityProfile` TypeScript types. `mergeProfiles` uses smart field-level logic to prevent defaults overwriting real values from earlier profiles.
- `maps-photos` enricher stores photo fields alongside empty category/rating/review_count defaults. `mergeProfiles.mergeMaps` uses `||`/`??` rules to preserve real values from earlier (google-maps adapter) while allowing maps-photos to update photo fields.
- cheerio was already installed (v1.2.0) — no new npm package required.

## Artefacts produced

- `lib/lead-gen/enrichment/pagespeed.ts` (new)
- `lib/lead-gen/enrichment/domain-age.ts` (new)
- `lib/lead-gen/enrichment/instagram.ts` (new)
- `lib/lead-gen/enrichment/youtube.ts` (new)
- `lib/lead-gen/enrichment/website-scrape.ts` (new)
- `lib/lead-gen/enrichment/maps-photos.ts` (new)
- `lib/lead-gen/enrichment/index.ts` (new — barrel + mergeProfiles)
- `lib/lead-gen/index.ts` (edited — enrichment re-export)
- `tests/lead-gen/lg3-enrichment.test.ts` (new — 42 tests)

## Verification

- G8: `npx tsc --noEmit` → 0 errors. `npm test` → 1463 passed, 1 skipped (173 test files). `npm run build` → clean. `npm run lint` → 0 errors (70 warnings — pre-existing baseline).
- G10.5 (non-UI): fidelity grep — all AC keywords present in diff, all job names correct, no whitelist violations. PASS.

## Rollback strategy

`git-revertable, no data shape change` — pure helper files, no migrations.

## PATCHES_OWED

- **`lg_3_maps_photo_count_zero_edge_case`** — If maps-photos enricher finds a business with exactly 0 photos, `mergeProfiles` may prefer an earlier non-zero photo_count (from google-maps) over the more accurate 0 from maps-photos. Tracked; edge case is rare and v1-acceptable.

## Memory-alignment declaration

No `MEMORY.md` exists in this project — no memory-alignment obligations apply.

## G10.5 verdict

Non-UI session — fidelity grep: PASS. All 6 enricher functions + mergeProfiles + barrel export + external_call_log job names present. No out-of-whitelist source files. No memory violations.

## What LG-4 inherits

LG-4 builds the orchestrator (daily run cron handler). All 3 discovery sources (LG-2) and all 6 enrichers (LG-3) + mergeProfiles are now available. LG-4 can stub `enforceWarmupCap()` (LG-6 will build the real one) and scoring functions (LG-5). Key imports: `searchMetaAdLibrary`, `searchGoogleMaps`, `searchGoogleAdsTransparency`, `enrichPageSpeed`, `enrichDomainAge`, `enrichInstagram`, `enrichYouTube`, `enrichWebsiteScrape`, `enrichMapsPhotos`, `mergeProfiles`, `isBlockedFromOutreach`, `lead_gen_enabled` kill switch, settings keys `lead_generation.*`.
