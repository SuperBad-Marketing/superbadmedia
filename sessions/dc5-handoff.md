# DC-5 Handoff — Daily Cockpit: Banner Strip Wiring

**Date:** 2026-04-21
**Wave:** 22 (fifth session)
**Status:** COMPLETE

## What was built

### 1. Real `getHealthBanners()` implementations for 3 source specs

Replaced aggregator stubs with database-backed implementations:

- **`lib/inbox/health-banners.ts`** — `getInboxHealthBanners()`: Graph API subscription lapsed (critical, checks `graph_api_state.subscription_expires_at_ms`), SendAs permission revoked (critical, checks `integration_connections` with status `revoked`), import stuck >24h (warning, checks `initial_import_status = 'in_progress'` with stale `updated_at_ms`).
- **`lib/content/health-banners.ts`** — `getContentHealthBanners()`: content delivery integration degraded (checks `integration_connections` for cloudinary/meta-ads/google-ads with revoked/lapsed status). Severity escalates to critical for revoked connections.
- **`lib/wizards/health-banners.ts`** — `getWizardHealthBanners()`: admin wizards idle ≥ N days (reads `wizards.admin_cockpit_banner_days` setting, default 7). Queries `wizard_progress` for admin audience, not abandoned, last active before threshold. Escalates to critical at 2x the threshold.

### 2. Updated aggregator

`lib/cockpit/aggregator.ts` now imports all 8 real banner sources (was 5 real + 3 stubs). Zero banner stubs remain. Two waiting-item stubs remain (client management, wizards — unchanged from DC-4).

### 3. Calendar preview + `/lite/cockpit/health` already wired

Both were built in DC-1. `getTodayCalendarEvents()` reads from `calendar_bookings` table, renders in `CalendarPreview` component. Health page renders all banners with source labels. No changes needed.

## New files

- `lib/inbox/health-banners.ts`
- `lib/content/health-banners.ts`
- `lib/wizards/health-banners.ts`
- `tests/dc5-health-banners.test.ts`

## Edited files

- `lib/cockpit/aggregator.ts` — replaced 3 stub banner functions with real imports

## Verification

- `npx tsc --noEmit` — 4 pre-existing errors (dc4 test + hp19 test), zero new
- `npx vitest run tests/dc5-health-banners.test.ts` — 9 passed
- Full suite — 287 files, 2921 tests, zero regressions (up from 286/2912)

## Rollback

- All changes are additive — git-revertable
- Each source is wrapped in `Promise.allSettled` — one broken source never crashes the cockpit
- All new files are pure query functions with no side effects

## Key decisions

- **Inbox banner checks three conditions independently.** Lapsed subscription, revoked permissions, and stuck imports are separate banners (not aggregated) because they have different fix paths.
- **Content engine banners check integration connection health.** External service error tracking (Remotion, OpenAI Images) isn't possible via `external_call_log` (no error column) — content banners instead check for degraded vendor connections. More service-specific health checks can be added when those features ship their own error tracking.
- **Wizard idle threshold reads from settings.** Uses `wizards.admin_cockpit_banner_days` (default 7, per settings registry). Escalates to critical at 2x threshold (14+ days) — a wizard idle that long likely needs abandoning.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)

## Next session should know

- **DC-5 completes banner strip wiring.** All 8 banner sources are now live. Zero banner stubs remain in the aggregator.
- **Wave 22 (Daily Cockpit) is now complete.** DC-1 through DC-5 all shipped. Remaining waiting-item stubs (Client Management, Setup Wizards) are low-frequency and depend on their parent specs adding needed state.
- The pre-existing egg build error (`lib/eggs/admin-triggers/three-wons.ts` → `pipeline-board.tsx` client component chain) still blocks dev overlay and production builds.
