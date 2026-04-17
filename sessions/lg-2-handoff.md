# `LG-2` — Enrichment pipeline part 1 — Handoff

**Closed:** 2026-04-17
**Wave:** 13 — Lead Generation (2 of 10)
**Model tier:** Sonnet (native — brief self-written per G11.b mop-up rule, brief not pre-compiled by LG-1)

---

## What was built

- **`lib/lead-gen/types.ts`** — `ViabilityProfile`, `DiscoveryCandidate`, `DiscoverySearchInput`, `DiscoveryResult` interfaces. Matches spec §5 exactly.
- **`lib/lead-gen/sources/meta-ad-library.ts`** — `searchMetaAdLibrary(input, accessToken)`: calls `graph.facebook.com/v20.0/ads_archive`, returns `DiscoveryCandidate[]` with `meta_ads` profile populated. Logs to `external_call_log` (job: `meta_ads:search`). Graceful degradation on error.
- **`lib/lead-gen/sources/google-maps.ts`** — `searchGoogleMaps(input, apiKey)`: calls SerpAPI `google_maps` engine. Returns candidates with `maps` profile populated. Logs `serpapi:google_maps`. Graceful degradation.
- **`lib/lead-gen/sources/google-ads-transparency.ts`** — `searchGoogleAdsTransparency(input, apiKey)`: calls SerpAPI `google_ads_transparency_center`. Returns candidates with `google_ads` profile. Logs `serpapi:google_ads_transparency`. Graceful degradation.
- **`lib/lead-gen/sources/index.ts`** — barrel export for all three adapters.
- **`lib/lead-gen/index.ts`** — updated to re-export types + sources.
- **`tests/lead-gen/lg2-sources.test.ts`** — 27 tests: happy path, maxResults cap, graceful degradation (HTTP error, API error, network error, empty results), external_call_log logging, deduplication.

## Key decisions

- Adapters receive credentials as parameters (not via `getCredential()` directly) — keeps them pure and unit-testable. Orchestrator (LG-4) resolves credentials and passes them in.
- `DiscoverySearchInput` is the canonical input type shared across all adapters — orchestrator translates settings.get() values into this type once.
- `extractDomainFromSnapshotUrl` in meta-ad-library returns `null` — Meta Ad Library snapshot URLs don't directly expose the advertiser's domain. LG-3 or Hunter.io (LG-5) fills domain from page_id lookup or name matching.
- Country code derivation is a simple string match on location centre — intentionally simple for v1. LG-4 can refine if needed.
- `package-lock.json` modified by `npm install` at session start — expected artifact, not a functional change.

## Artefacts produced

- `lib/lead-gen/types.ts` (new)
- `lib/lead-gen/sources/meta-ad-library.ts` (new)
- `lib/lead-gen/sources/google-maps.ts` (new)
- `lib/lead-gen/sources/google-ads-transparency.ts` (new)
- `lib/lead-gen/sources/index.ts` (new)
- `lib/lead-gen/index.ts` (edited — +types + sources exports)
- `tests/lead-gen/lg2-sources.test.ts` (new — 27 tests)

## Verification

- G8: `npx tsc --noEmit` → 0 errors. `npm test` → 1421 passed, 1 skipped (172 test files). `npm run build` → clean. `npm run lint` → 0 errors.
- G10.5 (non-UI): fidelity grep — all acceptance-criterion keywords in diff, no whitelist violations, no MEMORY.md (doesn't exist). PASS.

## Rollback strategy

`git-revertable, no data shape change` — pure helper files, no migrations.

## PATCHES_OWED

- **`lg_2_meta_domain_resolution`** — `searchMetaAdLibrary` returns `domain: null` for all candidates because the Meta Ad Library API snapshot URL doesn't expose the advertiser domain directly. LG-5 (Hunter.io integration) should resolve domain from business name + location when domain is null.
- **`lg_1_brief_missing`** — LG-1 handoff did not write LG-2 brief per G11.b. Brief was self-written per mop-up rule at LG-2 session start. LG-2 handoff now writes LG-3 brief per G11.b rolling cadence.

## Memory-alignment declaration

No `MEMORY.md` exists in this project — no memory-alignment obligations apply.

## G10.5 verdict

Non-UI session — fidelity grep: PASS. All acceptance-criterion exports and behaviours present in diff. No out-of-whitelist files. No MEMORY.md violations.

## What LG-3 inherits

LG-3 builds the remaining 6 enrichment signals: PageSpeed, whois/domain-age, Instagram Business Discovery, YouTube Data API, website scrape (cheerio), and Google Maps photo count (already partially in LG-2's maps adapter — LG-3 should confirm photo_count + last_photo_date coverage). See LG-3 brief.
