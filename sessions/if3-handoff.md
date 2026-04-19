# IF-3 Handoff — Reflection Synthesis + Retainer-Fit + Abandon Tracking + Decision CTAs

**Date:** 2026-04-19
**Wave:** 14
**Status:** COMPLETE

## What was built

- **Reflection synthesis generator** (`lib/intro-funnel/generate-synthesis.ts`) — Opus-tier. Reads reflection answers + Brand DNA (system context per discipline #44) + signal tags + questionnaire answers. Drift-checked before display. Falls back to warm-but-generic text on drift fail or generation error. Stores synthesis_text + metadata on `intro_funnel_reflections`. Wired into `completeReflection` action — synthesis now returns text to the client component for immediate display.

- **Retainer-fit recommendation generator** (`lib/intro-funnel/generate-retainer-fit.ts`) — Opus-tier, internal-only. Full context bundle: onboarding + enrichment + reflection + synthesis + Brand DNA + standing brief + safety_valve_triggered flag. Zod-validated structured JSON output (recommendation_type / confidence / reasoning_text / flags). Drift-checked with one retry on fail; stores with `drift_check_passed: false` on second fail (Andy is ultimate arbiter). Safety-valve branch biases to `'neither'` per spec §13.4 F2.d. Writes `post_trial_signal` on deals table. Fires in background (`.catch(() => {})`) from both `completeReflection` and `triggerSafetyValve`.

- **Abandon tracking** (`lib/intro-funnel/abandon-tracking.ts`) — self-perpetuating hourly check via `intro_funnel_abandon_check` scheduled task. Four-step sequence: 15m SMS (hardcoded template) → 24h SMS + Haiku-drafted email (drift-checked, fallback on fail) → 3d Haiku-drafted email → demotion to Lost. Portal activity resets sequence to pending. Handler registered in worker registry.

- **Decision CTA handling** — `recordDecision` now accepts `submissionId` + `dealId`, transitions portal to `portal_dormant` on "think_about_it", logs activity for both paths. Client component wires the new params.

- **Reflection client wiring** — `completeReflection` now returns `{ synthesisText }` to the client. Client displays real Opus synthesis instead of hardcoded fallback. Three synthesis source priority: fresh generation → existing DB row → static fallback.

## Schema changes

- `SCHEDULED_TASK_TYPES` +3: `intro_funnel_abandon_check`, `intro_funnel_booking_reminder`, `intro_funnel_reflection_reminder`
- `ACTIVITY_LOG_KINDS` +3: `intro_funnel_abandon_15m_sent`, `intro_funnel_abandon_24h_sent`, `intro_funnel_abandon_3d_sent`
- No migration (enum extensions only, no DDL)

## New files

- `lib/intro-funnel/generate-synthesis.ts`
- `lib/intro-funnel/generate-retainer-fit.ts`
- `lib/intro-funnel/abandon-tracking.ts`
- `lib/scheduled-tasks/handlers/intro-funnel-abandon.ts`
- `tests/intro-funnel/if3-synthesis.test.ts`
- `tests/intro-funnel/if3-retainer-fit.test.ts`
- `tests/intro-funnel/if3-abandon-tracking.test.ts`

## Edited files

- `app/lite/intro/[token]/reflect/reflection-actions.ts` — imports + synthesis wiring + retainer-fit background fire + decision CTA paths
- `app/lite/intro/[token]/reflect/reflection-client.tsx` — dynamic synthesis text + recordDecision params
- `lib/db/schema/scheduled-tasks.ts` — +3 task types
- `lib/db/schema/activity-log.ts` — +3 kinds
- `lib/scheduled-tasks/handlers/index.ts` — registered abandon handler
- `lib/ai/prompts/intro-funnel.md` — stub → partial (3 prompts calibrated)

## Verification

- `npx tsc --noEmit` — zero source errors
- `npx vitest run` — 221 files, 1841 passed, 1 skipped (+3 files, +8 tests)
- Browser: `/trial-shoot` → 200, `/lite/intro/[token]/reflect` → 307 (valid redirect)

## Key decisions

- Retainer-fit fires in background from both completion paths (normal + safety valve) per §13.4 — `.catch(() => {})` so it never blocks the user flow
- Abandon email uses Haiku with drift check, falls back to hardcoded templates (different register for 24h vs 3d) — SMS stays hardcoded per spec §14.3
- `recordDecision("think_about_it")` transitions to `portal_dormant` immediately (spec says "after 48h" but the spec's §13.5 description reads as portal transitioning to dormant state — the 48h is for "no active nudging" which is already handled by abandon sequence being `not_applicable` at this point)
- `intro_funnel_booking_reminder` and `intro_funnel_reflection_reminder` task types added to schema now but handlers not yet built — tracked as IF-2 cron items, will wire in IF-4 or a follow-up

## Next session should know

- IF-4 is next — portal-guard recovery flow + OTT magic-link embedding
- IF-E2E follows — Playwright E2E for the full flow
- Booking reminder scheduled tasks (24h/2h before) still need handlers — they're registered but unwired
- `intro_funnel_reflection_reminder` handler also unwired
- `ensureAbandonCheckEnqueued()` needs to be called once to bootstrap the self-perpetuating chain (call from admin setup wizard completion or from a seed script)
- The `standing_brief` settings key (`trial_shoot.standing_brief`) may not exist in the settings table yet — the retainer-fit generator `.catch()`es the read gracefully
