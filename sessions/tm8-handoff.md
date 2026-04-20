# TM-8 Handoff — Task Manager: Morning Digest Cron Handler

**Date:** 2026-04-20
**Wave:** 17
**Status:** COMPLETE

## What was built

### Cron handler — `lib/scheduled-tasks/handlers/task-morning-digest.ts`
- `handleTaskMorningDigest()` — the scheduled task handler, triple-gated:
  1. `killSwitches.tasks_digest_enabled` (hard gate, no self-perpetuation)
  2. `settings.get("tasks.morning_digest_enabled")` (soft gate, no self-perpetuation)
  3. `hasAdminSignedInToday(nowMs)` (skip send but self-perpetuate)
- On pass: calls `buildTaskDigestContent()` → if content, `sendTaskDigestEmail()` → if sent, `logActivity()` with `task_digest_sent` kind
- Always self-perpetuates at end (except when kill switch or settings gate kills early)
- `ensureTaskDigestEnqueued(nowMs?)` — idempotent bootstrap, reads `tasks.morning_digest_time` setting, computes next Melbourne wall-clock run via DST-safe helpers
- `nextTaskDigestMs(nowMs)` — parses HH:MM from `tasks.morning_digest_time` setting, uses Melbourne timezone helpers (same pattern as inbox-digest.ts)
- `parseDigestHour(timeStr)` — extracts hour from "HH:MM" string, falls back to 8 on parse failure
- `TASK_DIGEST_TASK_KEY_PREFIX` — idempotency key prefix for scheduled task dedup

### Handler registration
- `TASK_DIGEST_HANDLERS` exported and spread into `HANDLER_REGISTRY` in `lib/scheduled-tasks/handlers/index.ts`

### Tests — `tests/tm8-task-morning-digest-handler.test.ts`
- 14 tests covering: kill switch gate (early return, no enqueue), settings gate (early return), admin-signed-in gate (skip send, still enqueue), nothing-to-report gate (skip send, still enqueue), happy path (send + log + enqueue), send failure (no log, still enqueue), approval outcomes in log body, ensureTaskDigestEnqueued (task type, idempotency key prefix, future runAt, settings-driven hour), TASK_DIGEST_TASK_KEY_PREFIX existence, handler export shape, index.ts source verification

## New files
- `lib/scheduled-tasks/handlers/task-morning-digest.ts`
- `tests/tm8-task-morning-digest-handler.test.ts`

## Edited files
- `lib/scheduled-tasks/handlers/index.ts` — import + spread TASK_DIGEST_HANDLERS

## Verification
- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 234 files, 2040 passed, 1 skipped
- Browser check: not applicable (cron handler, no UI)

## Key decisions
- Melbourne timezone helpers duplicated locally (same as inbox-digest.ts and digest.ts) rather than extracting to shared utility — consistent with TM-7's decision, extraction is a polish item
- Kill switch and settings gate both return without self-perpetuating — if the feature is fully off, no point enqueuing the next run. Admin-sign-in gate does self-perpetuate because the feature is still on, just skipping today's email
- `parseDigestHour` extracts only the hour (ignoring minutes) to match the inbox-digest pattern of scheduling at the top of the hour
- Handler index registration test verifies source file content rather than importing the full registry (avoids transitive Resend SDK constructor in test env)

## Pre-existing issues noted
- `.next/dev/types` stale route cache warnings persist from TM-2 — not caused by TM-8
- 1 test skipped (pre-existing) across the full suite

## Rollback
- Git-revertable: no schema migrations, no data shape changes
- All new files are additive; edited file has narrow, reversible change

## Settings keys consumed
- `tasks.morning_digest_enabled` (boolean, gate)
- `tasks.morning_digest_time` (string "HH:MM", scheduling)

## Next session should know
- TM-9 is the final Task Manager session
- `ensureTaskDigestEnqueued()` is the bootstrap entry point — should be called once during initial setup (e.g. admin wizard completion or first admin sign-in) to seed the first scheduled run
- The digest handler is now fully wired: TM-7's content builder + sender → TM-8's cron handler → self-perpetuating schedule
- Melbourne timezone helpers are duplicated in three places (inbox-digest.ts, digest.ts, task-morning-digest.ts) — extracting to a shared `lib/time/melbourne.ts` is a polish item
