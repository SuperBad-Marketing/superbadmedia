# `ce-9` — Ranking snapshot handler (weekly SerpAPI re-queries per published post) — Handoff

**Closed:** 2026-04-17
**Wave:** 12 — Content Engine (9 of 13)
**Model tier:** Sonnet (as recommended — medium handler session)

---

## What was built

The **`content_ranking_snapshot` scheduled-task handler**, **ranking snapshot pipeline**, **trend query helper**, and **bootstrap enqueue function** — completing CE-9 scope.

**Files created:**

- `lib/content-engine/ranking-snapshot.ts` — Core pipeline: `takeRankingSnapshots(companyId)` queries all published blog posts for a company (joined with `content_topics` for target keywords), fetches SerpAPI results per keyword, matches the post's published URL domain against SERP result domains, writes a `ranking_snapshots` row per post (position = null if not in top 100). Per-post try/catch: one SerpAPI failure logs and continues. `getPostRankingTrend(blogPostId)` derives entry/current/peak position + direction (up/down/stable/new/lost) from snapshot history. Both accept injectable `db` for testing.

- `lib/scheduled-tasks/handlers/content-ranking-snapshot.ts` — Handler: kill-switch gate on `content_automations_enabled` → payload validation → `takeRankingSnapshots()` → self-re-enqueue in 7 days. `ensureRankingSnapshotEnqueued(companyId)` bootstrap export for first-publish or onboarding wiring. `CONTENT_RANKING_SNAPSHOT_HANDLERS` registry block.

- `tests/content-engine/ce9-ranking-snapshot.test.ts` — 22 tests across 5 describe blocks: handler kill-switch exit, invalid payload, self-re-enqueue + 7-day delay verification; payload schema validation (3); library pipeline (SerpAPI credential missing, no published posts, domain found in SERP, domain not found, null publishedUrl, error continuation, activity logging); trend queries (no snapshots, single snapshot "new", improving "up", worsening "down", lost, stable); bootstrap enqueue (correct task type + weekly delay, default nowMs).

**Files edited:**

- `lib/db/schema/activity-log.ts` — Added `content_ranking_snapshot_taken` to `ACTIVITY_LOG_KINDS` (Content Engine block, after `content_seed_keyword_removed`).
- `lib/scheduled-tasks/handlers/index.ts` — Added `CONTENT_RANKING_SNAPSHOT_HANDLERS` import + spread into `HANDLER_REGISTRY`.
- `lib/content-engine/index.ts` — Added CE-9 barrel exports: `takeRankingSnapshots`, `getPostRankingTrend`, `RankingSnapshotResult`, `PostRankingTrend`, `ensureRankingSnapshotEnqueued`.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Domain matching, not URL matching.** SerpAPI organic results may return slightly different URL paths than the published URL (trailing slashes, www prefix, etc.). Matching by domain is more robust. Subdomain matching included (`.endsWith` check) for sites using subdomains.

2. **Null position for "not found in top 100".** Per spec §11.1: `position` is nullable integer — null means the post wasn't found in the SerpAPI results (top 10 organic). Consistent with SerpAPI's default `num=10` result set.

3. **Trend direction derived from two most recent snapshots.** Not a rolling average — simple comparison. `new` = first snapshot or re-appeared after being null. `lost` = was ranked, now null. `stable` = same position. `up`/`down` = moved.

4. **Weekly self-perpetuation, not configurable cadence.** 7-day interval is hardcoded. Spec §7.1 says "weekly" without configurable option. Could be promoted to a settings key if tuning needed.

5. **No GSC integration in this session.** Spec §7.2 defines GSC as optional OAuth integration — separate session. This handler writes `source: 'serpapi'` only. GSC data (impressions, clicks, ctr) columns stay null.

## Verification (G0–G12)

- **G0** — CE-8 and CE-7 handoffs read. Spec `content-engine.md` §7.1, §2.2, §11.1 read. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `ranking_snapshots` table, `content_ranking_snapshot` task_type, `fetchSerpResults()` in CE-2, `content_automations_enabled` kill switch, `blog_posts.published_url`, `content_topics.keyword`, handler registry pattern, `enqueueTask()` helper — all present.
- **G2** — Files match CE-9 scope (ranking snapshot library + handler + tests + barrel + activity kind).
- **G3** — No motion work. Handler/library session.
- **G4** — No numeric/string literals in autonomy-sensitive paths. `WEEK_MS` is a pacing constant, not an autonomy threshold.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 162 test files / 1301 passed + 1 skipped (+22 new), clean production build, lint 0 errors (65 warnings, 0 from CE-9 files).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1301 passed. `npm run build` → success. `npm run lint` → 0 errors.
- **G9** — No UI surfaces. Handler/library session.
- **G10** — Pipeline behaviours exercised by 22 unit tests. Trend computation, error recovery, domain matching all covered.
- **G10.5** — N/A (handler/library session, no external UI).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_9_gsc_integration`** — Spec §7.2: GSC OAuth integration to supplement SerpAPI re-queries with impression/click/CTR data. Separate session. `ranking_snapshots` columns for `impressions`, `clicks`, `ctr` already exist from CE-1.
- **`ce_9_ranking_trend_research_boost`** — Spec §7.1: "The engine uses ranking trends to refine future keyword selection — keywords in verticals where previous posts ranked well get a research boost; keywords where posts failed to rank within 8 weeks are deprioritised." Not implemented in CE-9 (ranking data capture only). Needs a research-side consumer that reads trend data.
- **`ce_9_week_interval_to_settings`** — 7-day re-enqueue interval is hardcoded. Could be promoted to a settings key (`content.ranking_snapshot_interval_days`) if tuning needed.
- **`ce_9_bootstrap_wiring`** — `ensureRankingSnapshotEnqueued()` is exported but not wired into any caller yet. Should be called on first blog post publish or Content Engine onboarding wizard completion.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Ranking snapshot library + trend helper
- Handler + registry entry
- Activity log kind
- Barrel exports
- Test file

## What the next session (CE-10) inherits

CE-10 should cover the **Metrics tab** at `/lite/content/metrics` or the **Topics tab** at `/lite/content/topics` (both are admin surfaces defined in spec §8.1). CE-10 inherits:

- **Full content pipeline through to ranking snapshots** — CE-1→CE-9 complete.
- **`getPostRankingTrend(blogPostId)`** for displaying ranking trends on the Metrics tab.
- **`takeRankingSnapshots()`** pipeline running weekly once bootstrapped.
- **`ContentTabs` shared component** from CE-8 (add new active tabs as surfaces land).
- **Ranking data in `ranking_snapshots` table** (populated by handler, queryable for metrics).
