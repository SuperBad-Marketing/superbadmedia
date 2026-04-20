# CCE-1 Handoff — Client Context Engine: Data Model + Core Functions

**Date:** 2026-04-20
**Wave:** 16
**Status:** COMPLETE

## What was built

- **`context_summaries` table** (`lib/db/schema/context-summaries.ts`):
  - One row per contact (unique `contact_id`)
  - Nullable `conversation_summary` + `summary_generated_at_ms` for Haiku-generated narrative
  - Nullable `draft_content`, `draft_channel`, `draft_nudge_history`, `draft_generated_at_ms` for unsent draft persistence

- **`action_items` table** (`lib/db/schema/action-items.ts`):
  - Dedicated table for auto-extracted and manual commitments
  - `owner` enum: `you` / `them`; `source` enum: `claude_extract` / `manual`
  - `status` enum: `open` / `done` / `dismissed` (soft status, dismissed preserved for audit)
  - Indexed by `(contact_id, status)` and `(owner, status, due_date_ms)`

- **`llm_usage_log` table** (`lib/db/schema/llm-usage-log.ts`):
  - Per-call token tracking: `call_type`, `contact_id`, `model`, `input_tokens`, `output_tokens`
  - Indexed by `(call_type, created_at_ms)` and `contact_id`

- **`preferred_channel` column on `contacts`** — enum `email` (later `sms`), default `email`, NOT NULL

- **Migration `0055_cce1_context_engine.sql`** — all schema changes in one migration

- **`lib/context-engine/` module** (7 files):
  - `assemble.ts` — `assembleContext(contactId, purpose)` with overloads for `summary`, `draft`, and `extraction` purposes. Queries `messages`, `threads`, `activity_log`, `action_items`, `deals`, `invoices`, `brand_dna_profiles`, `companies`, `contacts`, `context_summaries`, `active_strategies`. No import from `lib/private-notes/`.
  - `health.ts` — `computeHealthScore(contactId)` → `{ score: 0-100, label }`. Five weighted factors: recency (40), your overdue items (20), their overdue items (10), deal stage velocity (15), outstanding invoices (15). Pure SQL/arithmetic, no Claude call.
  - `signals.ts` — `getSignalsForContact(contactId)` → typed `SignalSet` object per spec §9.1. `getSignalsForAllContacts()` → batch variant. Both computed on read.
  - `action-items.ts` — `getActionItems(contactId, filters?)`, `createActionItem()`, `completeActionItem()`, `dismissActionItem()`, `editActionItem()`. All mutations logged via `logActivity()`.
  - `summary.ts` — `getContextSummary(contactId)`, `upsertContextSummary()`, `ensureContextSummaryRow()`.
  - `usage-log.ts` — `logLlmUsage()` writes to `llm_usage_log`.
  - `enqueue.ts` — `enqueueContextSummaryRegenerate()` with deduplication check, `enqueueActionItemExtract()` with per-message idempotency.
  - `index.ts` — barrel re-export.

- **Scheduled task handler stubs** (`lib/scheduled-tasks/handlers/context-engine.ts`):
  - `handleContextSummaryRegenerate` — validates payload, gates on `llm_calls_enabled` kill switch. Body stubbed for CCE-2.
  - `handleContextActionItemExtract` — validates payload, gates on `llm_calls_enabled`. Body stubbed for CCE-2.
  - Registered in `lib/scheduled-tasks/handlers/index.ts` as `CONTEXT_ENGINE_HANDLERS`.

## New files

- `lib/db/schema/context-summaries.ts`
- `lib/db/schema/action-items.ts`
- `lib/db/schema/llm-usage-log.ts`
- `lib/db/migrations/0055_cce1_context_engine.sql`
- `lib/context-engine/assemble.ts`
- `lib/context-engine/health.ts`
- `lib/context-engine/signals.ts`
- `lib/context-engine/action-items.ts`
- `lib/context-engine/summary.ts`
- `lib/context-engine/usage-log.ts`
- `lib/context-engine/enqueue.ts`
- `lib/context-engine/index.ts`
- `lib/scheduled-tasks/handlers/context-engine.ts`
- `tests/cce1-context-engine.test.ts` (28 tests)

## Edited files

- `lib/db/schema/contacts.ts` — added `CONTACT_PREFERRED_CHANNELS` enum + `preferred_channel` column
- `lib/db/schema/index.ts` — registered 3 new schema exports
- `lib/scheduled-tasks/handlers/index.ts` — registered `CONTEXT_ENGINE_HANDLERS`
- `lib/db/migrations/meta/_journal.json` — added migration 0055 entry
- `tests/cm1-contacts-columns.test.ts` — added `preferred_channel` to mock ContactRow
- `tests/inbox-conversation-view.test.tsx` — added `preferred_channel` to mock contact factory

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 226 files, 1895 passed, 1 skipped (unchanged)

## Key decisions

- `active_strategies` and `private_notes` tables already existed (built by SWP and CM waves) — not recreated
- Handler stubs gate on `llm_calls_enabled` kill switch (spec says no dedicated CCE kill switch in v1; LLM gate is sufficient)
- `assembleContext` `extraction` purpose returns a minimal `ExtractionContext` (just message body + direction) — no DB queries needed
- `computeHealthScore` uses 5 weighted factors summing to 100, with deterministic label thresholds at 75/50/25
- `enqueueContextSummaryRegenerate` uses `idempotency_key` pattern matching the enqueueTask contract plus a status+type check for dedup
- Module boundary enforced: `lib/context-engine/` has zero imports from `lib/private-notes/` — tested in suite

## Rollback

- Migration reversible: `DROP TABLE context_summaries; DROP TABLE action_items; DROP TABLE llm_usage_log;` + `ALTER TABLE contacts DROP COLUMN preferred_channel` (SQLite 3.35+)
- Handler stubs are no-ops when `llm_calls_enabled` is off

## Next session should know

- CCE-2: Wire up `handleContextSummaryRegenerate` (call `assembleContext('summary')` → `invokeLlmTextWithMeta` with `client-context-summarise` job → `upsertContextSummary` → `logLlmUsage` → `logActivity`)
- CCE-2: Wire up `handleContextActionItemExtract` (fetch message → `assembleContext('extraction')` → `invokeLlmTextWithMeta` with `client-context-extract-action-items` job → parse JSON → `createActionItem` for each → `logLlmUsage`)
- CCE-2: Implement event-to-section mapping + deduplication logic
- The prompt files at `lib/ai/prompts/client-context-engine.md` should be read for the prompt text
