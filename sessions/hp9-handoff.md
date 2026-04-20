# HP-9 Handoff — Hiring Pipeline: Trial Task Authoring

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Trial task author prompt — `lib/ai/prompts/hiring/trial-task-author.ts`

`buildTrialTaskAuthorPrompt()` — takes candidate portfolio signal, role brief context, and available Content Engine backlog items. Instructs Sonnet to pick one backlog item, explain why it suits the candidate, and produce a concrete task description with budget and deliverable format. Returns structured JSON.

`buildTrialTaskAuthorSystem()` — creative director persona, practical assignment voice.

### Trial task authoring logic — `lib/hiring/trial-task.ts`

**`proposeTrialTask(candidateId)`** — end-to-end proposal flow:
1. Validates candidate is in `screened` stage with a linked Role Brief
2. Fetches claimable content items from Content Engine (`listClaimableContentItems`)
3. Reads candidate portfolio signal + style tags from stored JSON
4. Calls `hiring-trial-task-author` (Sonnet) with candidate + brief + backlog context
5. Parses structured JSON response, validates proposed item exists in available backlog
6. Calculates budget cap (candidate rate × hours, fallback $80/hr if no rate)
7. Returns proposal with rationale, task description, budget, deadline

**`confirmAndSendTrialTask(input)`** — confirm flow after Andy reviews the proposal:
1. Re-validates candidate is still `screened` with email
2. Atomically claims the content item via `claimInternalContentItem()`
3. Creates `trial_tasks` row with budget, rate, deadline
4. Transitions candidate to `trial` stage
5. Sends trial brief email via `sendEmail(classification: 'hiring_trial_send')`
6. Logs `candidate_trial_sent` activity
7. Enqueues `hiring_trial_task_overdue` scheduled task at `due_at + grace_days`

### Scheduled task handler — `lib/scheduled-tasks/handlers/hiring-trial.ts`

`handleHiringTrialTaskOverdue` — two-phase overdue handler:
- **First fire** (at deadline + grace): logs overdue activity, enqueues final fire +2 days
- **Final fire** (at deadline + grace + 2): auto-archives candidate with `didnt_deliver` reason, sets trial task disposition to `archived`

Guards: skips if task already delivered, disposition not pending, or candidate no longer in trial stage.

### Server actions — `app/lite/admin/hiring/actions.ts`

- **`proposeTrialTaskAction(candidateId)`** — calls `proposeTrialTask()`, returns proposal for UI rendering
- **`confirmTrialTaskAction(...)`** — calls `confirmAndSendTrialTask()`, returns trial task ID

## New files

- `lib/ai/prompts/hiring/trial-task-author.ts`
- `lib/hiring/trial-task.ts`
- `lib/scheduled-tasks/handlers/hiring-trial.ts`
- `tests/hp9-trial-task.test.ts` (21 tests)

## Edited files

- `lib/db/schema/scheduled-tasks.ts` — added `hiring_trial_task_overdue` task type
- `lib/scheduled-tasks/handlers/index.ts` — registered `HIRING_TRIAL_HANDLERS`
- `lib/hiring/index.ts` — barrel export for trial-task module
- `app/lite/admin/hiring/actions.ts` — added trial task actions

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 244 files, 2282 passed, 1 skipped (pre-existing)
- Browser check: not applicable (LLM + email require live keys; validated via typecheck + 21 new tests)

## Key decisions

- **Two-phase overdue** — first fire logs + warns, final fire auto-archives. Gives candidates 2 extra days after the grace period before auto-archive. Matches spec §9.3 exactly.
- **Fallback rate $80/hr** — when a candidate has no rate on file, budget cap uses $80/hr as a sensible default rather than failing. Still overridable by Andy at confirmation.
- **Company ID hardcoded to "superbad"** — Content Engine's claimable backlog requires a `companyId`. Since this is SuperBad's internal content, hardcoded is correct for v1.
- **Dynamic import in actions** — `proposeTrialTaskAction` and `confirmTrialTaskAction` use dynamic imports for `lib/hiring/trial-task` to avoid pulling the entire LLM/content-engine dependency graph into the server action module at load time.
- **JSON response parsing with markdown fence stripping** — LLMs sometimes wrap JSON in triple-backtick fences. Parser strips them before JSON.parse.

## Rollback

- Git-revertable: all new files are additive. Edits to existing files are additive (new task type in enum, new handler in registry, new barrel export, new action functions). No existing function signatures changed.

## Settings keys consumed

- `hiring.trial.delivery_deadline_days` — default 7, used for due date calculation
- `hiring.trial.delivery_grace_days` — default 3, overdue task fires at due + grace
- `hiring.trial.default_budget_cap_hours` — default 4, passed to LLM as budget suggestion

## Next session should know

- **Trial task review surface** (spec §13.3, `/lite/hiring/trials/:id`) is not built. The `trial_tasks` table + `getTrialTaskById()` + `updateTrialTask()` provide everything the UI needs. The review surface shows delivery asset + description side-by-side with notes, rating, and disposition buttons.
- **Delivery tracking** is not wired. When a candidate replies with a delivery URL, `delivered_at_ms` and `delivery_url_or_asset` need updating. This could be manual (Andy marks delivered) or via reply-intelligence matching.
- **Trial task review disposition** (`shipped`/`archived`/`redelivered`) — updating disposition and triggering downstream effects (Content Engine re-flagging for `shipped`, candidate archive for `archived`, deadline extension for `redelivered`) is a separate HP session.
- **60-second undo on trial send** — inherits the Unified Inbox undo primitive. Not implemented at this layer.
- **Content Engine claimable-backlog UI** — the backlog surface where Andy can see/manage available trial items is a Content Engine concern, not HP-9.
