# HP-12 Handoff — Hiring Pipeline: Archive Reflection Ingest + Un-archive

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Archive reflection ingest — LLM-powered Role Brief feedback loop

**Prompt** — `lib/ai/prompts/hiring/archive-reflection-ingest.ts`

`buildArchiveReflectionPrompt()` takes the candidate's archive reflection text, the Role Brief's current `style_avoid_list`, and context (reason, role name, style summary). Instructs Haiku to extract 0–3 concise avoid items (≤15 words each) that aren't already covered. Returns one per line, empty if no useful signal.

**Business logic** — `lib/hiring/archive-reflection.ts`

`ingestArchiveReflection(candidateId, archiveId)`:
1. Guards: candidate exists, has role_brief_id, brief exists, archive has reflection_text
2. Calls `hiring-archive-reflection-ingest` (Haiku) via `invokeLlmText()`
3. Parses response into new items, caps at 3, filters out lines >100 chars
4. Merges into brief's `style_avoid_list_json`
5. Logs `role_brief_regenerated` activity

**Scheduled task handler** — `lib/scheduled-tasks/handlers/hiring-archive-reflection.ts`

`handleHiringArchiveReflectionIngest` — gated by `llm_calls_enabled` kill switch. Reads `candidate_id` and `archive_id` from payload, calls `ingestArchiveReflection()`.

### Archive action now enqueues reflection ingest

`archiveCandidateAction()` in `app/lite/admin/hiring/actions.ts` now enqueues `hiring_archive_reflection_ingest` (5s delay) when the archive has `reflection_text`. Uses archive row ID as idempotency key.

### Un-archive server action + kanban wiring

**Server action** — `unarchiveCandidateAction(candidateId)`:
1. Validates candidate exists and is in `archived` stage
2. Gets `stage_before_archive` (falls back to `sourced`)
3. Calls `markArchiveUnarchived()` to set `un_archived_at` on archive rows
4. Calls `transitionCandidateStage()` to restore stage (which logs `candidate_unarchived` activity)

**Kanban** — `HiringBoard` now detects drag FROM archived column. Instead of opening a modal or calling generic transition, it calls `unarchiveCandidateAction()` and optimistically updates the card to its `stage_before_archive`. Toast: "Un-archived. Back to {stage}."

`HiringCardCandidate` type + page mapping now include `stage_before_archive`.

## New files

- `lib/ai/prompts/hiring/archive-reflection-ingest.ts`
- `lib/hiring/archive-reflection.ts`
- `lib/scheduled-tasks/handlers/hiring-archive-reflection.ts`
- `tests/hp12-archive-reflection-unarchive.test.ts` (17 tests)

## Edited files

- `lib/db/schema/scheduled-tasks.ts` — added `hiring_archive_reflection_ingest` task type (5 → 6 hiring tasks)
- `lib/scheduled-tasks/handlers/index.ts` — imported + spread `HIRING_ARCHIVE_REFLECTION_HANDLERS`
- `app/lite/admin/hiring/actions.ts` — added enqueue on archive, added `unarchiveCandidateAction`, added imports
- `components/lite/hiring-pipeline/hiring-board.tsx` — un-archive drag handling, imported `unarchiveCandidateAction`
- `components/lite/hiring-pipeline/candidate-card.tsx` — added `stage_before_archive` to `HiringCardCandidate` type
- `app/lite/admin/hiring/page.tsx` — added `stage_before_archive` to card mapping
- `lib/hiring/index.ts` — barrel export for archive-reflection module

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 247 files, 2337 passed, 1 skipped (pre-existing)
- Browser check: not applicable (LLM + email require live keys; validated via typecheck + 17 new tests)

## Key decisions

- **5s delay on reflection ingest** — archive action returns immediately; LLM processing is non-blocking. 5s gives the transaction time to commit.
- **`role_brief_regenerated` activity kind** — no `role_brief_updated` kind exists in the schema; `regenerated` is the closest semantic match for content being updated via LLM.
- **Haiku for reflection ingest** — consistent with spec and model registry (already registered in HP-2). Simple extraction task.
- **Un-archive restores to `stage_before_archive`** — per spec §11.2, regardless of which column the card is dropped on. Falls back to `sourced` if no prior stage recorded.
- **No confirm modal on un-archive** — spec explicitly says "No confirm modal — reversible by design."

## Rollback

- Git-revertable: all new files are additive. Edits to existing files are additive (new task type, new handler, new action, new type field). No existing function signatures changed.

## Settings keys consumed

- None new. Uses existing `llm_calls_enabled` kill switch.

## Next session should know

- **HP-12 scope note** — the SESSION_TRACKER had an incorrect description for HP-12 ("Apply form + public route + LLM follow-up question UI") which was already built in HP-7. HP-12 was reassigned to archive completion.
- **Remaining HP sessions** — §10 Contractor portal (/bench), §14 Daily Cockpit integration, §15 Role Brief regeneration cycle, §16 sounds + motion, §17 voice & delight are the remaining unbuilt spec sections.
- **Role Brief regeneration cycle** — `ingestArchiveReflection()` appends to `style_avoid_list_json` but the full periodic brief regeneration (§6.3) that synthesizes all avoid items into the overall brief isn't built yet. That's HP-15 scope.
