# HP-11 Handoff — Hiring Pipeline: Invite Follow-up Check Handler + Reply Intelligence Routing

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Follow-up reply check handler — `lib/scheduled-tasks/handlers/hiring-followup-check.ts`

Scheduled task handler `hiring_invite_followup_check`. Fires after `hiring.apply.followup_reply_wait_days` (default 7). Checks if the candidate is still in `applied` stage with `followup_status = 'pending'`. If so, sets `followup_status = 'no_reply'` and logs activity. Skips gracefully if candidate already replied, moved stage, or doesn't exist.

### Follow-up check task enqueue — `lib/hiring/apply.ts`

After `generateAndSendFollowup()` sends the follow-up question email, it now enqueues `hiring_invite_followup_check` with the candidate ID, scheduled for `followup_reply_wait_days` in the future. Uses `settings.get("hiring.apply.followup_reply_wait_days")` — no literals.

### Reply intelligence dispatcher — `lib/hiring/reply-intelligence.ts`

Full reply classification + dispatch module per spec §8.4 and §7.2:

**`classifyHiringReply(replyBody, context)`** — LLM-based classifier (Haiku via `hiring-reply-classify` job). Returns one of: `positive`, `objection`, `question`, `negative`, `auto_responder`. Falls back to `question` (safest route to Andy) on LLM failure or invalid response. Respects `llm_calls_enabled` kill switch.

**`routeHiringReply(input)`** — dispatches based on thread classification:

- **`hiring_followup_question` thread** — stores reply text on candidate record, sets `followup_status = 'replied'`, logs activity. No LLM call needed — any reply is the answer.
- **`hiring_invite` thread** — classifies via LLM, then dispatches:
  - `positive` → sends apply-form link via in-thread reply email
  - `negative` → auto-archives with `they_withdrew` direction + `they_declined` reason code
  - `objection` / `question` → logs activity, routes to Andy queue in Unified Inbox
  - `auto_responder` → ignored, no side effects

## New files

- `lib/hiring/reply-intelligence.ts`
- `lib/scheduled-tasks/handlers/hiring-followup-check.ts`
- `tests/hp11-followup-check-reply-intelligence.test.ts` (21 tests)

## Edited files

- `lib/db/schema/scheduled-tasks.ts` — added `hiring_invite_followup_check` task type (comment updated: 4 → 5 hiring tasks)
- `lib/scheduled-tasks/handlers/index.ts` — imported + spread `HIRING_FOLLOWUP_CHECK_HANDLERS`
- `lib/hiring/apply.ts` — enqueue followup check task after sending follow-up email
- `lib/hiring/index.ts` — barrel export for reply-intelligence module
- `lib/ai/models.ts` — registered `hiring-reply-classify` job (Haiku), comment updated: 8 → 9

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 246 files, 2320 passed, 1 skipped (pre-existing)
- Browser check: not applicable (LLM + email require live keys; validated via typecheck + 21 new tests)

## Key decisions

- **Haiku for reply classification** — cost-efficient, the classification is simple intent detection. Matches the spec's recommendation for `hiring-followup-question-draft`.
- **Safe fallback to 'question'** — on any LLM failure, invalid response, or kill switch, defaults to routing to Andy queue. False signal (Andy sees a reply he didn't need to) is cheaper than a false silence (positive reply gets ignored).
- **Followup question replies bypass LLM classification** — any reply on a `hiring_followup_question` thread is stored directly. The content IS the answer; classifying it is wasted cost.
- **Reply body capped at 5000 chars** — for `application_followup_reply` storage. LLM prompt also caps input at 2000 chars.
- **Apply link uses `NEXT_PUBLIC_APP_URL`** — the positive-reply auto-response links to `/apply` on the configured app URL.

## Rollback

- Git-revertable: all new files are additive. Edits to existing files are additive (new task type in enum, new handler in registry, new barrel export, new enqueue call, new model registry entry). No existing function signatures changed.

## Settings keys consumed

- `hiring.apply.followup_reply_wait_days` — default 7, used for followup check task scheduling

## Next session should know

- **Unified Inbox integration** — `routeHiringReply()` is built but not yet wired into the Unified Inbox sync pipeline (`lib/graph/sync.ts`). The sync pipeline needs to detect inbound messages on `hiring_invite` or `hiring_followup_question` threads (via email tags or thread metadata) and call `routeHiringReply()`. This is a cross-feature integration that may belong in a later HP session or a Unified Inbox patch session.
- **Andy queue surfacing** — objection/question replies log activity but the "route to Andy queue" is currently just the activity log. The Unified Inbox's existing focus/priority system handles surfacing, but explicit thread-level flagging (e.g. setting thread priority to signal) may be needed.
- **Apply form route** — `/apply` page is not yet built. It's a separate HP session (spec §7).
- **60-second undo** — inherits the Unified Inbox undo primitive for the apply-link auto-reply. Not implemented at this layer.
