# HP-6 Handoff — Hiring Pipeline: Discovery Agent + IG Ingestion + Discovery Source Adapters

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### DiscoverySource interface — `lib/hiring/discovery/types.ts`

Typed adapter contract for platform-specific discovery sources. Interface: `DiscoverySource { name: string, fetch(brief: RoleBriefRow): Promise<DiscoverySourceResult> }`. Result: `{ urls: string[], cost_aud: number }`. Also defines `DiscoveryCandidate` and `DiscoveryRunResult` types for the full pipeline.

### Vimeo Staff Picks RSS source — `lib/hiring/discovery/sources/vimeo-staff-picks.ts`

Fetches the Vimeo Staff Picks RSS feed, parses items, cross-references each item's title + description against the Role Brief's `extracted_tags`. Only matching items are returned. Gated by `hiring.discovery.vimeo_enabled`. Cost: $0 (public RSS).

### Behance Gallery source — `lib/hiring/discovery/sources/behance-gallery.ts`

Fetches the Behance galleries page, extracts `<a>` links matching `/gallery/` paths, cross-references text against Brief tags. Gated by `hiring.discovery.behance_enabled`. Cost: $0 (public HTML).

### Instagram Apify adapter — `lib/hiring/portfolio.ts`

New `fetchInstagramSignal()` handler wired into `ingestPortfolioUrl()` routing for `instagram` platform. Calls Apify's Instagram Profile Scraper (run-sync-get-dataset-items endpoint) to fetch up to 12 recent posts + bio + profile name. Extracts thumbnails, work samples, and bio from the Apify response. Confidence: 0.65 with thumbnails, 0.4 without. Graceful fallback chain:
1. Kill switch off → confidence 0.2
2. No `APIFY_API_TOKEN` → confidence 0.2
3. No handle extractable from URL → confidence 0.3
4. Apify call fails → falls back to generic OG scraper
5. Apify returns empty → falls back to generic OG scraper
6. Apify success → enriched signal with thumbnails + bio

Gated by `hiring.discovery.ig_on_demand_enabled`. External call logged as `hiring-portfolio-ingest-ig` (~$0.02/call).

### Discovery agent coordinator — `lib/hiring/discovery/agent.ts`

`runDiscoveryForBrief(brief)` — orchestrates the full §5.2 dual-path discovery:

**Path A (platform feeds):** iterates all registered `DISCOVERY_SOURCES` (Vimeo RSS, Behance Gallery), collects matching URLs.

**Path B (LLM+search agent):** if `hiring.discovery.llm_agent_enabled`:
1. LLM generates 5-10 search queries from Brief context via `hiring-discovery-agent` (Sonnet)
2. Each query sent to SerpAPI (Google engine, 10 results per query)
3. All result URLs fed to a second LLM call that filters for individual portfolio pages (not company sites, directories, or articles)
4. Filtered URLs merged with Path A URLs

**Shared pipeline (both paths):**
- Deduplication against existing candidates in the pipeline (by URL)
- Each URL processed through `ingestPortfolioUrl()` → `scoreCandidateAgainstBriefs()`
- Top N candidates (per `hiring.discovery.llm_candidates_per_run`, default 5) persisted as `Sourced` with activity log
- Brief's `last_discovery_run_at_ms` updated

Cost tracking: every LLM call, SerpAPI call, and portfolio ingestion contributes to `total_cost_aud`. If `hiring.discovery.llm_max_cost_aud_per_run` is exceeded mid-run, processing halts and `cost_cap_hit` is flagged.

`runDiscoveryForAllOpenBriefs()` — iterates open briefs, respects `hiring.discovery.llm_run_cadence` (off = skip).

### Discovery agent prompt — `lib/ai/prompts/hiring/discovery-agent.ts`

Two prompt builders:
- `buildDiscoverySearchQueriesPrompt()` — generates targeted web search queries from Brief context (role name, style tags, location, rate, previous search hints)
- `buildDiscoveryResultsFilterPrompt()` — filters search result URLs to individual portfolio pages only

### Shared logging — `lib/hiring/discovery/log.ts`

`logDiscoveryCall()` — best-effort external_call_log insertion, reusable by all discovery modules.

### Scheduled task type + handler

- Added `hiring_discovery_run` to `SCHEDULED_TASK_TYPES` enum
- Handler at `lib/scheduled-tasks/handlers/hiring-discovery.ts`: gates on `hiring_discovery_enabled` kill switch, calls `runDiscoveryForAllOpenBriefs()`, then self-perpetuates by enqueuing the next run at the configured cadence interval (weekly/fortnightly/monthly)
- `ensureHiringDiscoveryEnqueued()` — bootstrap function for first-run enqueue (called from wizard completion or admin "Run now")
- Registered in `HANDLER_REGISTRY`

### Kill switch — `hiring_discovery_enabled`

Added to `KillSwitchKey` union + defaults map. Default: `false`. Gates the entire discovery pipeline (weekly LLM agent, feed sources, scheduled handler).

### Server action — `runDiscoveryNowAction()`

Admin-only action for manual discovery trigger. Accepts optional `roleBriefId` (single brief) or runs all open briefs. Uses dynamic import to avoid circular dependency. Returns `briefsProcessed`, `candidatesFound`, `totalCost`, `costCapHit`.

## New files

- `lib/hiring/discovery/types.ts`
- `lib/hiring/discovery/agent.ts`
- `lib/hiring/discovery/log.ts`
- `lib/hiring/discovery/index.ts`
- `lib/hiring/discovery/sources/index.ts`
- `lib/hiring/discovery/sources/vimeo-staff-picks.ts`
- `lib/hiring/discovery/sources/behance-gallery.ts`
- `lib/ai/prompts/hiring/discovery-agent.ts`
- `lib/scheduled-tasks/handlers/hiring-discovery.ts`
- `tests/hp6-discovery-agent.test.ts` (24 tests)

## Edited files

- `lib/hiring/portfolio.ts` — added `fetchInstagramSignal()` + IG routing in `ingestPortfolioUrl()`
- `lib/hiring/index.ts` — barrel export for discovery module
- `lib/db/schema/scheduled-tasks.ts` — added `hiring_discovery_run` task type
- `lib/kill-switches.ts` — added `hiring_discovery_enabled`
- `lib/scheduled-tasks/handlers/index.ts` — registered `HIRING_DISCOVERY_HANDLERS`
- `app/lite/admin/hiring/actions.ts` — added `runDiscoveryNowAction()`

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 241 files, 2220 passed, 1 skipped (pre-existing)
- Browser check: not applicable (external APIs require live keys; validated via typecheck + 24 new tests)

## Key decisions

- **SerpAPI as search provider** — the spec says "SerpAPI or equivalent". SerpAPI is the most well-documented option for Google search results API. If a different provider is preferred, the `searchWeb()` function in agent.ts is the single swap point.
- **Apify run-sync endpoint** — uses the synchronous run endpoint (`run-sync-get-dataset-items`) which blocks until results are ready (up to 60s timeout). Simpler than async + polling but may hit Apify's 60s sync limit for slow scrapes. The graceful fallback to OG scraping means this is non-fatal.
- **Tag matching for RSS/feeds is substring** — Vimeo and Behance sources check if any Brief tag appears as a substring in the item title/description. Simple and effective for v1; could be LLM-scored in future for better precision.
- **Cost tracking is approximate** — SerpAPI charges per search (~$0.005), LLM costs estimated from token assumptions. Exact costs depend on response sizes. The cost cap is a safety net, not precision accounting.
- **No SerpAPI key validation at startup** — if `SERPAPI_API_KEY` is missing, searches silently return empty results. Discovery still runs Path A sources. This matches the graceful-fallback philosophy.

## Rollback

- Git-revertable: all new files are additive. Edits to existing files are additive (new handler in kill-switches, new task type in enum, new routing case in portfolio.ts, new barrel export). No existing function signatures changed.

## Settings keys consumed

- `hiring.discovery.vimeo_enabled` — kill switch for Vimeo RSS source
- `hiring.discovery.behance_enabled` — kill switch for Behance Gallery source
- `hiring.discovery.ig_on_demand_enabled` — kill switch for Apify IG adapter
- `hiring.discovery.llm_agent_enabled` — master kill switch for Path B agent
- `hiring.discovery.llm_max_cost_aud_per_run` — cost cap per brief per run
- `hiring.discovery.llm_candidates_per_run` — top-N candidates to persist
- `hiring.discovery.llm_run_cadence` — weekly/fortnightly/monthly/off

## Next session should know

- HP-7+ can add more `DiscoverySource` implementations (e.g. Dribbble, Are.na) by creating a file in `sources/` and adding it to the `DISCOVERY_SOURCES` array.
- The apply-form "recommend someone" referral path (§5.1 path 4) is not yet wired — a future HP session should route those into Sourced via the same `createCandidate()` call.
- The auto-invite gate (§5.2: auto-draft invites when discovery candidates score ≥ `hiring.discovery.auto_invite_score_threshold`) is not wired in this session. The discovery agent persists candidates as Sourced but does not auto-draft invites. That gate belongs to the invite send pipeline (HP-7 or later).
- Discovery search quality will improve as Role Briefs accumulate `discovery_search_hints_json` and `style_avoid_list_json` from archive reflections.
- `ensureHiringDiscoveryEnqueued()` should be called from the Role Brief wizard completion step (HP-2 already built the wizard but may need a post-wizard trigger).
