# SD-5 Handoff — Surprise & Delight: Riddle Loop Route + Resolver

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### `/say/[answer]` public route

Server component at `app/say/[answer]/page.tsx`:
- Dynamic route where the URL slug IS the answer text
- Optional auth check — determines `actorType` (public / admin / customer) for reward asymmetry
- Renders atmospheric background (brand red/pink gradients + noise overlay)
- Delegates response rendering to `<RiddleResponse>` client component
- `noindex, nofollow` robots meta — riddle pages should not be crawled

### `RiddleResponse` client component

`app/say/[answer]/riddle-response.tsx`:
- Framer Motion animated response with house spring
- Shows answer echo ("you said: {answer}")
- Outcome-differentiated rendering:
  - **correct**: pink border, gradient card, "found it" label, reward content in narrative font
  - **retired**: dimmed "this one's been put to bed" suffix
  - **common_wrong / catch_all_wrong**: neutral card, "try again." suffix
  - **unknown_riddle**: neutral card with generic fallback text
- HTML-escaped content rendering with newline → `<br/>` support

### `resolveByAnswer()` resolver

`lib/riddles/resolve-by-answer.ts`:
- Resolves an answer against ALL riddles (active then retired) in a single DB query
- Priority: correct active → common wrong active → correct retired → catch-all
- Logs every resolution to `riddle_resolutions` table
- Used by `/say/[answer]` — separate from the existing `resolveRiddleAnswer()` which requires knowing the riddle ID/slug upfront

## New files

- `app/say/[answer]/page.tsx`
- `app/say/[answer]/riddle-response.tsx`
- `lib/riddles/resolve-by-answer.ts`
- `tests/sd5-riddle-route.test.ts`

## Verification

- `npx tsc --noEmit` — zero new errors (2 pre-existing in hp19 test file)
- `npx vitest run` — 263 files, 2564 passed, 1 skipped (12 new tests)
- Browser: `http://localhost:3001/say/fourteen` → 200, renders correctly with "no riddles running right now" (no riddles seeded in dev DB, correct behaviour)

## Rollback

- All new files additive; git-revertable
- No schema changes (riddles table already existed from SD-1)
- No settings keys consumed

## Key decisions

- **Separate `resolveByAnswer()` from existing `resolveRiddleAnswer()`** — the existing resolver requires you to know which riddle you're checking. The `/say/[answer]` route doesn't know which riddle the visitor is answering, so it needs to try all active riddles. Rather than making the existing resolver more complex, a dedicated function handles the "try all" case.
- **auth().catch(() => null)** — the page is public-first. If the user happens to be logged in, they get the richer reward. Auth failure (not logged in) is the happy path, not an error.
- **Single DB query** — loads all riddles once, partitions into active/retired in memory. The riddle count will always be tiny (1-5 at any time), so this is simpler than multiple queries.

## Next session should know

- **SD-6+** needs to wire the riddle resolver into the marketing site search bar and the admin search bar (per spec: "both surface bindings import the same function").
- **SD-10** will add the live Claude fallback for novel wrong answers (the `// Novel wrong — SD-10 adds the live Claude fallback here` comment in the original `resolveRiddleAnswer()`).
- **The `resolveByAnswer()` function doesn't yet have the novel-wrong live-fallback path** — it falls through to catch-all. This is intentional for SD-5; SD-10 adds it.
- **No riddles exist in the dev DB** — testing the full flow requires seeding a riddle row. A content mini-session or admin UI will handle riddle creation.
