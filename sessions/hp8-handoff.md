# HP-8 Handoff — Hiring Pipeline: Invite Send Gate (Confidence-Gated Auto-Send)

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Invite drafts schema — `lib/db/schema/invite-drafts.ts`

New `invite_drafts` table persisting every invite draft (both auto-sent and queued). Fields: id, candidate_id (FK), role_brief_id (FK), subject, body, confidence (0–1), drift_check_score, drift_check_pass, status (pending_review/sent/expired), hold_reason (low_confidence/daily_cap/candidate_throttle/cross_role_cap/drift_check_failed), sent_at_ms, email_message_id, created_at_ms, updated_at_ms. Indexed on candidate_id, role_brief_id, status+created_at_ms.

### Invite gate logic — `lib/hiring/invite-gate.ts`

`evaluateInviteSendGate()` — pure decision function per spec §8.2. Checks in order:

1. `hiring.invite.auto_send_enabled` — master toggle
2. Confidence threshold — uses `hiring.invite.auto_send_confidence_threshold` (0.85) for contractors, `hiring.invite.ft_auto_send_confidence_threshold` (0.95) for employees
3. Daily cap per role — `hiring.invite.daily_send_cap_per_role` (3) — counts sent drafts today for the same role_brief_id
4. Per-candidate throttle — `hiring.invite.per_candidate_throttle_days` (90) — checks same candidate + role within window
5. Cross-role annual cap — `hiring.invite.cross_role_max_per_candidate_per_year` (3) — counts all sent to candidate this year

Returns `{ autoSend: boolean, holdReason: string | null }`.

### Send invite module — `lib/hiring/send-invite.ts`

**`processInviteDraft()`** — end-to-end flow: drift check → gate evaluation → auto-send or queue.
- Runs `checkBrandVoiceDrift()` against SuperBad's voice profile before the gate
- If drift fails → queues with `drift_check_failed` hold reason
- If gate passes → sends via `sendEmail()` with `hiring_invite` classification → transitions candidate to Invited → persists draft as sent
- If gate fails → persists draft as pending_review with the specific hold reason

**`sendInviteDraft(draftId, by)`** — manual send path for Andy. Reads draft from DB, validates candidate has email, sends, transitions stage, updates draft status.

### Scheduled task handler — `lib/scheduled-tasks/handlers/hiring-invite.ts`

`handleHiringInviteSend` — gated by `outreach_send_enabled` kill switch. Reads `draft_id` from task payload, calls `sendInviteDraft()`. Registered as `HIRING_INVITE_HANDLERS` in the handler registry.

### Updated actions — `app/lite/admin/hiring/actions.ts`

- **`quickAddCandidateAction()`** — now runs the invite through `processInviteDraft()` after drafting. Returns new fields: `inviteDraftId`, `inviteAutoSent`, `inviteHoldReason`.
- **`confirmQuickAddInviteAction(candidateId, draftId?)`** — accepts optional `draftId`. When provided, sends via `sendInviteDraft()` instead of bare stage transition. Backwards compatible.
- **`sendInviteDraftAction(draftId)`** — new action for manual send from Drafts queue.
- **`expireInviteDraftAction(draftId)`** — new action to mark a draft as expired (Andy decided not to send).

### Invite draft queries — `lib/hiring/queries.ts`

- `getInviteDraftById(id)` — single draft lookup
- `listInviteDrafts(filter?)` — filterable by status, candidateId, roleBriefId. Ordered by created_at_ms desc.

## New files

- `lib/db/schema/invite-drafts.ts`
- `lib/hiring/invite-gate.ts`
- `lib/hiring/send-invite.ts`
- `lib/scheduled-tasks/handlers/hiring-invite.ts`
- `tests/hp8-invite-gate.test.ts` (22 tests)

## Edited files

- `lib/db/schema/index.ts` — added invite-drafts export
- `lib/db/schema/scheduled-tasks.ts` — added `hiring_invite_send` task type
- `lib/scheduled-tasks/handlers/index.ts` — registered `HIRING_INVITE_HANDLERS`
- `lib/hiring/index.ts` — barrel export for invite-gate + send-invite
- `lib/hiring/queries.ts` — added invite draft query helpers
- `app/lite/admin/hiring/actions.ts` — updated Quick-Add flow + new actions

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 243 files, 2261 passed, 1 skipped (pre-existing)
- Browser check: not applicable (email send + LLM require live keys; validated via typecheck + 22 new tests covering gate logic, process flow, manual send, handler, schema, edge cases)

## Key decisions

- **Draft persistence over in-memory** — invite drafts are persisted to `invite_drafts` table immediately, even for auto-sends. This enables: Drafts queue UI (HP future), audit trail, rate limit queries against historical sends.
- **Drift check runs before gate** — a draft that fails voice check is queued regardless of confidence. This prevents brand-damaging auto-sends.
- **Gate checks are ordered by cost** — cheapest checks first (settings lookups) before DB queries (daily cap, throttle, annual cap).
- **Hold reason is first-failure** — the gate returns the first failing check as the hold reason. Multiple holds don't accumulate (the first one is the user-facing explanation).
- **Kill switch alignment** — handler uses `outreach_send_enabled` (same as `sendEmail()` gate for non-transactional), not a separate hiring-invite switch. This matches the email classification gating model.
- **Backwards-compatible confirmQuickAddInviteAction** — accepts optional draftId parameter so existing UI code (HP-3/HP-4 kanban) continues to work without changes.

## Rollback

- Git-revertable: all new files are additive. Edits to existing files are additive (new task type in enum, new handler in registry, new barrel export, new query helpers, new action functions). No existing function signatures changed (confirmQuickAddInviteAction's new param is optional). QuickAddResult interface has new optional-feeling fields but callers would need updating — revert is safe.

## Settings keys consumed

- `hiring.invite.auto_send_enabled` — master toggle for auto-send
- `hiring.invite.auto_send_confidence_threshold` — contractor threshold (0.85)
- `hiring.invite.ft_auto_send_confidence_threshold` — employee threshold (0.95)
- `hiring.invite.daily_send_cap_per_role` — per-role daily ceiling (3)
- `hiring.invite.per_candidate_throttle_days` — same-candidate cooldown (90)
- `hiring.invite.cross_role_max_per_candidate_per_year` — annual anti-spam (3)
- `email.drift_check_threshold` — consumed indirectly via `checkBrandVoiceDrift()`

## Next session should know

- **Drafts queue UI** (spec §13.4) is not built in this session. The `invite_drafts` table + `listInviteDrafts()` + `sendInviteDraftAction()` + `expireInviteDraftAction()` provide everything the UI needs. The UI session should query `listInviteDrafts({ status: ['pending_review'] })` and render each with confidence chip + hold reason chip.
- **Discovery auto-invite** is not wired. HP-6 noted that `auto_invite_score_threshold` gate belongs to the invite pipeline. When discovery surfaces a candidate scoring ≥ threshold, it should call `draftInviteEmail()` + `processInviteDraft()`. This needs a small integration in `lib/hiring/discovery/agent.ts` — the candidate must have an email for auto-invite to fire.
- **Reply intelligence** (spec §8.4) is not built. Positive replies routing to candidate state change is a separate HP session.
- **60-second undo on auto-sends** (spec §8.2) is noted but not implemented. It inherits the Unified Inbox undo primitive which is UI-side, not backend.
- **The `invite_drafts` table needs a Drizzle migration.** The schema file exists but `drizzle-kit generate` + `drizzle-kit migrate` should run before the dev server can use it. This is standard Phase 5 migration procedure.
