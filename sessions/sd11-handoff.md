# SD-11 Handoff — Surprise & Delight: Public Egg Rendering Infrastructure + All 12 Renderers

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### 1. Public egg state manager

`lib/eggs/public-egg-state.ts`:
- Cookie + localStorage dual-persistence for visitor egg state
- `readPublicEggState()` — reads from both, picks the richer one
- `writePublicEggState()` — writes to both with 90-day cookie expiry
- `recordVisit()` — deduplicated per calendar day, 60-day sliding window
- `recordEggFired()` — sets firstEggDeliveredAt on first fire, appends to history
- `getVisitCount()` / `setTricksDisabled()` — helpers for visit counting and kill switch

### 2. Public egg orchestrator (server-side)

`lib/eggs/orchestrate-public.ts`:
- `orchestratePublicEggs(input)` — mirrors admin orchestrator pattern
- Resolves Melbourne date/hour/holiday/weather server-side
- Imports and runs all 12 registered public triggers
- Applies cadence gates (2-per-14-day budget, per-egg cooldowns)
- Fires at most one egg per evaluation, logs to `hidden_egg_fires`

### 3. Public egg evaluate API route

`app/api/lite/eggs/evaluate-public/route.ts`:
- POST endpoint, no auth (public visitors)
- Zod-validated input from client context
- Returns `{ fired, eggId, evidence, copy }`

### 4. Public egg orchestrator (client-side)

`components/lite/public-egg-orchestrator.tsx`:
- Gathers live browser context: dwell time, scroll depth/speed, tab backgrounding, referrer, timezone, visit count
- Path guard — skips admin/portal/authenticated routes
- Initial 3s delay + 15s poll interval (max 20 polls per session)
- Dispatches `public-egg-fired` CustomEvent on successful fire
- Scroll tracking via passive listener, visibility API for tab backgrounding

### 5. Public egg shell

`components/lite/public-egg-shell.tsx`:
- Aggregate component mounting orchestrator + all 12 renderers
- Mounted in root `app/layout.tsx`

### 6. Margin note renderers (9 eggs)

`components/lite/public-egg-margin-note.tsx`:
- Shared renderer: serif italic text, Framer fade-in, placement-aware positioning
- 5 placement options (top/hero/content/footer/bottom)

`components/lite/public-egg-renderers.tsx`:
- `LateNightVisitorEgg` — "it's 3am where you are. genuinely, go to bed." (top)
- `SundayResearcherEgg` — sunday research acknowledgement (hero)
- `FifthTimeVisitorEgg` — with real `mailto:` link (content)
- `ReturningVisitorEgg` — "you're back" (footer)
- `LinkedInReferrerEgg` — LinkedIn apology (hero)
- `GoogleIntentCheapEgg` — price barrier acknowledgement (hero)
- `RapidScrollerEgg` — "you scrolled past it in six seconds" (bottom)
- `DeepReaderEgg` — deep reading acknowledgement (content)
- `AbandonedTabEgg` — "we'll wait" (top)

### 7. Melbourne Rain renderer

`components/lite/melbourne-rain-egg.tsx`:
- Margin note + ambient rain sound via `HTMLAudioElement`
- 4% volume cap (spec: 20% of normal UI sound level)
- Respects `prefers-reduced-motion: reduce` (sound suppressed)
- Graceful degradation on autoplay block

### 8. Melbourne Public Holiday renderer

`components/lite/melbourne-holiday-egg.tsx`:
- Full-page z-[9998] takeover with warm charcoal background
- Holiday name shown as subtitle
- Framer staggered fade-in

### 9. Public CRT turn-off renderer

`components/lite/public-crt-turn-off-egg.tsx`:
- Same dim→static→collapse→frozen sequence as admin CRT
- Different copy: "we've closed for the night. go to bed."
- Sets `sb_crt_closed` cookie with TTL until 7am Melbourne
- Separate SVG filter ID (`public-crt-noise`) to avoid admin CRT collision

## New files

- `lib/eggs/public-egg-state.ts`
- `lib/eggs/orchestrate-public.ts`
- `app/api/lite/eggs/evaluate-public/route.ts`
- `components/lite/public-egg-orchestrator.tsx`
- `components/lite/public-egg-shell.tsx`
- `components/lite/public-egg-margin-note.tsx`
- `components/lite/public-egg-renderers.tsx`
- `components/lite/melbourne-rain-egg.tsx`
- `components/lite/melbourne-holiday-egg.tsx`
- `components/lite/public-crt-turn-off-egg.tsx`
- `public/sounds/` (directory created; rain-ambient.mp3 needs sourcing)
- `tests/sd11-public-egg-infrastructure.test.ts`

## Edited files

- `app/layout.tsx` — mounted PublicEggShell
- `lib/eggs/index.ts` — exported public orchestrator + state manager

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19-briefing-signals.test.ts), zero new
- `npx vitest run` — 269 files, 2628 passed (+18 new), 1 skipped
- Dev server starts cleanly on port 3001, HTTP 200
- Browser: root layout renders with PublicEggShell mounted (idle — no egg visible unless trigger conditions met)

## Rollback

- All new files additive; git-revertable
- Root layout edit is backward-compatible (PublicEggShell renders null unless eggs fire)
- Index exports are additive
- No schema changes, no migrations, no settings keys modified

## Key decisions

- **Path guard in orchestrator** — evaluator checks `window.location.pathname` and skips admin/portal/authenticated routes rather than mounting the shell conditionally per layout. Simpler, single mount point.
- **Cookie + localStorage dual persistence** — spec requires redundancy so losing one store doesn't re-fire the welcome egg
- **Poll-based evaluation** — 3s initial delay + 15s interval captures evolving context (scroll depth growing, tab backgrounding accumulating) without excessive API calls. Max 20 polls per session (5 minutes of coverage).
- **Margin note as shared component** — 9 of 12 eggs share the same visual pattern (serif italic, fade-in, positioning). Dedicated renderers only for rain (sound), holiday (full-page takeover), and public CRT (phased animation).
- **Rain sound via HTMLAudioElement, not Howler** — spec says rain is explicitly exempt from the sound registry. Using raw Audio API keeps it isolated from the Howler-based SoundProvider.

## PATCHES_OWED

- `sd11_rain_ambient_mp3` — actual rain-ambient.mp3 audio file needs to be sourced and placed in `public/sounds/`. Component gracefully handles its absence.
- `sd11_welcome_egg_safety_net` — spec says if no egg fires by session-end, a "welcome egg" fires as safety net. Not implemented yet — needs a `beforeunload`/`visibilitychange` handler that evaluates whether any egg fired in the session and dispatches the welcome if not. Belongs in SD-12 or later.
- `sd11_no_tricks_footer_link` — spec says a small "No tricks" footer link on public surfaces sets `tricksDisabled` cookie. Not wired yet.
- `sd11_crt_cookie_reentry_block` — the `sb_crt_closed` cookie is set by the public CRT egg but no middleware/gate checks it to actually block re-entry. Needs a client-side check on page load.
- `sd11_deep_reader_link_target` — spec says deep reader links to "a deeper piece" and fails closed when no deeper piece exists. Current implementation omits the link. Needs per-page configuration.
- `sd11_rapid_scroller_per_page_summary` — spec says rapid scroller shows a per-page one-sentence summary generated at build time. Current implementation uses generic copy.

## Next session should know

- **SD-12+** continues S&D. The `/say/[answer]` riddle route is assigned to SD-12 per BUILD_PLAN.
- **All 12 public egg renderers are now in place** but several have simplified copy (placeholder). When CMS-6 content mini-session runs, it should produce final copy for each egg.
- **The rain ambient sound file is missing** — `public/sounds/rain-ambient.mp3` needs to be sourced.
- **Testing public eggs in-browser** requires matching trigger conditions. Easiest: devtools dispatch `window.dispatchEvent(new CustomEvent("public-egg-fired", { detail: { eggId: "late_night_visitor", evidence: {} } }))`.
