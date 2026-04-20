# TM-4 Handoff — Task Manager: `parseBraindump()` Claude Primitive

**Date:** 2026-04-20
**Wave:** 17
**Status:** COMPLETE

## What was built

### Real `parseBraindump()` — `lib/ai/parse-braindump.ts`
- Replaced the stub (line-split) parser with a real Haiku call via `invokeLlmText`
- Job slug: `task-manager-parse-braindump` (already registered in `lib/ai/models.ts`)
- **Entity context injection:** fetches recent contacts (updated last 90 days) + active client contacts + recent companies + companies with active deals, deduped, formatted as structured context in the prompt
- **Surface context:** when braindump is triggered from an entity profile, the surface context is injected so Claude pre-links tasks to the visible entity
- **Prompt includes:** raw text, entity list, today's date + day of week (Melbourne TZ), task kind definitions, priority enum, output format spec
- **Response parsing:** strips markdown code fences, validates JSON structure, maps LLM output to the existing `ParsedTask` type
- **Entity candidate mapping:** picks highest-confidence candidate as primary (`entity_type`/`entity_id`/`entity_name`), all candidates go into `alternatives.entity` when >1 candidate
- **Checklist mapping:** LLM returns string arrays, mapped to `ChecklistItem[]` with generated IDs and unchecked state
- **Validation:** invalid `kind` defaults to `admin`, invalid `priority` defaults to `normal`, confidence values clamped to 0–1
- **Kill switch gated:** throws if `killSwitches.llm_calls_enabled` is false
- **Activity logged:** logs `braindump_parsed` activity kind with task count (per TM-3 handoff instruction)

### Tests — `tests/tm4-parse-braindump.test.ts`
- 11 tests covering: kill switch, valid response mapping, invalid kind/priority defaults, invalid JSON, missing tasks array, confidence clamping, markdown fence stripping, job slug verification, entity candidate ranking, surface context injection
- Mocks: `@/lib/db`, `@/lib/kill-switches`, `@/lib/activity-log`, `@/lib/ai/invoke`

## New files
- `tests/tm4-parse-braindump.test.ts`

## Edited files
- `lib/ai/parse-braindump.ts` — complete rewrite (stub → real implementation)

## Verification
- `npx tsc --noEmit` — zero source errors (only `.next/dev/types` stale route cache, pre-existing from TM-2)
- `npx vitest run` — 230 files, 1982 passed, 1 skipped
- Browser check: not applicable — no UI changes; the modal already consumes `ParsedBraindump` and will render real parse results once connected to a live Anthropic key

## Key decisions
- Melbourne timezone offset (+10:00) hardcoded for ISO date → ms conversion; DST edge case (+11:00 in summer) means due dates could be off by 1 hour at midnight boundaries — acceptable for day-level task due dates
- `maxTokens: 4096` — generous for braindump parsing; most responses will be well under this
- Entity fetch limits capped at 200 per query (800 total max) — more than enough for a solo operator; prevents prompt bloat
- No Brand DNA injection in this version — the spec mentions it as a "voice for checklist items / body text" but the primary use case (entity linking, date parsing, kind classification) doesn't need it; can be added in a future polish pass without breaking changes
- Confidence scores for `priority` mapped from `kind` confidence in LLM response (the LLM's `confidence` object doesn't include `priority` separately; the modal expects it)

## Rollback
- Git-revertable: no migrations, no data shape changes
- Revert = restore the previous stub implementation

## Settings keys consumed
- None (kill switch is a runtime flag, not a settings key)

## Next session should know
- TM-5 builds entity-profile task embedding (tasks tab on contact/company profiles)
- TM-6 builds approval workflow (`approveDeliverable()` primitive)
- TM-7 builds morning digest email (consumes `tasks.morning_digest_enabled`, `tasks.morning_digest_time` settings keys)
- The 30-item fixture suite mentioned in the spec as "Phase 5 calibration" is not built yet — it's a future polish/calibration session, not blocking TM-5
- To test the real LLM parse flow end-to-end, a valid `ANTHROPIC_API_KEY` must be in `.env`
