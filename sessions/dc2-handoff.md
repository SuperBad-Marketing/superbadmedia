# DC-2 Handoff — Daily Cockpit: Briefs Pipeline + Cron

**Date:** 2026-04-21
**Wave:** 22 (second session)
**Status:** COMPLETE

## What was built

### 1. `generateBriefForSlot()` — core pipeline

`lib/cockpit/generate-brief.ts`. The end-to-end brief generation function:

- Gated by `cockpit_briefs_enabled` + `llm_calls_enabled` kill switches
- Gathers signals: waiting items (via aggregator), health banners, calendar events, andy-facing activity trail
- Quiet-slot skip: if zero waiting items + zero banners + zero events → skips Opus call, logs `cockpit_brief_skipped_quiet`
- Builds slot-specific prompt (morning/midday/evening) with chained prior briefs
- Calls Opus via LLM registry (`cockpit-brief` job key) with SuperBad brand voice as system prompt
- Persists to `cockpit_briefs` table (insert or update for regen)
- Logs `cockpit_brief_generated` or `cockpit_brief_regenerated` to activity log
- Signals snapshot stored for debugging/audit

### 2. Prompt templates

`lib/cockpit/prompts/{types,morning,midday,evening}.ts`. Stub content (content mini-session hasn't landed):

- **Morning** — signals + waiting items + banners + calendar
- **Midday** — chains morning prose + event trail since 6 AM
- **Evening** — chains morning + midday prose + expanded event trail + tomorrow's calendar

All enforce dry/direct voice, 2–3 sentences, no motivational fluff.

### 3. Andy-facing activity filter

`lib/cockpit/andy-facing-activity.ts`. Returns deduped, time-ordered events from `activity_log` filtered to 28 Andy-facing kinds (task status changes, quote/invoice events, subscription events, stage changes, outreach replies, intro funnel bookings, assessments, content approvals, hiring events, referrals).

### 4. Kill switch — `cockpit_briefs_enabled`

Added to `lib/kill-switches.ts`. Defaults `false`. Must be flipped on in Phase 6 alongside `llm_calls_enabled`.

### 5. Settings keys (3)

Added to `lib/settings.ts` registry + `docs/settings-registry.md` + seed migration `0068_dc2_cockpit_settings.sql`:

- `cockpit.quiet_slot_cost_threshold` — `0.50` (decimal)
- `cockpit.material_event_debounce_minutes` — `10` (integer)
- `cockpit.waiting_items_rail_cap` — `6` (integer)

### 6. Cron API route

`app/api/cron/cockpit-brief/route.ts`. POST with `?slot=morning|midday|evening` (defaults to current slot). CRON_SECRET auth. Three cron entries fire at 06:00 / 12:00 / 18:30 Melbourne.

### 7. Scheduled task handler — `cockpit_brief_regenerate`

`lib/scheduled-tasks/handlers/cockpit-brief-regenerate.ts`. Registered in handler index. Handles material-event-triggered regen via the scheduled_tasks worker. DC-3 wires the trigger side.

## New files

- `lib/cockpit/generate-brief.ts`
- `lib/cockpit/andy-facing-activity.ts`
- `lib/cockpit/prompts/types.ts`
- `lib/cockpit/prompts/morning.ts`
- `lib/cockpit/prompts/midday.ts`
- `lib/cockpit/prompts/evening.ts`
- `lib/scheduled-tasks/handlers/cockpit-brief-regenerate.ts`
- `app/api/cron/cockpit-brief/route.ts`
- `lib/db/migrations/0068_dc2_cockpit_settings.sql`
- `tests/dc2-cockpit-briefs.test.ts`

## Edited files

- `lib/kill-switches.ts` — added `cockpit_briefs_enabled`
- `lib/settings.ts` — added 3 cockpit settings keys
- `lib/scheduled-tasks/handlers/index.ts` — registered cockpit brief regenerate handler
- `lib/db/migrations/meta/_journal.json` — added migration 0068 entry
- `docs/settings-registry.md` — added Daily Cockpit section (3 keys), updated totals
- `tests/settings.test.ts` — updated seed count 162 → 165

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/dc2-cockpit-briefs.test.ts` — 11 passed
- Full suite — 284 files, 2896 tests, zero regressions (up from 283/2885)

## Rollback

- All changes are additive — git-revertable
- Kill switch defaults `false` — no Opus calls fire unless explicitly enabled
- Cron route requires CRON_SECRET — no accidental invocation
- Migration is `INSERT OR IGNORE` — safe to re-run

## Key decisions

- **Brand DNA as system prompt, not user prompt.** SuperBad's voice is injected via the `system` parameter on the Opus call, keeping it separated from the signals context per invoke.ts architecture.
- **Quiet-slot skip before Opus call.** Saves cost; the BriefPanel already handles fallback rotation lines from DC-1.
- **Regen overwrites via UPDATE, not INSERT.** Per spec's unique constraint — `(user_id, slot, brief_date)`. Previous prose captured in activity log meta for audit.
- **Stub prompt content.** Content mini-session hasn't landed; prompts are functional but will be refined when CMS runs.
- **`cockpit.quiet_slot_cost_threshold` setting exists but is not consumed yet.** Reserved for DC-3 or a future cost-gating enhancement (skip generation if estimated cost exceeds threshold).

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)

## Next session should know

- **DC-3 is the material-event regen session** — wires `maybeRegenerateBrief(eventKey, payload)` helper + debounce logic + the brief-triggers denylist. The handler is registered; DC-3 wires the trigger side.
- The prompt templates are functional but stub — content mini-session should refine the actual copy and rotation pools.
- The pre-existing egg build error (`lib/eggs/admin-triggers/three-wons.ts` → `pipeline-board.tsx` client component chain) still blocks dev overlay and production builds. Should be fixed in a separate session.
- `generateBriefForSlot()` is the single entry point for both cron and event-driven paths.
