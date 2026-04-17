# `LG-3` — Enrichment pipeline part 2 — Handoff

**Closed:** 2026-04-17
**Wave:** 13 — Lead Generation (3 of 10)
**Model tier:** Sonnet (native — stale lock reclaimed from prior failed LG-3 attempt; no enrichment artifacts found, ran fresh)

---

## What was built

- **`lib/lead-gen/enrichment/pagespeed.ts`** — `enrichPageSpeed(domain, businessName)`: calls Google PageSpeed Insights API (no key required), returns `website.pagespeed_performance_score` (0–100). Logs `pagespeed:runPagespeed`. Graceful on null domain / error.
- **`lib/lead-gen/enrichment/domain-age.ts`** — `enrichDomainAge(domain)`: uses RDAP protocol (`rdap.org/domain/{domain}`) — free, key-free, ICANN standard. Returns `website.domain_age_years`. Logs `whois:domain_lookup`. Graceful on null domain / error.
- **`lib/lead-gen/enrichment/instagram.ts`** — `enrichInstagram(domain, businessName, apiKey)`: Graph API Business Discovery — first gets requester's IG account ID via `/me`, then looks up target by derived username. Returns `instagram.{follower_count, post_count, posts_last_30d}` (posts_last_30d always null — Graph API doesn't expose 30d cadence without media paging). Logs `meta:instagram_business_discovery`. Graceful on empty apiKey / error.
- **`lib/lead-gen/enrichment/youtube.ts`** — `enrichYouTube(businessName, apiKey)`: YouTube Data API v3 — 2-step (search for channel, then get statistics). Returns `youtube.{subscriber_count, video_count, uploads_last_90d}` (uploads_last_90d null — would need playlist scan). Logs `youtube:channel_search`. Graceful on empty apiKey / error.
- **`lib/lead-gen/enrichment/website-scrape.ts`** — `enrichWebsiteScrape(domain)`: fetches root, /about, /about-us, /team, /our-team, /pricing, /prices in parallel (8-second timeout each). Uses cheerio to parse text. Returns `website.{has_about_page, has_pricing_page, team_size_signal, stated_pricing_tier}`. No external_call_log (free fetch). Graceful on null domain / all-404 / network errors.
- **`lib/lead-gen/enrichment/maps-photos.ts`** — `enrichMapsPhotos(businessName, location, apiKey)`: SerpAPI google_maps engine, returns `maps.{photo_count, last_photo_date}` ONLY — does NOT include category/rating/review_count in the return so mergeProfiles preserves existing LG-2 data for those fields. Logs `serpapi:maps_photos`. Graceful on empty apiKey / error.
- **`lib/lead-gen/enrichment/index.ts`** — barrel export for all 6 enrichers + `mergeProfiles()` helper.
- **`lib/lead-gen/index.ts`** — updated to re-export enrichment barrel.
- **`tests/lead-gen/lg3-enrichment.test.ts`** — 36 tests: happy path, null domain, HTTP error, network error, API-level error for each enricher; mergeProfiles correct deep-merge, fetch_errors aggregation, later non-null wins.

## Key decisions

- **mergeProfiles deep-merges sub-objects** with "later non-null wins" semantics within each sub-object. This allows pagespeed (contributes pagespeed_performance_score), domain-age (contributes domain_age_years), and website-scrape (contributes has_about_page, has_pricing_page, team_size_signal, stated_pricing_tier) to independently return their piece of the `website` sub-object without clobbering each other. Each enricher fills all website fields with null/false/"unknown" defaults; mergeProfiles preserves existing non-null values.
- **maps-photos returns only photo_count + last_photo_date** (via `Pick<>` + type cast) — does NOT set category/rating/review_count defaults. This preserves values set by the LG-2 google-maps adapter.
- **posts_last_30d and uploads_last_90d** always return null — cadence calculation requires pagination of media/uploads API, deferred for v1.1.
- **RDAP for domain-age** instead of WHOIS APIs (rdap.org routes to the right registry per TLD, free, no API key). Works for .com, .com.au, .net, major TLDs.
- **Cheerio already in dependencies** (`^1.2.0`) — no new packages installed.
- **Instagram username derivation** is best-effort (lowercase + strip non-alphanumeric). If the derived username doesn't match a real IG profile, the enricher returns `{}` gracefully.

## Stale lock note

The LOCK file from a prior LG-3 attempt (started_at: 2026-04-17T00:00:00Z — 17h stale) was reclaimed per AUTONOMY_PROTOCOL.md §2. No enrichment artifacts were found in the repo — the prior session crashed before committing. This session ran clean.

## Artefacts produced

- `lib/lead-gen/enrichment/pagespeed.ts` (new)
- `lib/lead-gen/enrichment/domain-age.ts` (new)
- `lib/lead-gen/enrichment/instagram.ts` (new)
- `lib/lead-gen/enrichment/youtube.ts` (new)
- `lib/lead-gen/enrichment/website-scrape.ts` (new)
- `lib/lead-gen/enrichment/maps-photos.ts` (new)
- `lib/lead-gen/enrichment/index.ts` (new — barrel + mergeProfiles)
- `lib/lead-gen/index.ts` (edited — +enrichment exports)
- `tests/lead-gen/lg3-enrichment.test.ts` (new — 36 tests)

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm test` → 173 test files, 1457 passed, 1 skipped
- `npm run build` → clean
- `npm run lint` → 0 errors (71 pre-existing warnings, unchanged baseline)
- G10.5: non-UI fidelity grep — all acceptance-criterion exports and job names present in diff. PASS.

## Rollback strategy

`git-revertable, no data shape change` — pure helper files, no DB migrations. Rollback = `git revert`.

## PATCHES_OWED (raised this session)

- **`lg_3_posts_last_30d`** — `instagram.posts_last_30d` always null (would need media paging). LG-5 or later session can add media pagination if needed.
- **`lg_3_uploads_last_90d`** — `youtube.uploads_last_90d` always null (would need uploads playlist scan). Defer to v1.1.

## Memory-alignment declaration

No `MEMORY.md` exists in this project — no memory-alignment obligations apply.

## G4 — Settings-literal check

- `8000` (website scrape per-page fetch timeout): reviewed, determined to be an implementation detail of the scraper, not an autonomy-sensitive parameter. No settings key required.
- `num: "1"`, `maxResults: "1"`: internal enricher caps (single result per lookup), not autonomy-sensitive.

## What LG-4 inherits

LG-4 builds the orchestrator — the daily run cron handler. Spec §3.4 steps 1-7. Dependencies now met:
- LG-2 source adapters: `searchMetaAdLibrary`, `searchGoogleMaps`, `searchGoogleAdsTransparency`
- LG-3 enrichers: all 6 `enrich*` functions + `mergeProfiles`
- LG-1: `enforceWarmupCap` (schema exists: `resend_warmup_state` table; function not yet built — LG-4 owns it)
- LG-1: `isBlockedFromOutreach` for dedup step 3
- LG-1: settings keys for orchestrator config

LG-4 can stub scoring as `() => ({ saasScore: 0, retainerScore: 0, qualifiedTrack: 'saas', qualifies: false })` and patch when LG-5 ships. See LG-4 brief.
