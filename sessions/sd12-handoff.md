# SD-12 Handoff — Surprise & Delight: Welcome Egg Safety Net + Public Egg Polish

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### 1. Welcome egg safety net

`components/lite/welcome-egg-safety-net.tsx`:
- Listens for `visibilitychange` (hidden) and `beforeunload`
- If no egg has fired during the session AND `firstEggDeliveredAt` is null AND tricks are enabled → fires the welcome egg
- Copy: "you came, you saw, nothing happened. we noticed."
- Renders via shared `PublicEggMarginNote` with `content` placement
- Guards: won't fire if any egg already fired (listens for `public-egg-fired` event), won't fire if tricks disabled, won't fire if returning visitor (firstEggDeliveredAt set)

### 2. "No tricks" footer link

`components/lite/no-tricks-link.tsx`:
- Small subtle link in the root layout footer (left side)
- On click: reads public egg state, sets `tricksDisabled: true`, writes back to cookie + localStorage
- Styled at 11px, low opacity, unobtrusive — "mentioned nowhere in normal product copy"

### 3. CRT cookie re-entry block

`components/lite/public-crt-turn-off-egg.tsx`:
- Added `hasCrtClosedCookie()` check inside the `handleFired` callback
- If cookie exists when the CRT egg fires, the renderer no-ops (no dim → static → collapse sequence)
- Prevents the CRT takeover from re-rendering if visitor navigates to another page before 7am Melbourne

### 4. `novel_wrong` outcome in RiddleResponse

`app/say/[answer]/riddle-response.tsx`:
- Added `novel_wrong` to the "try again" suffix condition alongside `common_wrong` and `catch_all_wrong`
- Previously `novel_wrong` showed no retry prompt — now consistent with spec

## New files

- `components/lite/welcome-egg-safety-net.tsx`
- `components/lite/no-tricks-link.tsx`
- `tests/sd12-welcome-egg-and-polish.test.ts`

## Edited files

- `components/lite/public-egg-shell.tsx` — added WelcomeEggSafetyNet
- `components/lite/public-crt-turn-off-egg.tsx` — added cookie re-entry guard
- `app/layout.tsx` — added NoTricksLink to footer, changed footer to `justify-between`
- `app/say/[answer]/riddle-response.tsx` — added `novel_wrong` to try-again condition

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run` — 269 files, 2628 passed (+10 new), 1 skipped
- Dev server starts cleanly on port 3001, HTTP 200
- Browser: root layout renders with NoTricksLink in footer (left), WelcomeEggSafetyNet mounted (idle)

## Rollback

- All new files additive; git-revertable
- Layout footer change is backward-compatible (adds a link, flexes existing button)
- CRT cookie check is additive (guard clause in existing callback)
- RiddleResponse condition change is non-breaking (adds coverage for existing outcome type)

## Key decisions

- **Welcome egg fires on `visibilitychange` + `beforeunload`** — dual handlers for coverage: `visibilitychange` fires when backgrounding the tab (mobile "leave" gesture, tab switch); `beforeunload` fires on actual navigation away or close. Both check the same guards.
- **No tricks link is client-side only** — no API call, no server involvement. Cookie + localStorage is the persistence layer, matching the public egg state pattern.
- **CRT re-entry block in the renderer, not the orchestrator** — the server-side orchestrator might still "fire" the CRT egg (logs it), but the client-side renderer suppresses the visual if the cookie exists. This keeps the fire log accurate while preventing re-display.

## PATCHES_OWED still open from SD-11

- `sd11_rain_ambient_mp3` — audio file needs sourcing (CMS-6 or asset session)
- `sd11_deep_reader_link_target` — per-page config for "deeper piece" link (CMS-6 content)
- `sd11_rapid_scroller_per_page_summary` — per-page one-sentence summary (CMS-6 content)

## Next session should know

- **Wave 20 remaining sessions (SD-13, SD-14)** continue S&D polish — ambient copy slots, admin egg catalogue expansion, final integration testing.
- **CMS-6 content session** produces final copy for all 12 public egg renderers + remaining per-page configs.
- **All core public egg infrastructure is now complete**: 12 renderers + welcome safety net + no-tricks kill switch + CRT re-entry block + riddle route with novel-wrong fallback.
