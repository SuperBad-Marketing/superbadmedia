# CCE-2 Handoff — Summary Regen + Action-Item Extraction + Event Map

**Date:** 2026-04-20
**Wave:** 16
**Status:** COMPLETE

## What was built

- **`handleContextSummaryRegenerate` fully wired** (`lib/scheduled-tasks/handlers/context-engine.ts`):
  - Calls `assembleContext(contactId, 'summary')` to gather full contact context
  - Formats via `formatSummaryPrompt()` → system + prompt
  - Invokes `invokeLlmTextWithMeta` with `client-context-summarise` job (Haiku)
  - `upsertContextSummary()` persists the generated narrative
  - `logLlmUsage()` records token usage with `summary_regeneration` type
  - `logActivity()` records `context_summary_regenerated` event

- **`handleContextActionItemExtract` fully wired** (`lib/scheduled-tasks/handlers/context-engine.ts`):
  - Fetches message from DB by `message_id`
  - Calls `assembleContext(contactId, 'extraction', bodyText, direction)`
  - Fetches existing open action items for dedup (spec §19.2)
  - Formats via `formatExtractionPrompt()` → system + prompt with dedup context
  - Invokes `invokeLlmTextWithMeta` with `client-context-extract-action-items` job (Haiku)
  - Parses JSON response with Zod validation per item, skips invalid entries
  - Calls `createActionItem()` for each valid extraction
  - `logLlmUsage()` records token usage with `action_item_extraction` type

- **Prompt formatting module** (`lib/context-engine/prompts.ts`):
  - `formatSummaryPrompt(ctx)` — assembles system instruction (flat factual, 2-4 sentences) + structured user prompt from contact, company, deal, invoices, action items, brand DNA, activity, messages
  - `formatExtractionPrompt(ctx, existingItems)` — assembles system instruction with direction-aware ownership rules + user prompt with existing items for dedup
  - Both apply a ~4k/~2k token cap via character-based truncation

- **Event-to-section mapping** (`lib/context-engine/event-map.ts`):
  - Typed `MaterialEventType` union: `new_inbound_message`, `new_outbound_message`, `deal_stage_change`, `action_item_completed`
  - `handleMaterialEvent()` dispatches to correct enqueue functions per spec §4.2: message events → extraction + summary; stage/action-item events → summary only
  - Exported from barrel `lib/context-engine/index.ts`

## New files

- `lib/context-engine/prompts.ts`
- `lib/context-engine/event-map.ts`
- `tests/cce2-context-engine-handlers.test.ts` (21 tests)

## Edited files

- `lib/scheduled-tasks/handlers/context-engine.ts` — stubs replaced with full implementation
- `lib/context-engine/index.ts` — added `handleMaterialEvent` + `MaterialEventType` exports

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 227 files, 1916 passed, 1 skipped (unchanged skip)

## Key decisions

- Summary prompt max output: 512 tokens (2-4 sentence narrative, generous ceiling)
- Extraction prompt max output: 1024 tokens (JSON array of action items, can have several)
- Extraction dedup: existing open items passed to the prompt so Haiku skips duplicates; ~200 tokens cost per spec §19.2
- JSON parsing failure (non-JSON LLM output) silently produces zero items rather than throwing — graceful degradation
- Due date parsing: ISO 8601 strings from LLM parsed via `Date.parse()`; invalid dates become `null`
- Event map is a standalone function consumers call, not auto-wired — Inbox/Pipeline/etc. call `handleMaterialEvent()` when they produce material events

## Rollback

- Git-revertable: no data shape changes, no migrations
- Handlers remain gated on `llm_calls_enabled` kill switch

## Next session should know

- CCE-3 builds the UI layer: draft drawer (Tier 2 motion), draft generation/nudge/reformat (Opus prompts), channel switcher, action items panel, profile summary tile, empty/loading states, unsent draft persistence
- CCE-3 will need to add `generateDraft`, `regenerateDraft`, `reformatDraft` functions + their prompt formatters
- The `handleMaterialEvent` function is ready for Inbox/Pipeline to call but isn't wired into those features yet (they call it when they ship)
