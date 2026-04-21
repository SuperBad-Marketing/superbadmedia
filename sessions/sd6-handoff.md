# SD-6 Handoff — Surprise & Delight: Search Bar Riddle Wiring

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### Admin search bar — riddle integration

`app/api/lite/search/route.ts`:
- Added `resolveByAnswer()` call alongside existing entity searches (runs in parallel via `Promise.all`)
- On correct or common-wrong match, injects a `riddle` result at the top of the results array
- Result label: "you found something." (correct) or "not quite." (common wrong)
- Result ID carries the raw answer text for URL construction

`components/lite/global-search.tsx`:
- Extended `GlobalSearchResult.type` union with `"riddle"`
- Added `Sparkles` icon for riddle results, `"???"` group label
- Route mapping: `riddle` → `/say/${encodeURIComponent(answer)}`
- Riddle group renders first in the results list

### Public search bar on marketing site

`components/public-search-bar.tsx`:
- Client component with debounced (300ms) riddle-check API calls
- Pill-shaped input with "say something" placeholder
- On match, shows animated dropdown hint ("you found something." / "not quite.") with Enter prompt
- Submit navigates to `/say/[answer]`
- Uses house spring for dropdown animation

`app/api/riddle-check/route.ts`:
- Public (unauthenticated) endpoint
- Calls `resolveByAnswer()` with `actorType: "public"`
- Returns `{ match: true, outcome, answer }` on hit, `{ match: false }` on miss
- Never leaks reward content or riddle IDs

`app/ComingSoon.tsx`:
- Integrated `PublicSearchBar` into the header, between brand name and MMXXVI date

## New files

- `app/api/riddle-check/route.ts`
- `components/public-search-bar.tsx`
- `tests/sd6-search-riddle-wiring.test.ts`

## Edited files

- `app/api/lite/search/route.ts` — added riddle resolution
- `components/lite/global-search.tsx` — extended type, icons, labels, routes for riddle
- `app/ComingSoon.tsx` — added PublicSearchBar import + header integration

## Verification

- `npx tsc --noEmit` — zero new errors (2 pre-existing in hp19 test file)
- `npx vitest run` — 264 files, 2575 passed, 1 skipped (11 new tests)
- Browser: public search bar renders on `/`, typing + Enter navigates to `/say/[answer]`, riddle-check API responds correctly
- No riddle hint shown because no riddles seeded in dev DB (correct behaviour, same as SD-5)

## Rollback

- All new files additive; git-revertable
- `GlobalSearchResult` type extension is backward-compatible (union widened)
- No schema changes, no settings keys consumed

## Key decisions

- **Riddle results appear first in admin search** — if someone types a correct answer while searching for a company, the riddle takes precedence at the top of the list. CRM results still appear below.
- **Public riddle-check API does not leak content** — only returns match/outcome/answer, never reward text or riddle IDs. The actual content renders server-side at `/say/[answer]`.
- **Both surfaces use `resolveByAnswer()`** — per spec rule #22, the resolver is singular. Admin search passes `actorType: "admin"` + userId; public search passes `actorType: "public"`.
- **Public search bar submits to `/say/[answer]` on Enter regardless of match** — even if no hint appeared, Enter navigates. The `/say/[answer]` page handles all outcomes including "no riddles running."

## Next session should know

- **SD-7+** continues the S&D build. Check BUILD_PLAN for the next session's scope.
- **The admin search riddle wiring is only testable with a seeded riddle** — a content mini-session or admin UI for riddle creation will make this testable in-browser.
- **The public search bar is on the Coming Soon page** — when the marketing site gets a real header/nav, the search bar should migrate there.
