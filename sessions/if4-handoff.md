# IF-4 Handoff — Portal-Guard Recovery Flow + OTT Magic-Link Embedding

**Date:** 2026-04-19
**Wave:** 14
**Status:** COMPLETE

## What was built

- **Recovery form real implementation** (`app/lite/portal/recover/actions.ts`) — replaced A8 stub. Looks up `intro_funnel_submissions` by email, falls back to `contacts` table for client-management portal users. Issues fresh OTT via `issueMagicLink()`, sends via `sendEmail({ classification: 'portal_magic_link_recovery' })`. Always returns void (no enumeration). Logs `portal_recovery_form_submitted` activity for both match and non-match.

- **OTT portal link helper** (`lib/intro-funnel/portal-link.ts`) — `generateIntroPortalLink()` wraps `issueMagicLink()` with `callbackUrl` query param pointing to the intro funnel portal. Every customer-facing email now uses this instead of plain portal URLs.

- **OTT embedded at every send point** — booking confirmation, reschedule confirmation, abandon 24h SMS, abandon 24h/3d email (both LLM-generated and fallback copy) all now issue fresh OTT magic links per spec §10.1.

- **Portal session cookie at section 1 submit** (`app/trial-shoot/actions.ts`) — sets `sbl_portal_session` httpOnly cookie immediately after creating the submission + deal. Also issues first magic link via `issueMagicLink()` and sends a welcome email with the link in background (`.catch(() => {})`).

- **Intro funnel portal guard** (`lib/portal/require-intro-session.ts`) — `requireIntroSession(token)` checks for portal session cookie, redirects to `/lite/portal/recover?returnTo=...` if absent. Wired into all intro portal pages: `/lite/intro/[token]`, `/lite/intro/[token]/book`, `/lite/intro/[token]/manage-booking`, `/lite/intro/[token]/reflect`.

- **Booking reminder handler** (`lib/scheduled-tasks/handlers/intro-funnel-booking-reminder.ts`) — registered as `intro_funnel_booking_reminder`. Fires 24h and 2h before shoot. 24h sends email; 2h sends email + SMS (if opted in). Each embeds fresh OTT. Defensive: re-reads booking at fire time, skips if cancelled.

- **Reflection reminder handler** (`lib/scheduled-tasks/handlers/intro-funnel-reflection-reminder.ts`) — registered as `intro_funnel_reflection_reminder`. Fires post-deliverables. Sends email with OTT link to reflection. Defensive: only fires if funnel_state is still `deliverables_ready`.

- **Booking reminder scheduling** — `bookSlotAction` now enqueues both 24h and 2h reminders via `enqueueTask()` with idempotency keys. Only schedules if shoot is far enough in the future.

## Schema changes

- `ACTIVITY_LOG_KINDS` +1: `portal_recovery_form_submitted`
- No migration (enum extension only, no DDL)

## New files

- `lib/intro-funnel/portal-link.ts`
- `lib/portal/require-intro-session.ts`
- `lib/scheduled-tasks/handlers/intro-funnel-booking-reminder.ts`
- `lib/scheduled-tasks/handlers/intro-funnel-reflection-reminder.ts`
- `tests/intro-funnel/if4-portal-link.test.ts`
- `tests/intro-funnel/if4-booking-reminder.test.ts`

## Edited files

- `app/lite/portal/recover/actions.ts` — stub → real implementation
- `app/trial-shoot/actions.ts` — +cookie set, +magic link email
- `app/lite/intro/[token]/page.tsx` — +requireIntroSession
- `app/lite/intro/[token]/book/page.tsx` — +requireIntroSession
- `app/lite/intro/[token]/manage-booking/page.tsx` — +requireIntroSession
- `app/lite/intro/[token]/reflect/page.tsx` — +requireIntroSession
- `lib/intro-funnel/booking-actions.ts` — +OTT links, +reminder scheduling
- `lib/intro-funnel/abandon-tracking.ts` — +OTT links (all email/SMS)
- `lib/scheduled-tasks/handlers/index.ts` — registered 2 new handlers
- `lib/db/schema/activity-log.ts` — +1 kind

## Verification

- `npx tsc --noEmit` — zero source errors
- `npx vitest run` — 223 files, 1846 passed, 1 skipped (+2 files, +5 tests)
- `npm run build` — clean

## Key decisions

- Recovery form checks both `intro_funnel_submissions` and `contacts` table — covers both intro funnel prospects and client-management portal users
- Section 1 submit sets cookie AND fires background magic-link email — belt and braces for first-visit auth
- `requireIntroSession` redirects to `/lite/portal/recover?returnTo=...` rather than a separate intro-specific recovery page — single recovery form serves both portals
- Booking reminders classified as `shoot_booking_confirmed` (transactional) — bypasses quiet window since the prospect paid
- No `intro_funnel_enabled` kill switch added — the scheduled-tasks worker is already gated by `scheduled_tasks_enabled`, and the handlers themselves are defensive (re-read state before acting)

## Next session should know

- IF-E2E is next — Playwright E2E for the full intro funnel flow
- The `ensureAbandonCheckEnqueued()` still needs to be called once to bootstrap the self-perpetuating abandon chain (either from admin setup wizard or seed script)
- `reflection_reminder` needs to be enqueued when `deliverables_ready` fires — that transition happens in the hourly cron (`lib/intro-funnel/hourly-cron.ts`), which should call `enqueueTask({ task_type: 'intro_funnel_reflection_reminder', ... })` — not yet wired
- Reschedule flow should cancel and re-enqueue booking reminders — not yet wired (the old reminders will fire against a cancelled/rescheduled booking and silently no-op due to the defensive checks, but this is wasteful)
