# `ce-10` — Metrics tab + Topics tab admin surfaces — Handoff

**Closed:** 2026-04-17
**Wave:** 12 — Content Engine (10 of 13)
**Model tier:** Sonnet (as recommended — medium UI session)

---

## What was built

The **Metrics tab** at `/lite/content/metrics` and **Topics tab** at `/lite/content/topics` — two admin surfaces consuming existing data from CE-1→CE-9. Plus **seed keyword management** helpers and **server actions** for veto + keyword add/remove.

**Files created:**

- `lib/content-engine/metrics.ts` — `getContentMetrics(companyId)`: aggregates post counts by status, ranking trends (via `getPostRankingTrend` for top 20 published posts), newsletter send stats (recent 10 sends + totals), subscriber counts by status, social draft counts by status. Accepts `null` companyId for admin-wide view. Injectable `db` for testing.

- `lib/content-engine/seed-keywords.ts` — `getSeedKeywords(companyId)`, `addSeedKeyword(companyId, keyword)`, `removeSeedKeyword(companyId, keyword)`. Case-insensitive normalisation (lowercase + trim). Activity logging on add/remove. Injectable `db` for testing.

- `app/lite/content/metrics/page.tsx` — Server component. Summary stat cards (Published, In Review, Subscribers, Social Published). Newsletter section (sends/opens/clicks table). Subscriber list health breakdown (5 status categories). Ranking trends table (keyword, entry/current/peak positions, direction indicator).

- `app/lite/content/topics/page.tsx` — Server component. Seed keyword manager (add/remove with tag badges). Topic queue list (expandable outlines, veto buttons).

- `app/lite/content/_components/ranking-trend-row.tsx` — Table row with direction indicator (↑ Up / ↓ Down / — Stable / ★ New / ✕ Lost) colour-coded.

- `app/lite/content/_components/topic-queue-list.tsx` — Client component. Expandable topic cards showing keyword, rankability score, word count, snippet opportunity badge, outline sections with key points, content gaps. Veto button with optimistic removal.

- `app/lite/content/_components/seed-keyword-manager.tsx` — Client component. Input + Add button, keyword tag badges with × remove. Enter-key support. Error display for duplicates.

- `tests/content-engine/ce10-metrics-topics.test.ts` — 11 tests across 3 describe blocks: getSeedKeywords (3), addSeedKeyword (4), removeSeedKeyword (4). Covers no-config, duplicates, case-insensitive normalisation, activity logging.

**Files edited:**

- `app/lite/content/_components/content-tabs.tsx` — Activated Metrics and Topics tabs with proper hrefs.
- `app/lite/content/actions.ts` — Added 3 new server actions: `vetoTopicAction`, `addSeedKeywordAction`, `removeSeedKeywordAction` (all admin-role-gated, Zod-validated).
- `lib/content-engine/index.ts` — Added CE-10 barrel exports: `getSeedKeywords`, `addSeedKeyword`, `removeSeedKeyword`, `getContentMetrics`, `ContentMetrics`.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Admin-wide metrics (null companyId).** The Metrics tab shows data across all companies since this is the admin view. Per-company filtering will arrive with the subscriber fleet overview (CE-11).

2. **Top 20 published posts for ranking trends.** Capped to keep the page performant. Each post makes a separate query for its snapshot history.

3. **Seed keywords normalised on write, not display.** Stored lowercase and trimmed. Case-insensitive duplicate detection prevents "SEO" and "seo" coexisting.

4. **Optimistic veto removal.** Topic disappears from list immediately on click; server action runs in background. No undo — per spec, veto is a one-click removal.

5. **StatCard as a local component, not a shared primitive.** Simple enough that extracting to `components/lite/` would be premature. Can be promoted if other admin surfaces need the same pattern.

## Verification (G0–G12)

- **G0** — CE-9 and CE-8 handoffs read. Spec `content-engine.md` §8.1, §2.1 Stage 2 read. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `listQueuedTopics()`, `vetoTopic()`, `getPostRankingTrend()`, `ContentTabs`, `content_engine_config.seed_keywords`, `newsletter_sends`/`newsletter_subscribers`/`social_drafts`/`blog_posts` tables, `content_seed_keyword_added`/`content_seed_keyword_removed` activity_log kinds — all present.
- **G2** — Files match CE-10 scope (two admin tabs + seed keyword helpers + server actions + tests).
- **G3** — No motion work. UI surface session.
- **G4** — No numeric/string literals in autonomy-sensitive paths.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 163 test files / 1312 passed + 1 skipped (+11 new), clean production build, lint 0 errors (65 warnings, 0 from CE-10 files).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1312 passed. `npm run build` → success. `npm run lint` → 0 errors.
- **G9** — No browser-testable state yet (no real data in dev db). UI structure verified via build.
- **G10** — Seed keyword behaviours exercised by 11 unit tests.
- **G10.5** — N/A (admin UI surface, standard build).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_10_metrics_recharts_upgrade`** — Metrics tab currently uses plain stat cards and tables. Future enhancement: Recharts line charts for ranking trend history and subscriber growth over time.
- **`ce_10_social_engagement_manual_tracking`** — Spec §8.1 mentions "social engagement (manual tracking in v1)". No data entry for engagement metrics implemented. Would need a simple form on the Social tab to record platform-reported engagement.
- **`ce_10_company_filter_on_topics`** — Topics page uses `contentEngineConfig.limit(1)` to find the first company. Needs a company selector when subscriber fleet overview ships.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Metrics page + ranking trend row component
- Topics page + topic queue list + seed keyword manager components
- Seed keyword library + metrics library + barrel exports
- Server actions (veto, add/remove keyword)
- Test file
- ContentTabs activation (would revert to disabled Metrics/Topics)

## What the next session (CE-11) inherits

CE-11 should cover the **List tab** at `/lite/content/list` (subscriber list management — import, embed code, health panel, CSV export) or the **subscriber fleet overview** at `/lite/content/subscribers` (summary cards, engine health per subscriber). CE-11 inherits:

- **Full content pipeline through to admin surfaces** — CE-1→CE-10 complete.
- **`ContentTabs` shared component** with Review, Social, Metrics, Topics active; List still disabled.
- **`getContentMetrics()` pattern** for admin-wide aggregation queries.
- **`SeedKeywordManager` component pattern** for interactive client-side state with server action persistence.
