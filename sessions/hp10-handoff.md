# HP-10 Handoff — Hiring Pipeline: Trial Task Delivery Tracking + Review Surface

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Trial review logic — `lib/hiring/trial-review.ts`

**`markTrialTaskDelivered(input)`** — marks a pending trial task as delivered:
1. Validates task exists, disposition is `pending`, candidate is in `trial` stage
2. Sets `delivered_at_ms` + `delivery_url_or_asset`
3. Logs `candidate_trial_sent` activity with delivery URL

**`reviewTrialTask(input)`** — full review with disposition side effects:
1. Validates rating 1–5, disposition is one of shipped/archived/redelivered, task is pending
2. Updates `andy_review_notes`, `rating`, `disposition`
3. Runs disposition-specific handler:

**Disposition handlers:**
- **shipped** — logs activity. Candidate stays in `trial` stage — Bench promotion is a separate manual drag on the kanban (spec §4.3 pipeline stage table).
- **archived** — releases content item back to Content Engine pool, creates `candidate_archives` row with `we_archived` direction + `trial_not_shipped` reason, transitions candidate to `archived` stage, logs activity.
- **redelivered** — resets task to `pending` disposition, clears `delivered_at_ms` + `delivery_url_or_asset`, extends deadline by `hiring.trial.delivery_deadline_days`, enqueues new overdue scheduled task, logs activity.

### Server actions — `app/lite/admin/hiring/actions.ts`

- **`markTrialTaskDeliveredAction(trialTaskId, deliveryUrl)`** — wraps `markTrialTaskDelivered()` with admin auth + path revalidation
- **`reviewTrialTaskAction(trialTaskId, notes, rating, disposition)`** — wraps `reviewTrialTask()` with admin auth + path revalidation

### Trial task review page — `app/lite/admin/hiring/trials/[id]/page.tsx`

Server component at `/lite/admin/hiring/trials/:id`. Admin-only. Fetches trial task + candidate + role brief. Renders the `TrialReviewClient` component.

### Trial review client — `components/lite/hiring-pipeline/trial-review-client.tsx`

Full-bleed split layout per spec §13.3:
- **Left pane:** Task brief (description, budget, rate, dates, disposition badge if reviewed, overdue badge if applicable)
- **Right pane:** Delivery section + review section
  - Delivery: URL input + "Received" button (pre-delivery) or clickable link (post-delivery)
  - Review (appears after delivery): 1–5 rating buttons, notes textarea (max 1000 chars), three disposition buttons (Ship it / Request revision / Archive)
  - Post-review: shows review notes read-only

Uses `houseSpring` for entry animation + AnimatePresence for review section reveal. Design tokens consistent with content review surface pattern.

## New files

- `lib/hiring/trial-review.ts`
- `app/lite/admin/hiring/trials/[id]/page.tsx`
- `components/lite/hiring-pipeline/trial-review-client.tsx`
- `tests/hp10-trial-review.test.ts` (17 tests)

## Edited files

- `lib/hiring/index.ts` — barrel export for trial-review module
- `app/lite/admin/hiring/actions.ts` — added delivery + review server actions

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 245 files, 2299 passed, 1 skipped (pre-existing)
- Browser check: not applicable (requires live DB + candidates in trial stage; validated via typecheck + 17 new tests)

## Key decisions

- **Shipped doesn't auto-promote to Bench** — spec §4.3 stage table says Bench entry requires manual drag with DestructiveConfirmModal (compliance gate check). Shipped just means the trial work was accepted.
- **Archived releases content item** — when a trial is archived, the claimed Content Engine item is released back to the pool via `releaseContentItem()` so another candidate can use it.
- **Redelivered resets fully** — clears delivery fields, resets disposition to pending, extends deadline, enqueues a new overdue task. The review notes + rating from the first review are preserved in the initial `updateTrialTask` call before the reset, so the activity log captures the revision request context.
- **`we_archived` not `we_declined`** — disposition direction enum doesn't include `we_declined`; used `we_archived` which is the canonical term for Andy-initiated archiving.

## Rollback

- Git-revertable: all new files are additive. Edits to existing files are additive (new barrel export, new action functions). No existing function signatures changed.

## Settings keys consumed

- `hiring.trial.delivery_deadline_days` — default 7, used in redelivered deadline extension
- `hiring.trial.delivery_grace_days` — default 3, used in redelivered overdue task scheduling

## Next session should know

- **Kanban card link to review surface** — the candidate card in the Trial column should link to `/lite/admin/hiring/trials/:trialTaskId` when a trial task exists. This is a kanban UI session concern (HP-13 or similar).
- **Apply form** (`/apply`) — BUILD_PLAN maps this route to HP-10, but the Next Action scoped HP-10 to delivery+review only. The apply form (spec §7) is a separate HP session.
- **Reply-intelligence delivery detection** — currently delivery is marked manually. Spec §9.2 mentions candidates can reply with a delivery URL. Automatic detection via reply-intelligence matching is a separate HP session.
- **Content Engine consumed status** — on `shipped`, the spec says "Content Engine re-flags the item as consumed." The current Content Engine status enum doesn't include `consumed`. The claim remains in place (not released), which is functionally correct — the item stays claimed/locked. A proper `consumed` status can be added when Content Engine builds its lifecycle tracking.
