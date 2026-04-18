# `lg-3` — Enrichment pipeline part 2: PageSpeed + whois + Instagram + YouTube + website scrape + Maps extras — Handoff

**Closed:** 2026-04-18
**Wave:** 13 — Lead Generation (3 of 10)
**Model tier:** Sonnet (as recommended — standard build session)

---

## What was built

### 1. PageSpeed Insights enrichment

**`lib/lead-gen/enrich/pagespeed.ts`** — `fetchPageSpeed(domain)`:

- Queries Google PageSpeed Insights API v5 (mobile strategy, performance category).
- Uses `google-pagespeed` credential from vault.
- Returns 0–100 performance score. Score is `rawScore * 100` (Lighthouse returns 0–1).
- `applyPageSpeedToProfile()` merges into `website.pagespeed_performance_score`.
- Logs to `external_call_log` (job: `google.pagespeed.run`, cost: $0 — free API).

### 2. WHOIS (RDAP) enrichment

**`lib/lead-gen/enrich/whois.ts`** — `fetchWhois(domain)`:

- Queries RDAP bootstrap endpoint (`rdap.org/domain/`), the modern JSON replacement for raw whois.
- No API key needed — free, public protocol.
- Extracts `registration` event date, computes domain age in fractional years.
- 10-second timeout. Handles privacy-protected domains gracefully (null age).
- `applyWhoisToProfile()` merges into `website.domain_age_years`.
- Logs to `external_call_log` (job: `rdap.domain_lookup`, cost: $0).

### 3. Instagram Business Discovery enrichment

**`lib/lead-gen/enrich/instagram.ts`** — `fetchInstagram(domain, instagramHandle?)`:

- Queries Instagram Business Discovery API via Meta Graph API.
- Reuses `meta-ads` credential (same token supports both Marketing API and IG Business Discovery).
- `guessInstagramHandle(domain)` heuristic strips TLD + non-IG-safe characters.
- Fetches: followers_count, media_count, recent 30 media timestamps → `posts_last_30d`.
- `applyInstagramToProfile()` merges into `instagram.*`.
- Logs to `external_call_log` (job: `meta.instagram_business_discovery`, cost: $0).

### 4. YouTube Data API enrichment

**`lib/lead-gen/enrich/youtube.ts`** — `fetchYouTube(companyName, domain?)`:

- Three-step pipeline: search for channel → fetch channel statistics → fetch recent activity.
- Uses `google-youtube` credential from vault.
- Search is name+domain to narrow results. Statistics give subscriber_count + video_count.
- Activity endpoint filtered to last 90 days for upload cadence signal.
- Hidden subscriber count returns null (graceful, not an error).
- `applyYouTubeToProfile()` merges into `youtube.*`.
- Logs to `external_call_log` (job: `google.youtube.data_api`, cost: $0 — free tier generous).

### 5. Website scrape enrichment

**`lib/lead-gen/enrich/website-scrape.ts`** — `scrapeWebsite(domain)`:

- Fetches homepage, discovers nav links via cheerio, follows about + pricing page links.
- `inferTeamSize(html)` — regex-based classification: numeric team count, solo language (freelance, sole trader, solopreneur), "our team" language, department/division language.
- `inferPricingTier(html)` — median price extraction from dollar amounts, premium/budget language detection.
- 8-second per-page timeout, 500KB body cap, `SuperBadBot` user-agent.
- `applyWebsiteScrapeToProfile()` merges into `website.has_about_page`, `has_pricing_page`, `team_size_signal`, `stated_pricing_tier`.
- Logs to `external_call_log` (job: `website.scrape`, cost: $0).

### 6. Google Maps extras enrichment

**`lib/lead-gen/enrich/maps-extras.ts`** — `fetchMapsExtras(placeId)`:

- Queries SerpAPI `google_maps_photos` engine using `place_id` from discovery step.
- `parseRelativeDate(dateStr)` converts SerpAPI's relative dates ("3 months ago", "March 2024") to ISO date strings. Timezone-safe (no `new Date()` for Month Year parsing).
- Finds most recent photo date across all results.
- `applyMapsExtrasToProfile()` merges into `maps.photo_count` + `maps.last_photo_date`, preserving discovery-seeded maps data.
- Logs to `external_call_log` (job: `serpapi.google_maps_photos`, cost: ~$0.005).

### 7. Enrichment orchestrator

**`lib/lead-gen/enrich/index.ts`** — `enrichCandidate(candidate)`:

- Runs all eligible signals in parallel via `Promise.allSettled`.
- Domain-dependent signals (PageSpeed, whois, Instagram, website scrape) are skipped for domainless candidates.
- Maps extras requires `place_id` in `raw_source_data` — skips internally when absent.
- Returns `EnrichmentResult` with: final `ViabilityProfile`, timing, attempted count, success count.
- Each signal merges independently — one failure never blocks another.

### 8. Barrel export

**`lib/lead-gen/index.ts`** updated with LG-3 exports: orchestrator, all six fetchers, and pure helper functions.

## Files created

- `lib/lead-gen/enrich/pagespeed.ts`
- `lib/lead-gen/enrich/whois.ts`
- `lib/lead-gen/enrich/instagram.ts`
- `lib/lead-gen/enrich/youtube.ts`
- `lib/lead-gen/enrich/website-scrape.ts`
- `lib/lead-gen/enrich/maps-extras.ts`
- `lib/lead-gen/enrich/index.ts`
- `tests/lead-gen/lg3-pagespeed.test.ts`
- `tests/lead-gen/lg3-whois.test.ts`
- `tests/lead-gen/lg3-instagram.test.ts`
- `tests/lead-gen/lg3-youtube.test.ts`
- `tests/lead-gen/lg3-website-scrape.test.ts`
- `tests/lead-gen/lg3-maps-extras.test.ts`
- `tests/lead-gen/lg3-enrichment-orchestrator.test.ts`

## Files edited

- `lib/lead-gen/index.ts` — LG-3 barrel exports added

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **RDAP over raw whois.** RDAP is the IETF-standard replacement, returns JSON, free, no library needed. Raw whois requires parsing arbitrary text formats per registrar.

2. **Instagram handle guess from domain.** Domain-based heuristic (strip TLD + non-IG chars) is best-effort. Override param exists for when we discover the real handle elsewhere. False-miss is safe — Instagram just returns no business_discovery data.

3. **YouTube search is name+domain, not domain-only.** Many businesses use brand names that don't match their domain. Name+domain gives YouTube's search algorithm more signal to surface the right channel.

4. **Website scrape uses plain fetch + cheerio, not headless browser.** Fast, cheap, no Puppeteer dependency in the enrichment hot path. Misses JavaScript-rendered content but that's acceptable for signal extraction — most about/pricing pages are SSR or static.

5. **Maps extras use `google_maps_photos` engine.** SerpAPI's dedicated photos endpoint gives richer metadata than the basic search results. Requires `place_id` from discovery, which Maps-sourced candidates always have but ad-library-sourced candidates don't.

6. **Timezone-safe date parsing in maps-extras.** `parseRelativeDate` avoids `new Date("Month Year")` for Month Year format to prevent UTC/AEST day-shift. Constructs ISO string directly from parsed month index + year.

## Verification (G0–G12)

- **G0** — LG-2 and LG-1 handoffs read. Spec §3.2, §5 read. BUILD_PLAN Wave 13 read.
- **G1** — Preconditions verified: `getCredential()`, `external_call_log` table, `meta-ads` vendor manifest, `serpapi` vendor manifest, `META_GRAPH_API_VERSION`, `SERPAPI_API_BASE`, cheerio — all present.
- **G2** — Files match LG-3 scope (six enrichment fetchers + orchestrator + tests).
- **G3** — No motion work.
- **G4** — No numeric/string literals in autonomy-sensitive paths. Timeout values and size caps are operational constants, not autonomy thresholds.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 183 test files / 1497 passed + 1 skipped (+60 new), clean production build.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1497 passed.
- **G9** — No browser-testable surface. Library-only session.
- **G10** — All six fetchers + orchestrator exercised by 60 unit tests covering happy path, error handling, profile merging, edge cases, and pure helper functions.
- **G10.5** — N/A (standard build session).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`lg_3_instagram_handle_discovery`** — `guessInstagramHandle()` is a heuristic. Future enhancement: when website scrape finds an Instagram link on the homepage, extract the real handle. Currently not wired.
- **`lg_3_youtube_search_relevance`** — YouTube search returns the "most relevant" channel but may return a similarly-named unrelated channel. A domain-verification step (checking channel description/links for the candidate's domain) would improve accuracy. Deferred.
- **`lg_3_website_scrape_js_rendered`** — JavaScript-rendered SPA sites return empty/minimal HTML. Could add Puppeteer fallback for high-value candidates. Deferred — the scrape signal is one of nine, graceful degradation is sufficient.
- **`lg_3_credential_keys_to_document`** — `google-pagespeed` and `google-youtube` credential vendor keys are used but no vendor manifest files exist yet in `lib/integrations/vendors/`. These will be created when their setup wizard steps are built.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Six enrichment fetcher modules + enrich directory
- Orchestrator
- Barrel export additions
- Seven test files

## What the next session (LG-4) inherits

LG-4 is **Scoring engine + candidate creation + daily cron skeleton** — the pure-function scoring rules and the daily search runner wrapper. LG-3 provides:

- **`enrichCandidate()` orchestrator** ready to enrich each discovered candidate (step 4 of §3.4).
- **Complete ViabilityProfile population.** All nine signal sources now have fetchers: three from discovery (LG-2) and six from enrichment (LG-3). The scoring engine receives fully populated profiles.
- **Pattern established** for all external API enrichment: `getCredential()` → fetch → log to `external_call_log` → graceful error return → apply to profile.
- **Pure helper functions** exported for direct use: `guessInstagramHandle`, `inferTeamSize`, `inferPricingTier`, `parseRelativeDate`.
