# SD-2 Handoff — Surprise & Delight: generateInVoice LLM Pipeline + First Triggers

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### generateInVoice — real LLM pipeline (`lib/eggs/generate-in-voice.ts`)

Replaced the placeholder stub with the full implementation:

1. **Kill-switch gated** — returns placeholder when `llm_calls_enabled` is false
2. **Slot-aware prompting** — `SLOT_INSTRUCTIONS` map provides tailored generation instructions for each of the 6 ambient surface categories (empty_state, error_page, loading_copy, success_toast, placeholder_text, morning_brief)
3. **Haiku-tier generation** via `invokeLlmText({ job: "sd-generate-in-voice" })` — new job slug registered in model registry
4. **Brand-voice drift check** — every generated line runs through `checkBrandVoiceDrift()` against SuperBad's own Brand DNA profile (loaded via `getSuperbadBrandProfile()`)
5. **One retry on drift failure** — if the first attempt fails drift check, a second generation fires with a nudge prompt; second failure returns the original text with `passedDriftCheck: false` (surfaces a warning per spec)

### Model registry addition (`lib/ai/models.ts`)

- `"sd-generate-in-voice": "haiku"` — new job slug, Haiku tier

### 9 public trigger functions (`lib/eggs/triggers/*.ts`)

Each trigger is a pure function registered via `registerTrigger()`. All fail-closed (return null when conditions not met).

| Trigger file | Egg ID | Signal |
|---|---|---|
| `late-night-visitor.ts` | `late_night_visitor` | localHour 2–4 |
| `sunday-researcher.ts` | `sunday_researcher` | Sunday + search engine referrer + 45s+ dwell |
| `linkedin-referrer.ts` | `linkedin_referrer` | Referrer contains linkedin.com or lnkd.in |
| `google-intent-cheap.ts` | `google_intent_cheap` | Search query ?q= contains cheap/discount/budget/free |
| `rapid-scroller.ts` | `rapid_scroller` | scrollDepth ≥ 90% in under 6 seconds |
| `deep-reader.ts` | `deep_reader` | dwellMs ≥ 4 min + scrollDepth ≥ 70% |
| `abandoned-tab.ts` | `abandoned_tab` | tabBackgroundedMs ≥ 10 min |
| `fifth-time-visitor.ts` | `fifth_time_visitor` | visitCount exactly 5 |
| `returning-visitor.ts` | `returning_visitor` | visitCount ≥ 2 and ≠ 5 |

`lib/eggs/triggers/index.ts` barrel imports all 9 to register on module load.

### Not registered (require async/external data — later sessions)

- `melbourne_public_holiday` — needs `/data/au-holidays.json` lookup (SD-3+)
- `melbourne_rain` — needs Open-Meteo API call (SD-3+)
- `public_crt_turn_off` — needs combined Melbourne timezone + time + duration (SD-3+)
- Admin eggs (CRT, milestone, three_wons) — need activity_log queries (later sessions)

## New files

- `lib/eggs/triggers/late-night-visitor.ts`
- `lib/eggs/triggers/sunday-researcher.ts`
- `lib/eggs/triggers/linkedin-referrer.ts`
- `lib/eggs/triggers/google-intent-cheap.ts`
- `lib/eggs/triggers/rapid-scroller.ts`
- `lib/eggs/triggers/deep-reader.ts`
- `lib/eggs/triggers/abandoned-tab.ts`
- `lib/eggs/triggers/fifth-time-visitor.ts`
- `lib/eggs/triggers/returning-visitor.ts`
- `lib/eggs/triggers/index.ts`
- `tests/sd2-generate-in-voice-triggers.test.ts`

## Edited files

- `lib/eggs/generate-in-voice.ts` — full rewrite from stub to real LLM pipeline
- `lib/ai/models.ts` — added `sd-generate-in-voice` job slug

## Verification

- `npx tsc --noEmit` — zero new errors (2 pre-existing in hp19 test file)
- `npx vitest run` — 260 files, 2518 passed, 1 skipped (26 new tests)
- No browser check needed — pure library/engine code

## Rollback

- `lib/ai/models.ts`: remove `sd-generate-in-voice` entry
- `lib/eggs/generate-in-voice.ts`: revert to stub
- `lib/eggs/triggers/`: delete directory contents
- All changes additive; git-revertable

## Key decisions

- **Retry once on drift failure, not twice** — spec says "regenerate once; a second failure surfaces a visible warning." Implemented exactly: one retry, second failure returns original text with passedDriftCheck=false.
- **Slot instructions as static map** — kept in the same file rather than extracting to a separate prompt file, since these are generation instructions not full prompts. The actual prompt is constructed dynamically with context.
- **Trigger evaluators as side-effect-free pure functions** — each reads only from the TriggerContext passed in. No async, no DB calls, no external APIs in these first 9.

## Settings keys consumed

- `surprise.hidden_eggs_enabled` (consumed by cadence, not directly by these triggers)
- `email.drift_check_threshold` (consumed by drift-check grader, called by generateInVoice)

## Next session should know

- **SD-3+ should register the remaining 3 public triggers** that need external data: `melbourne_public_holiday` (holiday JSON), `melbourne_rain` (Open-Meteo), `public_crt_turn_off` (combined conditions).
- **Admin egg triggers** (CRT, milestone, three_wons) need activity_log queries — distinct from the pure browser-context evaluators here.
- **The ambient copy cache builder** (scheduled task `ambient_copy_generate`) should call `generateInVoice()` for each slot and write results to `ambient_copy_cache` table.
- **The Three Wons migration** from SP-9's `three-wons-egg.ts` to the `hidden_egg_fires` table is still tracked in PATCHES_OWED.md.
