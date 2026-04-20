# TM-7 Handoff — Task Manager: Morning Digest Email

**Date:** 2026-04-20
**Wave:** 17
**Status:** COMPLETE

## What was built

### Core digest module — `lib/tasks/digest.ts`
- `getOverdueTasks(nowMs)` — queries open tasks with `due_at_ms` before today's Melbourne start-of-day
- `getDueTodayTasks(nowMs)` — queries open tasks with `due_at_ms` within today's Melbourne bounds
- `getApprovalOutcomesSince(sinceMs)` — queries tasks with `approved_at_ms` or `rejected_at_ms` after the window start, joins to `contacts` for display names
- `buildTaskDigestContent(nowMs, sinceMs?)` — orchestrates all three queries, returns `null` if nothing to report (the "something to report" gate from spec)
- `sendTaskDigestEmail(content)` — sends to `ADMIN_EMAIL` with `task_morning_digest` classification
- `hasAdminSignedInToday(nowMs)` — checks `activity_log` for `admin_session_started` entries between Melbourne 00:00 and now (the "not signed in" gate from spec)
- `melbourneStartAndEndOfDay(utcMs)` — DST-safe Melbourne start/end of day calculation (exported for TM-8)
- Static dry subject line builder (e.g. "Task digest — 2 overdue, 1 due today, 1 approved.")

### HTML email body
- Three grouped sections: Overdue, Today, Approval news
- Each task line is a clickable link to `/lite/tasks?open={taskId}`
- High-priority tasks marked with `!`
- Overdue tasks show days-overdue count (e.g. "3d overdue")
- Approval outcomes show checkmark/cross icon + contact name
- Footer: "Sent because you hadn't opened Lite yet this morning. You can turn this off in Settings."
- Matches inbox digest's email styling patterns

### Email classification — `task_morning_digest`
- Added to `EMAIL_CLASSIFICATIONS` in `lib/channels/email/classifications.ts`
- Added to `TRANSACTIONAL_CLASSIFICATIONS` (operational email to admin, bypasses quiet window + outreach kill switch)

### Kill switch — `tasks_digest_enabled`
- Added to `lib/kill-switches.ts`, defaults to `false`
- TM-8 handler will gate on this

### Activity log — admin sign-in tracking
- Added `admin_session_started` kind to `ACTIVITY_LOG_KINDS`
- Added `task_digest_sent` kind to `ACTIVITY_LOG_KINDS`
- Wired `admin_session_started` logging in `lib/auth/auth.ts` NextAuth `events.signIn` callback — fires on every admin sign-in (role check), fire-and-forget via `void`

### Tests — `tests/tm7-task-morning-digest.test.ts`
- 20 tests covering: null return when nothing to report, overdue tasks, due-today tasks, approval outcomes, subject line formatting, send function (happy path + missing ADMIN_EMAIL), hasAdminSignedInToday (both paths), clickable links in HTML, priority markers, overdue days count, approval icons + contact names, classification validity + transactional status, kill switch existence + default, activity log kinds, Melbourne timezone bounds

## New files
- `lib/tasks/digest.ts`
- `tests/tm7-task-morning-digest.test.ts`

## Edited files
- `lib/channels/email/classifications.ts` — 1 new classification + 1 transactional
- `lib/kill-switches.ts` — 1 new switch (`tasks_digest_enabled`)
- `lib/db/schema/activity-log.ts` — 2 new kinds (`task_digest_sent`, `admin_session_started`)
- `lib/auth/auth.ts` — import `logActivity`, added `events.signIn` callback for admin session tracking

## Verification
- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 233 files, 2026 passed, 1 skipped
- Browser check: login page 200, tasks page 307 (auth redirect, expected)

## Key decisions
- Melbourne timezone helpers duplicated from inbox-digest.ts rather than extracting to shared utility — extracting is a polish item, not in scope for TM-7
- Subject line uses static dry format (e.g. "Task digest — 2 overdue.") because `generateInVoice()` doesn't exist yet (Wave 20, SD-2)
- `hasAdminSignedInToday()` queries `activity_log` for `admin_session_started` kind — logged by NextAuth `events.signIn` callback in `lib/auth/auth.ts`
- Sign-in event fires with `void` (fire-and-forget) to avoid blocking the auth flow
- Approval outcomes window defaults to 24h lookback if `sinceMs` is not provided by the caller (TM-8 handler can pass a more precise window)
- Task links use `/lite/tasks?open={taskId}` format (same as TM-5's entity panel links)

## Pre-existing issues noted
- `.next/dev/types` stale route cache warnings persist from TM-2 — not caused by TM-7
- 1 test skipped (pre-existing) across the full suite

## Rollback
- Git-revertable: no schema migrations, no data shape changes
- All new files are additive; edited files have narrow, reversible changes
- Feature is email-content-only — no routes or UI changes

## Settings keys consumed
- None directly consumed (TM-8 will consume `tasks.morning_digest_enabled` and `tasks.morning_digest_time`)

## Next session should know
- TM-8 builds the scheduled task handler that calls `buildTaskDigestContent()` + `sendTaskDigestEmail()` + `hasAdminSignedInToday()` from this module
- TM-8 should gate on both `killSwitches.tasks_digest_enabled` and `settings.get("tasks.morning_digest_enabled")`
- TM-8 should reuse the Melbourne scheduling pattern from inbox-digest.ts (`nextMelbourneHourMs`) but read from `tasks.morning_digest_time` instead of `inbox.digest_hour`
- TM-8 should self-perpetuate (enqueue next day's run) and provide an `ensureTaskDigestEnqueued()` bootstrap
- TM-8 should log `task_digest_sent` activity kind after successful send
- `task_morning_digest` scheduled task type is already registered in `lib/db/schema/scheduled-tasks.ts`
- TM-9 is the final Task Manager session
