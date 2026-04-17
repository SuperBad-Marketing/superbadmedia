# `ce-8` — Social tab admin surface (publish + download + carousel preview) — Handoff

**Closed:** 2026-04-17
**Wave:** 12 — Content Engine (8 of 13)
**Model tier:** Sonnet (as recommended — medium UI session)

---

## What was built

The **Social tab** in the Content Engine admin surface at `/lite/content/social`, the **`markSocialDraftPublished()` library primitive**, a **shared tab navigation component**, and **server actions** for social draft publishing — completing CE-8 scope.

**Files created:**

- `lib/content-engine/social-publish.ts` — `markSocialDraftPublished(draftId)`: state transition `ready` → `published` with `published_at_ms` timestamp + `content_social_published` activity log. Three guard states: `not_found`, `already_published`, `not_ready` (still generating).

- `app/lite/content/social/page.tsx` — Server component for the Social tab. Queries all social drafts joined with their parent blog posts, groups by post (newest first), renders via `SocialDraftList` client component.

- `app/lite/content/_components/content-tabs.tsx` — Shared tab navigation server component. Active tabs (Review, Social) render as Links; inactive tabs (Metrics, Topics, List) stay as disabled spans. Replaces the inline tab bar from CE-3.

- `app/lite/content/_components/social-draft-list.tsx` — Client component. Per-draft cards with: platform badge (colour-coded), status badge (Generating/Ready/Published), text preview (4-line clamp), visual asset thumbnail (single image or horizontally-scrolling carousel preview), Publish button (copies text to clipboard + opens platform compose URL in new tab + marks published via server action), Download link for visual assets.

- `tests/content-engine/ce8-social-publish.test.ts` — 6 tests: not_found, already_published, not_ready guard, successful publish + activity log, publish without post (graceful), platform-specific activity metadata.

**Files edited:**

- `app/lite/content/page.tsx` — Replaced inline tab bar with `<ContentTabs>` component. Added import.
- `app/lite/content/actions.ts` — Added `publishSocialDraftAction` server action (admin-role-gated, Zod-validated UUID, revalidates `/lite/content/social`). Added `markSocialDraftPublished` import.
- `lib/content-engine/index.ts` — Added CE-8 barrel exports: `markSocialDraftPublished`, `MarkPublishedResult`.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Sub-route per tab, not query params.** `/lite/content` = Review, `/lite/content/social` = Social. Each tab is its own server component with its own data fetching. Cleaner than client-side tab state + conditional queries.

2. **v1 Publish = clipboard + new tab.** Per spec Q11: "Stub channel adapters with Publish button per platform. Opens native compose screen in v1. Swappable for real API calls later with zero UI change." X gets text pre-filled in the intent URL; other platforms open their homepage (no pre-fill API available without OAuth).

3. **Grid layout (2-col on sm+).** Four platform cards per post group. Compact enough to see all platforms at a glance without scrolling.

4. **Carousel preview is inline horizontal scroll.** Instagram carousel slides render as 128px square thumbnails in a scrollable row. Toggle-able via "Preview carousel" link. Avoids modal complexity for v1.

5. **No new migration.** All data structures already exist from CE-1 and CE-5. The publish primitive only updates existing columns (`status`, `published_at_ms`).

## Verification (G0–G12)

- **G0** — CE-7 and CE-6 handoffs read. Spec `content-engine.md` §8.1, Q11, Q16 read. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `social_drafts` table, `listSocialDrafts()` helper, `visual_asset_urls` column, `carousel_slides` column, `content_social_published` activity_log kind, `/lite/content/page.tsx` with tab placeholder, `/api/content-assets/` serving route — all present.
- **G2** — Files match CE-8 scope (social tab UI + publish library + shared tabs + tests).
- **G3** — No motion work. UI surface session.
- **G4** — No numeric/string literals in autonomy-sensitive paths.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 161 test files / 1279 passed + 1 skipped (+6 new), clean production build, lint 0 errors (65 warnings, 0 from CE-8 files).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1279 passed. `npm run build` → success. `npm run lint` → 0 errors.
- **G9** — No browser-testable state yet (no real data in dev db). UI structure verified via build.
- **G10** — Library behaviours exercised by 6 unit tests.
- **G10.5** — N/A (admin UI surface, standard build).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_8_social_platform_api_integration`** — v1 is clipboard+new-tab stub. When real API adapters land (Instagram Graph API, LinkedIn Share API, X API v2, Facebook Graph API), the `markSocialDraftPublished()` call becomes the post-API-success hook. The `SocialDraftCard` Publish button routes through the adapter instead of `window.open`. Zero UI change needed.
- **`ce_8_social_draft_regenerate`** — No regenerate button in v1. If Andy doesn't like a draft, the only option is to approve a new blog post (which triggers new social drafts via fan-out). A per-draft "Regenerate" action could call `generateSinglePlatformDraft()` directly.
- **`ce_8_social_engagement_tracking`** — Spec §8.1 Metrics tab mentions "social engagement (manual tracking in v1)." No engagement data capture in CE-8. Metrics tab is a later session.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Social publish library + barrel exports
- Social tab page + shared tab component + draft list component
- Server action addition
- Test file

Review page falls back to inline tab bar (would need re-adding if reverted — low risk).

## What the next session (CE-9) inherits

CE-9 is the `content_ranking_snapshot` handler (weekly per published post, SerpAPI re-queries). Per BUILD_PLAN cron table. CE-9 inherits:

- **Full content pipeline through to social publish** — CE-1→CE-8 complete.
- **`blog_posts` table with `published_url`** for ranking target URLs.
- **`ranking_snapshots` table** — defined in CE-1, empty, awaiting handler.
- **SerpAPI integration** already wired in CE-2 (`fetchSerpResults()`).
- **`content_ranking_snapshot` task_type** in the enum.
