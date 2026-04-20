# TM-6 Handoff — Task Manager: Approval Workflow

**Date:** 2026-04-20
**Wave:** 17
**Status:** COMPLETE

## What was built

### Canonical `lib/tasks/approve.ts` — single approval primitive per spec §25
- `approveDeliverable(taskId, contactId, decision, feedback?)` — the ONLY code path for deliverable approval
- Validates: task exists, kind is `client_deliverable`, status is `awaiting_approval`, feedback required on reject
- On approve: transitions to `delivered`, clears token, logs `task_approved` activity, fires outcome email to Andy
- On reject: transitions to `in_progress`, stores feedback, clears token, logs `task_rejected` activity, creates rejection thread+message in comms inbox (`task_feedback` channel), fires outcome email to Andy
- Idempotent: repeat approve/reject with same caller returns cached result, no duplicate downstream effects

### Approval token lifecycle
- `generateApprovalToken()` — returns `{ raw, hash }` (SHA-256)
- `hashApprovalToken(raw)` — one-way hash for lookups
- `issueApprovalToken(taskId, contactId)` — stores hashed token on the task row, sets `approval_requested_at_ms`, fires approval request email to contact, enqueues 48h reminder scheduled task, logs `task_approval_requested` activity
- `validateApprovalToken(raw)` — looks up by hash, checks task is still `awaiting_approval`, checks TTL expiry via `settings.get('tasks.deliverable_approval_token_ttl_days')`, marks `approval_viewed_at_ms` on first view
- Tokens are one-time-use (cleared on approve/reject), hashed at rest, bound to `contact_id` + `task_id`

### Token-based approval route — `/lite/portal/approve/[token]`
- `app/lite/portal/approve/[token]/page.tsx` — server component validates token, renders expired/invalid message or `ApprovalCard`
- `app/lite/portal/approve/[token]/actions.ts` — server actions `handleTokenApprove` + `handleTokenReject` that validate token then call `approveDeliverable()`
- `components/lite/portal/approval-card.tsx` — client component with approve/reject buttons, rejection feedback textarea, success/error states, matches existing portal design system (brand colours, fonts, motion)

### 48h reminder handler
- `lib/scheduled-tasks/handlers/deliverable-approval-reminder.ts` — registered in worker handler index
- `handleApprovalReminder()` in approve.ts — skips if task already viewed or no longer `awaiting_approval`
- Reminder email uses `deliverable_approval_reminder` classification (non-transactional, respects quiet window)

### Status transition wiring
- `app/lite/tasks/actions.ts` `transitionTaskAction` — when transitioning to `awaiting_approval`, automatically looks up client's primary contact and issues an approval token + email

### Email classifications (3 new)
- `deliverable_approval_request` — transactional (instant, bypasses quiet window)
- `deliverable_approval_reminder` — non-transactional (respects quiet window)
- `deliverable_approval_outcome` — transactional (instant outcome to Andy)

### Settings keys (3 new)
- `tasks.deliverable_approval_token_ttl_days` — default 14 (integer)
- `tasks.morning_digest_enabled` — default true (boolean, for TM-7)
- `tasks.morning_digest_time` — default "08:00" (string, for TM-7)

### Portal refactor
- `lib/tasks/portal.ts` — removed old `approveDeliverable()` and `rejectDeliverable()` stubs; now only exports `getTasksForClientPortal()` with `PortalTask` typing
- `app/lite/portal/[token]/deliverables/actions.ts` — refactored to route through canonical `approveDeliverable()` from `lib/tasks/approve`
- Removed `getTaskByApprovalToken()` from `lib/tasks/queries.ts` (superseded by `validateApprovalToken()` with proper hash + expiry)

### Tests — `tests/tm6-approval-workflow.test.ts`
- 18 tests covering: approve happy path, reject with feedback, reject without feedback, non-existent task, non-deliverable kind, wrong status, idempotent approve, idempotent reject, outcome email, token generation, token hashing, token validation (expired, valid, not found), issueApprovalToken flow, reminder handler (skip when viewed, skip when no longer awaiting, send when unviewed)

## New files
- `lib/tasks/approve.ts`
- `lib/scheduled-tasks/handlers/deliverable-approval-reminder.ts`
- `lib/db/migrations/0057_tm6_approval_settings.sql`
- `app/lite/portal/approve/[token]/page.tsx`
- `app/lite/portal/approve/[token]/actions.ts`
- `components/lite/portal/approval-card.tsx`
- `tests/tm6-approval-workflow.test.ts`

## Edited files
- `lib/channels/email/classifications.ts` — 3 new classifications + 2 transactional
- `lib/settings.ts` — 3 new Task Manager keys
- `lib/db/schema/scheduled-tasks.ts` — 2 new task types
- `lib/scheduled-tasks/handlers/index.ts` — registered approval reminder handler
- `lib/tasks/portal.ts` — removed old approve/reject stubs
- `lib/tasks/queries.ts` — removed `getTaskByApprovalToken`
- `app/lite/tasks/actions.ts` — wired approval token issuance on `awaiting_approval` transition
- `app/lite/portal/[token]/deliverables/actions.ts` — route through canonical function
- `docs/settings-registry.md` — added Task Manager section (3 keys), updated totals to 100/152
- `tests/settings.test.ts` — updated seed count from 149 to 152

## Verification
- `npx tsc --noEmit` — zero source errors (only `.next/dev/types` stale route cache, pre-existing from TM-2)
- `npx vitest run` — 232 files, 2006 passed, 1 skipped
- Browser check: approval route renders 200, tasks page redirects correctly, login page loads

## Key decisions
- `sendEmail` imported lazily via dynamic `import()` inside `lazySendEmail()` wrapper to prevent Resend SDK constructor from firing at module load time during tests
- Approval token uses SHA-256 hash (same pattern as `lib/auth/subscriber-magic-link.ts`)
- Rejection creates an inbox thread with `channel_of_origin: "task_feedback"` — surfaces Andy's attention via the unified inbox
- Outcome emails to Andy fire with `void` (fire-and-forget) on approve, `await` on reject (reject has more downstream effects)
- `lib/tasks/index.ts` barrel does NOT re-export `approve.ts` — consumers import directly to avoid transitive Resend SDK load in test contexts
- 48h reminder uses a `/lite/portal/approve/recover` URL instead of re-sending the raw token for security (token links are one-time sensitive)

## Pre-existing issues noted
- `.next/dev/types` stale route cache warnings persist from TM-2 — not caused by TM-6
- 1 test skipped (pre-existing) across the full suite

## Rollback
- Git-revertable: no schema migrations (settings seeds use INSERT OR IGNORE, additive only)
- All new files are additive; edited files have narrow, reversible changes
- Feature is approval-flow-only — no other task features depend on it yet

## Settings keys consumed
- `tasks.deliverable_approval_token_ttl_days` (this session)
- `tasks.morning_digest_enabled` (seeded for TM-7, not consumed yet)
- `tasks.morning_digest_time` (seeded for TM-7, not consumed yet)

## Next session should know
- TM-7 builds morning digest email (consumes `tasks.morning_digest_enabled`, `tasks.morning_digest_time`)
- TM-8 builds the morning digest cron handler (`task_morning_digest` scheduled task type already registered)
- TM-9 is the final Task Manager session
- The `deliverable_approval_reminder` URL currently points to `/lite/portal/approve/recover` — the portal recovery flow handles re-authentication. If a dedicated "enter your email to get a new approval link" flow is desired, that's a polish item
- The `approval_viewed_at_ms` column is now written on first token validation — the reminder handler uses this to skip already-viewed approvals
