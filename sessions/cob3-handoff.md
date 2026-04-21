# COB-3 Handoff — Cost & Usage Observatory: Vendor Wiring (Lead-Gen + Hiring)

**Date:** 2026-04-21
**Wave:** 21
**Status:** COMPLETE

## What was built

### 1. Migrated 10 lead-gen files to central `logExternalCall()`

Every direct `external_call_log` insert in `lib/lead-gen/` replaced with the observatory's `logExternalCall()` from `lib/observatory/log-external-call.ts`. Fire-and-forget via `.catch(() => {})`, matching the invoke.ts pattern from COB-1.

**Enrichment files (7):**
- `lib/lead-gen/contact-discovery.ts` — job `hunter.domain_search`
- `lib/lead-gen/enrich/maps-extras.ts` — job `serpapi.google_maps_photos`
- `lib/lead-gen/enrich/website-scrape.ts` — job `website.scrape`
- `lib/lead-gen/enrich/youtube.ts` — job `google.youtube.data_api`
- `lib/lead-gen/enrich/instagram.ts` — job `meta.instagram_business_discovery`
- `lib/lead-gen/enrich/whois.ts` — job `rdap.domain_lookup`
- `lib/lead-gen/enrich/pagespeed.ts` — job `google.pagespeed.run`

**Source files (3):**
- `lib/lead-gen/sources/google-maps.ts` — job `serpapi.google_maps`
- `lib/lead-gen/sources/google-ads-transparency.ts` — job `serpapi.google_ads_transparency`
- `lib/lead-gen/sources/meta-ad-library.ts` — job `meta.ad_library.search`

### 2. Migrated 2 hiring files to central `logExternalCall()`

- `lib/hiring/discovery/log.ts` — shared `logDiscoveryCall()` wrapper now delegates to `logExternalCall()` from observatory. All callers (agent.ts, behance-gallery.ts, vimeo-staff-picks.ts) unchanged.
- `lib/hiring/portfolio.ts` — local `logExternalCall()` rewritten as thin wrapper around `centralLogExternalCall()`. Removed double-logging of vision LLM calls (invoke.ts already logs these via COB-1 wiring).

`lib/hiring/cockpit.ts` — NOT migrated. Only reads from `external_call_log` (SELECT for health banner cost aggregation); no inserts.

### 3. Added 4 missing job entries to the registry

`lib/observatory/job-registry.ts` — added to NON_LLM_ENTRIES:
- `hiring-portfolio-ingest-behance` — vendor: other, free
- `hiring-portfolio-ingest-generic` — vendor: other, free
- `hiring-discovery-behance-gallery` — vendor: other, free
- `hiring-discovery-vimeo-rss` — vendor: other, free

`hiring-discovery-agent` NOT added — already in `lib/ai/models.ts` as a Sonnet job (LLM auto-derived in registry).

## Files edited

- `lib/observatory/job-registry.ts` — 4 new non-LLM entries
- `lib/lead-gen/contact-discovery.ts` — removed local logHunterCall, uses observatory
- `lib/lead-gen/enrich/maps-extras.ts` — removed local logCall, uses observatory
- `lib/lead-gen/enrich/website-scrape.ts` — removed local logCall, uses observatory
- `lib/lead-gen/enrich/youtube.ts` — removed local logCall, uses observatory
- `lib/lead-gen/enrich/instagram.ts` — removed local logCall, uses observatory
- `lib/lead-gen/enrich/whois.ts` — removed local logCall, uses observatory
- `lib/lead-gen/enrich/pagespeed.ts` — removed local logCall, uses observatory
- `lib/lead-gen/sources/google-maps.ts` — removed local logExternalCall, uses observatory
- `lib/lead-gen/sources/google-ads-transparency.ts` — removed local logExternalCall, uses observatory
- `lib/lead-gen/sources/meta-ad-library.ts` — removed local logExternalCall, uses observatory
- `lib/hiring/discovery/log.ts` — rewired to delegate to observatory
- `lib/hiring/portfolio.ts` — rewired to delegate to observatory, removed vision double-log

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run` — 274 files, 2775 passed, 1 skipped
- Zero direct `external_call_log` inserts remain in `lib/lead-gen/` or `lib/hiring/`

## Rollback

- All changes are backward-compatible — observatory helper has same effect as direct inserts
- No schema changes, no migrations, no settings keys modified
- Git-revertable

## Key decisions

- **Thin wrapper for complex files (portfolio.ts, discovery/log.ts)** instead of rewriting every call site. Same external behavior, less risk.
- **Removed vision double-log in portfolio.ts** — `invokeLlmVision` already logs via invoke.ts (COB-1 wiring). Explicit `logExternalCall` for vision was counting the same call twice.
- **Did not add `hiring-discovery-agent` to NON_LLM_ENTRIES** — it's already in models.ts as a Sonnet job. The SerpAPI portion of the discovery agent logs under the same job name, which means SerpAPI costs will appear under vendor "anthropic" in the registry. This is imprecise but harmless — the agent does both LLM classification and API searches. A future session could split into `hiring-discovery-agent` (LLM) and `hiring-discovery-agent-search` (SerpAPI) if per-vendor cost attribution matters.
- **`units` passed as objects, not JSON strings** — the local functions used `JSON.stringify()` before passing to Drizzle's `text({ mode: "json" })` column, which double-encoded. The central helper passes objects directly, letting Drizzle handle serialization correctly.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (CMS-6 or asset session)
- `sd11_deep_reader_link_target` — per-page config for "deeper piece" link (CMS-6 content)
- `sd11_rapid_scroller_per_page_summary` — per-page one-sentence summary (CMS-6 content)

## Remaining direct inserts outside COB-3 scope

These files still insert into `external_call_log` directly (not in lead-gen or hiring):
- `app/api/stripe/webhook/route.ts`
- `app/api/resend/webhook/route.ts`
- `lib/channels/email/send.ts`
- `lib/channels/sms/send.ts`
- `lib/six-week-plan/generate.ts`
- `lib/audit/enrichment.ts`
- `lib/eggs/melbourne-weather.ts`

These should be migrated in a follow-up COB pass or during their respective feature sessions.

## Next session should know

- **COB-4** builds the hard-threshold detector (spec §4.3). It reads from `external_call_log` + `cost_anomalies` + the job registry. All logging primitives are now wired — the detector can fire on real data.
- **Actor attribution** still defaults to `"internal"` for all lead-gen and hiring calls. Callers that serve subscribers or prospects should pass correct `actorType` and `actorId` — this is a wiring task for the respective feature sessions.
- **CMS-6** still required before COB-4+ (detectors + banners need dashboard content).
- **`hiring-discovery-agent` job name conflation** — the same name is used for both SerpAPI searches and Sonnet LLM classification. Cost attribution is imprecise but functional. Consider splitting if per-vendor breakdowns matter.
