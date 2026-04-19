# `PM-5` — invoke.ts System-Role Plumbing — Handoff

**Closed:** 2026-04-19
**Type:** INFRA (small)
**Model tier:** Sonnet

---

## What was done

Migrated all three inbox draft-family callers from concatenating system+user prompts into a single string to using `invokeLlmText()`'s `system` parameter (which routes to the Anthropic SDK's native `system` field).

### Files edited (3)

- `lib/graph/draft-reply.ts` — removed `combinedPrompt` concatenation, passes `system: systemPrompt` + `prompt: userPrompt` separately
- `lib/graph/compose-draft.ts` — same pattern
- `lib/graph/refine-draft.ts` — same pattern

### PATCHES_OWED marked applied (3)

- `ui_5_invoke_system_role_plumbing`
- `ui_6_invoke_system_role_plumbing_still_owed`
- `ui_7_invoke_system_role_plumbing_still_owed`

## Key decisions

1. **No other callers needed migration.** All other `invokeLlmText()` callers (lead-gen, content-engine, portal chat, invoicing, quote-builder, audit, onboarding, referral) already use the `system` parameter — they were built after the param was added. Only the three UI-5/6/7 inbox callers predated it.
2. **No test changes needed.** Tests for these modules test the prompt-builder functions (`buildDraftReplySystemPrompt`, `buildDraftReplyUserPrompt`, etc.) separately, not the concatenation pattern. The `invokeLlmText` mock captures whatever params are passed.

## What the next session should know

- The composition-layer-vs-wire-layer gap is now closed. All `invokeLlmText()` callers that have system-level content (Brand DNA, voice instructions) now route it through the Anthropic SDK's native `system` field.
- Wave 16 CCE-1 can rely on `system` being available — the precondition is met.

## Verification

- `npx tsc --noEmit` — 0 new errors (pre-existing `.next/types` duplicates only)
- `npm test` — 218 files, 1833 passed, 0 failures
- No UI changes — no browser check needed

## Rollback strategy

**Git-revertable.** Additive parameter usage only, no schema or data shape change.
