# SD-10 Handoff — Surprise & Delight: Novel Wrong Fallback + Three Wons Toast + Budget Monitor

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### 1. Riddle novel-wrong live Claude fallback

`lib/riddles/novel-wrong-fallback.ts`:
- `resolveNovelWrong(riddle, input)` — shared function used by both resolvers
- Checks `riddle_novel_wrong_cache` for a cached response first (zero LLM cost on repeat)
- If no cache hit: checks budget via `settings.get("surprise.riddle_wrong_answer_fallback_budget_per_riddle")`
- If budget available: calls `invokeLlmText` with job `sd-riddle-wrong-fallback` (Haiku tier)
- Response passes Brand-Voice Drift Check; drift failure falls back to catch-all
- Cached responses stored in `riddle_novel_wrong_cache` with drift score
- Respects `killSwitches.llm_calls_enabled`

`lib/riddles/resolve.ts`:
- Novel-wrong path replaces the `// SD-10 adds the live Claude fallback here` stub
- Returns `novel_wrong` outcome when LLM generates a response; falls through to `catch_all_wrong` otherwise

`lib/riddles/resolve-by-answer.ts`:
- Same novel-wrong path wired for the `/say/[answer]` resolver

### 2. Three Wons inline toast renderer

`components/lite/three-wons-toast.tsx`:
- Client component listening for `admin-egg-fired` CustomEvent with `eggId === "three_wons"`
- Serif italic copy, centred bottom, house spring animation
- 4-second display then auto-exit with AnimatePresence
- Branded styling (neutral[800] bg, brand.red glow shadow)

`components/lite/sales-pipeline/pipeline-board.tsx`:
- Three Wons fire now dispatches `admin-egg-fired` CustomEvent instead of a plain `toast()` call
- Consistent with the pattern used by CRT turn-off and milestone spotter

`app/lite/admin/layout.tsx`:
- Added `<ThreeWonsToast />` alongside existing egg renderers

### 3. `riddle_answer_fallback_budget_monitor` scheduled task handler

`lib/scheduled-tasks/handlers/riddle-answer-fallback-budget-monitor.ts`:
- Monthly job iterating active riddles
- Logs `riddle_budget_warning` at 80% of budget, `riddle_budget_exhausted` at 100%
- Registered in handler index

### Schema additions

- **New table:** `riddle_novel_wrong_cache` (id, riddle_id, input_hash, response, drift_check_score, created_at_ms)
- **New migration:** `0064_sd10_riddle_novel_wrong_cache.sql`
- **Activity log kinds:** `riddle_budget_warning`, `riddle_budget_exhausted`
- **Model registry:** `sd-riddle-wrong-fallback` (Haiku tier)

## New files

- `lib/riddles/novel-wrong-fallback.ts`
- `components/lite/three-wons-toast.tsx`
- `lib/scheduled-tasks/handlers/riddle-answer-fallback-budget-monitor.ts`
- `lib/db/migrations/0064_sd10_riddle_novel_wrong_cache.sql`
- `tests/sd10-novel-wrong-and-three-wons.test.ts`

## Edited files

- `lib/riddles/resolve.ts` — novel-wrong fallback wired
- `lib/riddles/resolve-by-answer.ts` — novel-wrong fallback wired
- `lib/db/schema/riddles.ts` — added `riddle_novel_wrong_cache` table
- `lib/db/schema/activity-log.ts` — added budget warning/exhausted kinds
- `lib/ai/models.ts` — added `sd-riddle-wrong-fallback` slug
- `lib/ai/prompts/INDEX.md` — added new prompt, removed S&D from prompt-free list
- `lib/scheduled-tasks/handlers/index.ts` — registered budget monitor
- `lib/db/migrations/meta/_journal.json` — migration 0064
- `components/lite/sales-pipeline/pipeline-board.tsx` — CustomEvent dispatch instead of plain toast
- `app/lite/admin/layout.tsx` — added ThreeWonsToast

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 268 files, 2610 passed, 1 skipped (8 new tests)
- Dev server starts cleanly on port 3001
- Browser: admin layout loads with ThreeWonsToast mounted (idle state — no visual change until 3 Wons fire)

## Rollback

- New table is additive; git-revertable with down-migration: `DROP TABLE IF EXISTS riddle_novel_wrong_cache`
- All component additions are additive (idle no-op until events fire)
- Activity log kinds are append-only enums
- Model registry slug is additive
- No existing settings keys modified

## Key decisions

- **Shared `resolveNovelWrong()` function** — both resolvers (`resolve.ts` and `resolve-by-answer.ts`) use the same function to avoid forking the fallback logic
- **Cache-first, LLM-second** — novel wrongs check cache before calling Claude, so repeat submissions cost nothing
- **Drift-check gate** — any LLM response that fails the drift check falls back to the pre-generated catch-all rather than caching off-brand copy
- **Three Wons uses CustomEvent, not plain toast** — consistent with CRT and milestone spotter patterns; the dedicated component controls styling and timing
- **Budget monitor logs warnings at 80%** — gives Andy advance notice in cockpit briefs before a riddle exhausts its fallback budget

## Next session should know

- **SD-11+** continues S&D. Public egg renderers are not yet built — the 12 public triggers exist but have no client-side rendering infrastructure.
- **Testing novel-wrong fallback end-to-end requires** a seeded riddle + a non-matching input. The LLM call is mocked in unit tests but works live against the Anthropic API.
- **The budget monitor needs a `scheduled_tasks` row** seeded with monthly cadence — the handler is registered but the cron entry should be created when the scheduled tasks infrastructure seeds recurring jobs.
