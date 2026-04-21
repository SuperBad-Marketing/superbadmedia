# DC-1 Handoff — Daily Cockpit: Aggregator Scaffold + Banner Strip

**Date:** 2026-04-21
**Wave:** 22 (first session)
**Status:** COMPLETE

## What was built

### 1. `cockpit_briefs` table

Drizzle schema at `lib/db/schema/cockpit-briefs.ts`. Migration `0067_dc1_cockpit_briefs.sql`. Columns per spec §Data model: `id`, `user_id`, `slot` (morning/midday/evening), `brief_date`, `generated_at_ms`, `trigger` (cron/material_event), `trigger_event`, `prose`, `signals_snapshot` (JSON), `model_version`, `created_at_ms`. Unique index on `(user_id, slot, brief_date)`.

### 2. Aggregation layer (`lib/cockpit/`)

- **`aggregator.ts`** — `mergeWaitingItems()` calls every source spec's `getWaitingItems()` in parallel via `Promise.allSettled`, merges, sorts per spec §Attention rail sort contract (time_sensitive first by deadline ASC, age_of_wait by wait-start ASC, tiebreak on id). `mergeHealthBanners()` same pattern — all sources in parallel, sorted by severity then id. Graceful degradation: any failed source is silently skipped.
- **`queries.ts`** — `getCurrentSlot(nowMs)` resolves Melbourne wall-clock time to morning/midday/evening per spec slot boundaries (6:00/12:00/18:30). `getCurrentBrief(userId, nowMs)` reads the most recent brief for current slot, falls back to any today brief, then to fallback mode. `getTodayCalendarEvents(nowMs)` reads today's active calendar bookings.

### 3. Stub sources

Live source implementations wired: `getTaskWaitingItems`, `getTaskHealthBanners`, `getObservatoryHealthBanners`, `getSaasHealthBanners`. Remaining sources (Quote Builder, Invoicing, Inbox, Lead Gen, Intro Funnel, Content Engine, Hiring, Wizards, Finance) return empty arrays — stub functions in `aggregator.ts` ready to swap in as waves ship.

### 4. Cockpit page (`/lite/cockpit`)

Server component at `app/lite/cockpit/page.tsx`. Admin-auth gated. Fetches brief, waiting items, banners, calendar events, and kanban in parallel. Renders vertically stacked:

1. **Brief panel** — greeting line (rotation pool, 8 lines), narrative brief or quiet-slot fallback (rotation pool, 10 lines). Placeholder copy until content mini-session lands.
2. **Attention rail** — horizontal scroll chips, top 6 + `+N more` overflow chip → `/lite/cockpit/waiting`. Fleet-tagged chips supported.
3. **Banner strip** — conditional (only renders when banners exist), up to 2 visible with severity-coded icons/backgrounds, overflow → `/lite/cockpit/health`.
4. **Calendar preview** — today's events with time + type labels. Empty-state dry line.
5. **Planning view** — kanban (Must Do / Should Do / If Time) with list toggle. Column counts visible. localStorage-persisted view preference. Links to task detail.

### 5. Overflow pages

- **`/lite/cockpit/waiting`** — flat list of all merged waiting items with source labels.
- **`/lite/cockpit/health`** — flat list of all merged health banners with severity icons and source labels.

Both admin-auth gated with breadcrumb back to cockpit.

### 6. Nav activation

Cockpit entry in `ADMIN_NAV_PRIMARY` flipped from `status: "soon"` to `status: "live"` with `href: "/lite/cockpit"` and `matchPrefix: "/lite/cockpit"`.

### 7. `WaitingItem.scope` type widened

`lib/tasks/cockpit.ts` — `scope` changed from literal `"own"` to `"own" | "fleet"` per spec §Attention rail contract. Required for fleet-scoped chips from Content Engine, SaaS, and Hiring specs.

## New files

- `lib/db/schema/cockpit-briefs.ts`
- `lib/db/migrations/0067_dc1_cockpit_briefs.sql`
- `lib/cockpit/aggregator.ts`
- `lib/cockpit/queries.ts`
- `app/lite/cockpit/layout.tsx`
- `app/lite/cockpit/page.tsx`
- `app/lite/cockpit/waiting/page.tsx`
- `app/lite/cockpit/health/page.tsx`
- `components/lite/cockpit/brief-panel.tsx`
- `components/lite/cockpit/attention-rail.tsx`
- `components/lite/cockpit/banner-strip.tsx`
- `components/lite/cockpit/calendar-preview.tsx`
- `components/lite/cockpit/planning-view.tsx`
- `tests/dc1-cockpit-scaffold.test.ts`

## Edited files

- `lib/db/schema/index.ts` — added cockpit-briefs export
- `lib/db/migrations/meta/_journal.json` — added migration 0067 entry
- `lib/tasks/cockpit.ts` — widened `WaitingItem.scope` to `"own" | "fleet"`
- `components/lite/admin-shell-nav.tsx` — cockpit nav entry activated

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/dc1-cockpit-scaffold.test.ts` — 12 passed
- Full suite — 283 files, 2885 tests, zero regressions (up from 282/2873)
- Browser manual check: cockpit page compiles and renders server-side (auth redirect works, page route resolves). Dev overlay blocked by a **pre-existing** `server-only` import error in `lib/eggs/admin-triggers/three-wons.ts` → `pipeline-board.tsx` client component chain — affects all admin pages, not cockpit-specific. Production build also fails on this same pre-existing error.

## Rollback

- All changes are additive — git-revertable
- New pages are admin-gated; no client-facing impact
- Migration is reversible: `DROP TABLE cockpit_briefs`
- Nav entry revert is a single-line change

## Key decisions

- **Cockpit at `/lite/cockpit`, not `/lite`.** The `/lite` directory has many existing child routes (admin, portal, etc.) with no shared layout. Putting the cockpit at `/lite/cockpit` avoids layout conflicts and follows the existing pattern (finance, observatory, tasks all have their own paths). A future redirect from `/lite` to `/lite/cockpit` can be added trivially.
- **Stub sources in aggregator, not in source modules.** Each stub is a local async function returning `[]`. When a wave ships its real `getWaitingItems()`, swap the stub for the import — no changes needed in source spec code.
- **Placeholder copy in brief-panel.** Content mini-session hasn't run; greeting and fallback rotation pools are placeholders. DC-2 (briefs + Opus generation) depends on that mini-session landing.
- **`getSaasHealthBanners("admin")` — userId passthrough.** The SaaS function signature takes `userId: string` (currently unused internally). Passed `"admin"` as placeholder; future sessions can pass the real session user id.

## Pre-existing issue noted

- **`lib/eggs/admin-triggers/three-wons.ts`** imports `lib/db` in a client component context via `pipeline-board.tsx`. This causes a `server-only` / `Can't resolve 'fs'` build error that blocks the dev overlay on every admin page and fails production builds. Not introduced by DC-1; affects all admin pages equally. Should be fixed in a separate session (move the DB query to a server action or RSC boundary).

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)

## Next session should know

- **DC-2 is the briefs session** — morning slot + cron + `generateBriefForSlot()` pipeline end-to-end. Needs the content mini-session for prompt templates (CMS-7 or equivalent). If the mini-session hasn't landed, DC-2 can stub prompt text and backfill.
- The aggregator is live and wired — any source spec that ships a real `getWaitingItems()` or `getHealthBanners()` just needs to replace the stub import in `lib/cockpit/aggregator.ts`.
- The pre-existing egg build error should ideally be fixed before DC-2 so the cockpit can be manually verified in-browser.
- `cockpit_briefs` table is created and the query layer (`getCurrentBrief`, `getCurrentSlot`) is ready for DC-2 to write briefs into.
