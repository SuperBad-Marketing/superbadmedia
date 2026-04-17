# `LG-2` — Enrichment pipeline part 1 (three primary discovery sources) — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0 + §G0.5.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references.

---

## 1. Identity

- **Session id:** `LG-2`
- **Wave:** `13 — Lead Generation` (2 of 10)
- **Type:** `FEATURE`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `medium`
- **G0.5 input budget estimate:** ~12k tokens (brief + excerpts + last 2 handoffs + skills). Well under 35k.

---

## 2. Spec excerpts

### Excerpt 1 — ViabilityProfile shape (§5)

Source: `docs/specs/lead-generation.md` §5

```
interface ViabilityProfile {
  meta_ads?: {
    active_ad_count: number
    estimated_spend_bracket: 'unknown' | 'low' | 'medium' | 'high'
    has_active_creatives: boolean
  }
  google_ads?: {
    active_creative_count: number
    has_active_campaigns: boolean
  }
  website?: {
    domain_age_years: number | null
    pagespeed_performance_score: number | null       // 0..100
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
    category: string
    rating: number | null
    review_count: number
    photo_count: number
    last_photo_date: string | null   // ISO
  }
  fetch_errors?: Record<string, string>     // keyed by signal name
}
```

### Excerpt 2 — Source list + enrichment signals (§3.1 + §3.2)

Source: `docs/specs/lead-generation.md` §3.1–§3.2

```
Source list (v1):
- Meta Ad Library API: Primary discovery for ad-running businesses. Free, public, high rate limits.
  Filters: location, active-ad status, ad count, estimated spend bracket where exposed.
- Google Maps (via SerpAPI `google_maps` engine): Primary discovery for location-based businesses.
  Query shape: category + location from Settings standing brief.
- Google Ads Transparency Center (via SerpAPI): Discovery for Google-advertising businesses.
  Catches the "runs Google ads but not Meta" segment.

Enrichment signal set:
- Active ads + estimated spend bracket → Meta Ad Library API → meta_ads portion of ViabilityProfile
- Google Ads activity + creative count → Google Ads Transparency Center (via SerpAPI) → google_ads portion
- Google Maps reviews + rating + category → SerpAPI → maps portion
- Google Maps photo count + last photo date → SerpAPI → maps portion

Each adapter serves double duty: discovery (returns candidates) AND populates its
portion of ViabilityProfile from the same API call.

Profile degrades gracefully when any source fails or returns nothing (per Q3 lock).
Per-source failures are logged to lead_runs.error; run continues with remaining sources.
fetch_errors field on ViabilityProfile records per-source fetch failures for auditability.
```

### Excerpt 3 — Discovery run context (§3.4 steps 2–4)

Source: `docs/specs/lead-generation.md` §3.4

```
2. Query all sources in parallel for the standing brief (or manual brief if override).
   Per-source failures logged to lead_runs.error; run continues with remaining sources.

3. Deduplicate against:
   - lead_candidates.email_or_domain within dedup window
   - deals (any existing deal for the same company/domain)
   - dnc_emails, dnc_domains, companies.do_not_contact (via isBlockedFromOutreach)

4. Enrich each survivor with the 9-signal set in parallel.
   (LG-2 builds 3 of the 9 — the three primary sources. LG-3 builds the remaining 6.)
```

### Excerpt 4 — Build discipline (§12.A)

Source: `docs/specs/lead-generation.md` §12

```
§12.A: enforceWarmupCap() and isBlockedFromOutreach() are the ONLY two functions
that gate Lead Gen writes. No other code path adds candidates or sends outbound
email without calling both.

LG-2 builds source adapters only — no DB writes, no candidate creation.
The orchestrator (LG-4) will call these adapters and apply the gates.
```

**Audit footer:**
- `docs/specs/lead-generation.md` §3.1–3.2 — source list + enrichment signal mapping
- `docs/specs/lead-generation.md` §5 — ViabilityProfile interface
- `docs/specs/lead-generation.md` §3.4 — daily run sequence (adapters slot into step 2+4)

## 2a. Visual references

None — `FEATURE` type, no UI surface.

---

## 3. Acceptance criteria

```
LG-2 is done when:
1. lib/lead-gen/types.ts exports ViabilityProfile (matches spec §5 exactly),
   DiscoveryCandidate, DiscoverySearchInput, and DiscoveryResult types.
2. lib/lead-gen/sources/meta-ad-library.ts exports searchMetaAdLibrary(input, token):
   - Calls Meta Ad Library API (graph.facebook.com/v20.0/ads_archive)
   - Returns DiscoveryCandidate[] with meta_ads portion of ViabilityProfile populated
   - Logs to external_call_log (job: "meta_ads:search")
   - On error: returns [] and records fetch_error key "meta_ads"
3. lib/lead-gen/sources/google-maps.ts exports searchGoogleMaps(input, apiKey):
   - Calls SerpAPI google_maps engine
   - Returns DiscoveryCandidate[] with maps portion of ViabilityProfile populated
   - Logs to external_call_log (job: "serpapi:google_maps")
   - On error: returns [] and records fetch_error key "maps"
4. lib/lead-gen/sources/google-ads-transparency.ts exports searchGoogleAdsTransparency(input, apiKey):
   - Calls SerpAPI google_ads_transparency_center engine
   - Returns DiscoveryCandidate[] with google_ads portion of ViabilityProfile populated
   - Logs to external_call_log (job: "serpapi:google_ads_transparency")
   - On error: returns [] and records fetch_error key "google_ads"
5. lib/lead-gen/sources/index.ts exports all three adapters.
6. lib/lead-gen/index.ts updated to re-export types + sources barrel.
7. tests/lead-gen/lg2-sources.test.ts passes:
   - ViabilityProfile type completeness (structural check)
   - Each adapter: mock-fetch happy path returns populated DiscoveryCandidate[]
   - Each adapter: on fetch error returns [] (graceful degradation, no throw)
   - Each adapter: on empty API response returns []
8. npx tsc --noEmit → 0 errors
9. npm test → green
10. npm run build → clean
11. npm run lint → clean
```

---

## 4. Skill whitelist

- `drizzle-orm` — external_call_log insertion pattern

---

## 5. File whitelist (G2 scope discipline)

- `lib/lead-gen/types.ts` — new — ViabilityProfile + discovery types
- `lib/lead-gen/sources/meta-ad-library.ts` — new — Meta Ad Library adapter
- `lib/lead-gen/sources/google-maps.ts` — new — Google Maps SerpAPI adapter
- `lib/lead-gen/sources/google-ads-transparency.ts` — new — Google Ads Transparency adapter
- `lib/lead-gen/sources/index.ts` — new — barrel export
- `lib/lead-gen/index.ts` — edit — add types + sources to barrel
- `tests/lead-gen/lg2-sources.test.ts` — new — unit tests

---

## 6. Settings keys touched

- **Reads:** `lead_generation.location_centre`, `lead_generation.location_radius_km`, `lead_generation.category` (conceptually — adapters receive these as input params, not direct settings.get calls)
- **Seeds (new keys):** none — no new settings keys in this session

---

## 7. Preconditions (G1)

- [ ] `lib/lead-gen/dnc.ts` exists — verify: `ls lib/lead-gen/dnc.ts`
- [ ] `lib/lead-gen/sender.ts` exists — verify: `ls lib/lead-gen/sender.ts`
- [ ] `lead_candidates` table defined — verify: `grep "lead_candidates" lib/db/schema/lead-candidates.ts`
- [ ] `external_call_log` table defined — verify: `grep "external_call_log" lib/db/schema/external-call-log.ts`
- [ ] `lead_gen_enabled` in kill-switches — verify: `grep "lead_gen_enabled" lib/kill-switches.ts`
- [ ] `SERPAPI_API_BASE` exported from serpapi vendor — verify: `grep "SERPAPI_API_BASE" lib/integrations/vendors/serpapi.ts`
- [ ] `META_GRAPH_API_VERSION` exported from meta-ads vendor — verify: `grep "META_GRAPH_API_VERSION" lib/integrations/vendors/meta-ads.ts`
- [ ] `getCredential` exported from getCredential module — verify: `grep "export async function getCredential" lib/integrations/getCredential.ts`

---

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — pure helper/adapter files; no DB migrations; no schema changes. Rollback = `git revert`.

---

## 9. Definition of done

- [ ] `lib/lead-gen/types.ts` exists with `ViabilityProfile`, `DiscoveryCandidate`, `DiscoverySearchInput`, `DiscoveryResult`
- [ ] `lib/lead-gen/sources/meta-ad-library.ts` exists with `searchMetaAdLibrary` exported
- [ ] `lib/lead-gen/sources/google-maps.ts` exists with `searchGoogleMaps` exported
- [ ] `lib/lead-gen/sources/google-ads-transparency.ts` exists with `searchGoogleAdsTransparency` exported
- [ ] `lib/lead-gen/sources/index.ts` exists exporting all three
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10.5 fidelity grep: acceptance-criterion keywords present, no whitelist violations, no memory-alignment violations → PASS
- [ ] Memory-alignment declaration in handoff
- [ ] G-gates G0–G12 run end-to-end

---

## 10. Notes for the next-session brief writer (LG-3)

LG-3 will build the remaining 6 enrichment signals:
- PageSpeed Insights (website.pagespeed_performance_score)
- whois/domain-age (website.domain_age_years)
- Instagram Business Discovery (instagram.*)
- YouTube Data API (youtube.*)
- Website scrape via fetch+cheerio (website.has_about_page, team_size_signal, stated_pricing_tier)
- Google Maps photo count (already partially covered by LG-2's maps adapter, but photo_count and last_photo_date come from a different SerpAPI call)

LG-2 exports: `ViabilityProfile`, `DiscoveryCandidate`, `DiscoverySearchInput`, `DiscoveryResult` from `lib/lead-gen/types.ts`; and `searchMetaAdLibrary`, `searchGoogleMaps`, `searchGoogleAdsTransparency` from `lib/lead-gen/sources/`.

LG-3's adapters should follow the same `(input: DiscoverySearchInput, apiKey: string) → Promise<DiscoveryCandidate[]>` signature pattern with graceful degradation (empty array on error, fetch_errors populated) and external_call_log entries.

LG-4 will build the orchestrator (daily run cron + dedup + scoring pipeline call), depending on LG-2 + LG-3 + scoring (LG-5).
