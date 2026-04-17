# `LG-3` — Enrichment pipeline part 2 (6 remaining signal sources) — Session Brief

> **Pre-compiled by LG-2 closing session per AUTONOMY_PROTOCOL.md §G11.b rolling cadence.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references.

---

## 1. Identity

- **Session id:** `LG-3`
- **Wave:** `13 — Lead Generation` (3 of 10)
- **Type:** `FEATURE`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `medium`
- **G0.5 input budget estimate:** ~13k tokens (brief + excerpts + last 2 handoffs + skills). Well under 35k.

---

## 2. Spec excerpts

### Excerpt 1 — Enrichment signal set §3.2 (remaining 6 signals)

Source: `docs/specs/lead-generation.md` §3.2

```
Enrichment signal set — remaining 6 (LG-3 builds these):
- Website technical quality → Google PageSpeed Insights API → website.pagespeed_performance_score
- Domain age → whois lookup → website.domain_age_years
- Instagram presence + follower count + post cadence → Instagram Business Discovery API → instagram.*
- YouTube channel + subscriber count + upload cadence → YouTube Data API v3 → youtube.*
- Google Maps photo count + last photo date → SerpAPI → maps.photo_count + maps.last_photo_date
  (NOTE: maps.category, rating, review_count already set by LG-2 google-maps adapter when that
  source discovered the candidate — LG-3 enrichment may supplement with photo data for candidates
  discovered via meta_ad_library or google_ads_transparency sources that didn't go through google-maps)
- Website scrape (about page, team page, pricing page) → custom fetch + cheerio →
  website.has_about_page, website.has_pricing_page, website.team_size_signal, website.stated_pricing_tier

All optional — profile degrades gracefully when any source fails. On failure: return Partial<ViabilityProfile>
with the failed source's field omitted and record fetch_errors[<signal_name>] = <error message>.
```

### Excerpt 2 — ViabilityProfile remaining fields (§5)

Source: `docs/specs/lead-generation.md` §5

```typescript
interface ViabilityProfile {
  website?: {
    domain_age_years: number | null
    pagespeed_performance_score: number | null    // 0..100
    has_about_page: boolean
    has_pricing_page: boolean
    team_size_signal: 'solo' | 'small' | 'medium' | 'large' | 'unknown'
    stated_pricing_tier: 'unknown' | 'budget' | 'mid' | 'premium'
  }
  instagram?: {
    follower_count: number
    post_count: number
    posts_last_30d: number | null
  }
  youtube?: {
    subscriber_count: number
    video_count: number
    uploads_last_90d: number | null
  }
  maps?: {
    // category, rating, review_count set by LG-2 if discovered via google_maps source
    // LG-3 enrichment function supplements photo_count + last_photo_date for all candidates
    photo_count: number
    last_photo_date: string | null   // ISO
    category: string
    rating: number | null
    review_count: number
  }
  fetch_errors?: Record<string, string>
}
```

### Excerpt 3 — Enrichment function contract (§3.4 step 4)

Source: `docs/specs/lead-generation.md` §3.4

```
4. Enrich each survivor with the 9-signal set in parallel.
   Per-source failures logged; run continues with remaining sources.
   Each enrichment call is optional — profile degrades gracefully.
```

Expected function signature for each enricher (parallel with discovery adapter pattern from LG-2):

```typescript
// lib/lead-gen/enrichment/<source>.ts
export async function enrich<Source>(
  domain: string | null,
  businessName: string,
  apiKey: string,     // or no apiKey for public APIs like PageSpeed
): Promise<Partial<ViabilityProfile>>
// On any error: return {} and populate fetch_errors
```

**Audit footer:**
- `docs/specs/lead-generation.md` §3.2 — enrichment signal set
- `docs/specs/lead-generation.md` §5 — ViabilityProfile interface (full)

## 2a. Visual references

None — `FEATURE` type, no UI surface.

---

## 3. Acceptance criteria

```
LG-3 is done when:
1. lib/lead-gen/enrichment/pagespeed.ts exports enrichPageSpeed(domain, businessName):
   - Calls Google PageSpeed Insights API (https://www.googleapis.com/pagespeedonline/v5/runPagespeed)
   - Returns Partial<ViabilityProfile> with website.pagespeed_performance_score populated
   - Logs to external_call_log (job: "pagespeed:runPagespeed")
   - On error or null domain: returns {} gracefully

2. lib/lead-gen/enrichment/domain-age.ts exports enrichDomainAge(domain):
   - Queries a public WHOIS lookup API (e.g. https://www.whoisxmlapi.com or equivalent)
   - Returns Partial<ViabilityProfile> with website.domain_age_years populated
   - Logs to external_call_log (job: "whois:domain_lookup")
   - On error or null domain: returns {} gracefully

3. lib/lead-gen/enrichment/instagram.ts exports enrichInstagram(domain, businessName, apiKey):
   - Queries Instagram Basic Display API or Graph API Business Discovery endpoint
   - Returns Partial<ViabilityProfile> with instagram.* populated
   - Logs to external_call_log (job: "meta:instagram_business_discovery")
   - On error, missing credential, or no match: returns {} gracefully

4. lib/lead-gen/enrichment/youtube.ts exports enrichYouTube(businessName, apiKey):
   - Queries YouTube Data API v3 search endpoint
   - Returns Partial<ViabilityProfile> with youtube.* populated
   - Logs to external_call_log (job: "youtube:channel_search")
   - On error: returns {} gracefully

5. lib/lead-gen/enrichment/website-scrape.ts exports enrichWebsiteScrape(domain):
   - Fetches the target domain's root, /about, /team, /pricing pages
   - Uses cheerio to parse team size signals, pricing tier indicators
   - Returns Partial<ViabilityProfile> with website.has_about_page, has_pricing_page,
     team_size_signal, stated_pricing_tier populated
   - On error or null domain: returns {} gracefully
   - Does NOT log to external_call_log (free fetch, no cost tracking needed)

6. lib/lead-gen/enrichment/maps-photos.ts exports enrichMapsPhotos(businessName, location, apiKey):
   - Queries SerpAPI google_maps engine for a specific business to get photo_count + last_photo_date
   - Returns Partial<ViabilityProfile> with maps.photo_count + maps.last_photo_date populated
   - Merges into existing maps profile if present (does not overwrite category/rating/review_count)
   - Logs to external_call_log (job: "serpapi:maps_photos")
   - On error: returns {} gracefully

7. lib/lead-gen/enrichment/index.ts exports all six enrichers + a mergeProfiles() helper:
   - mergeProfiles(profiles: Partial<ViabilityProfile>[]): ViabilityProfile
   - Merges partial profiles left-to-right; later values win on conflict.
   - Aggregates all fetch_errors records.

8. lib/lead-gen/index.ts updated to re-export enrichment barrel.

9. tests/lead-gen/lg3-enrichment.test.ts passes:
   - Each enricher: happy path returns populated Partial<ViabilityProfile>
   - Each enricher: on error returns {} (no throw)
   - Each enricher: on null domain returns {} (where domain is required)
   - mergeProfiles: correctly merges two partials + aggregates fetch_errors

10. npx tsc --noEmit → 0 errors
11. npm test → green
12. npm run build → clean
13. npm run lint → clean
```

---

## 4. Skill whitelist

- `drizzle-orm` — external_call_log insertion pattern (same as LG-2)

---

## 5. File whitelist (G2 scope discipline)

- `lib/lead-gen/enrichment/pagespeed.ts` — new
- `lib/lead-gen/enrichment/domain-age.ts` — new
- `lib/lead-gen/enrichment/instagram.ts` — new
- `lib/lead-gen/enrichment/youtube.ts` — new
- `lib/lead-gen/enrichment/website-scrape.ts` — new
- `lib/lead-gen/enrichment/maps-photos.ts` — new
- `lib/lead-gen/enrichment/index.ts` — new — barrel + mergeProfiles
- `lib/lead-gen/index.ts` — edit — add enrichment exports
- `tests/lead-gen/lg3-enrichment.test.ts` — new

---

## 6. Settings keys touched

- **Reads:** none — enrichers receive apiKeys as parameters (same pattern as LG-2 adapters)
- **Seeds (new keys):** none

---

## 7. Preconditions (G1)

- [ ] `lib/lead-gen/types.ts` exists — verify: `ls lib/lead-gen/types.ts`
- [ ] `lib/lead-gen/sources/index.ts` exists — verify: `ls lib/lead-gen/sources/index.ts`
- [ ] `ViabilityProfile` exported from types — verify: `grep "export interface ViabilityProfile" lib/lead-gen/types.ts`
- [ ] `external_call_log` table defined — verify: `grep "external_call_log" lib/db/schema/external-call-log.ts`
- [ ] `SERPAPI_API_BASE` exported — verify: `grep "SERPAPI_API_BASE" lib/integrations/vendors/serpapi.ts`
- [ ] `getCredential` exported — verify: `grep "export async function getCredential" lib/integrations/getCredential.ts`
- [ ] `npx tsc --noEmit` passes before starting (carry-forward from LG-2)

---

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — pure helper files, no DB migrations. Rollback = `git revert`.

---

## 9. Definition of done

- [ ] All 6 enricher files exist under `lib/lead-gen/enrichment/`
- [ ] `mergeProfiles()` exported from `lib/lead-gen/enrichment/index.ts`
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10.5 fidelity grep: PASS
- [ ] Memory-alignment declaration in handoff
- [ ] G-gates G0–G12 complete

---

## 10. Notes for the next-session brief writer (LG-4)

LG-4 builds the orchestrator — the daily run cron handler that:
1. Calls `enforceWarmupCap()` to compute effective budget
2. Runs LG-2 adapters (meta_ad_library, google_maps, google_ads_transparency) in parallel
3. Deduplicates results against lead_candidates + deals + DNC
4. Runs LG-3 enrichers in parallel for each survivor
5. Calls scoring (LG-5 will provide `scoreForSaasTrack` + `scoreForRetainerTrack`)

LG-4 depends on LG-2 (source adapters), LG-3 (enrichment), and LG-5 (scoring). If LG-5 is not yet done, LG-4 can stub scoring as `() => ({ score: 0, breakdown: {}, qualifies: false })` and patch when LG-5 ships. The `lead_gen_daily_search` scheduled task type was seeded by LG-1 in schema.

cheerio is likely needed for website-scrape enricher — flag in LG-3 handoff if installed.
