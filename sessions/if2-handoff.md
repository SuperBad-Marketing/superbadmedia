# IF-2 Handoff — Calendar Booking + Shoot-Day Portal + Reflection Form

**Date:** 2026-04-19
**Wave:** 14
**Status:** COMPLETE

## What was built

- **Calendar availability engine** (`lib/intro-funnel/calendar.ts`) — `computeAvailableSlots()` reads `calendar_config` for business hours, blackout dates, advance notice (5 business days), per-week cap (3). Returns 2-hour slots (v1 hardcoded). Prevents races by re-validating at booking time.

- **Booking page** (`app/lite/intro/[token]/book/`) — slot picker grouped by date, house-spring animated slot cards, "Lock it in" CTA. Redirects to portal on success with "You're locked in" confirmation.

- **.ics generation** (`lib/intro-funnel/ics.ts`) — RFC 5545 calendar invite attached to booking confirmation emails.

- **Booking server actions** (`lib/intro-funnel/booking-actions.ts`) — `bookSlotAction` creates `intro_funnel_bookings` + `calendar_bookings` rows atomically, transitions state to `shoot_booked`, sends confirmation email with .ics, logs activity. `rescheduleAction` enforces 2-reschedule cap and 48h minimum. `cancelBookingAction` handles refund eligibility based on 48h window.

- **Manage booking page** (`app/lite/intro/[token]/manage-booking/`) — view/reschedule/cancel modes with slot picker for reschedule, confirmation dialogs for cancel, refund eligibility messaging.

- **Portal shell rewrite** (`portal-shell.tsx`) — now handles all 12 funnel states: pre-payment (questionnaire + payment), paid (book CTA), shoot_booked/approaching/morning_of (booking details card with date/time/what-to-wear), awaiting_deliverables (placeholder), deliverables_ready (gallery + reflection CTA), reflection_complete, portal_dormant.

- **Reflection form** (`app/lite/intro/[token]/reflect/`) — 8-question arc per spec §13.2 content. Intro screen → Q1 safety valve → Q2-Q7 single-choice cards → synthesis reveal → decision CTA pair. Safety valve branches to free-text feedback → early completion with urgent cockpit card. Synthesis uses fallback text (real Opus synthesis is IF-3).

- **Reflection server actions** (`reflect/reflection-actions.ts`) — `saveReflectionAnswer`, `triggerSafetyValve`, `completeReflection`, `recordDecision`. Each updates `intro_funnel_reflections` and transitions funnel state as appropriate.

- **Hourly cron** (`lib/intro-funnel/hourly-cron.ts` + `app/api/cron/intro-funnel/route.ts`) — time-based transitions: shoot_booked→shoot_approaching (48h), shoot_approaching→shoot_morning_of (6am local), shoot_morning_of→shoot_completed_awaiting_deliverables (1h post-end). CRON_SECRET auth.

- **SMS transport** (`lib/channels/sms/send.ts`) — `sendSms()` with DNC check, SMS quiet hours (8am-9pm Melbourne), Twilio REST API, `twilio_sms_log` + `external_call_log` entries.

- **Portal loaders extended** — `loadSubmissionByToken` now fetches booking + reflection rows alongside existing data.

## Schema extensions

- `activity_log` kind enum: added `intro_funnel_state_transition`
- Email classifications: added `shoot_booking_confirmed`, `shoot_reschedule_confirmed`, `reflection_ready`, `trial_shoot_payment_receipt`, `intro_funnel_abandon_24h`, `intro_funnel_abandon_3d`, `apology_email`
- Transactional list: added booking confirmation, reschedule, payment receipt, apology classifications

## Verification

- `npx tsc --noEmit` — zero source errors (only .next/types generated file noise)
- `npx vitest run` — 218 files, 1833 passed, 1 skipped
- Browser verified: /trial-shoot → 200, /lite/intro/[token]/book → 307 (correct redirect for invalid token), /lite/intro/[token]/reflect → 307, /lite/intro/[token]/manage-booking → 307

## What's NOT tested yet

- Full booking flow end-to-end (requires a valid submission in `paid` state + calendar_config seeded)
- Twilio SMS delivery (requires env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
- .ics email attachment rendering
- Hourly cron via HTTP (requires CRON_SECRET env var)
- Opus synthesis generation in reflection (IF-3 scope — currently shows fallback text)

## Key decisions

- Booking confirmation and reschedule emails classified as transactional (bypass quiet window + outreach kill switch) — prospect has already paid
- SMS quiet window set to 8am-9pm Melbourne, stricter than email's 7am-10pm per spec §14
- Calendar slot duration hardcoded to 2 hours for v1 per spec §12.2
- Reflection synthesis uses hardcoded fallback text — real Opus generation and drift check are IF-3 scope
- Portal shell rewritten as a single unified component handling all 12 states rather than conditional page-level routing

## Next session should know

- IF-3 is next — retainer/SaaS offer + Opus synthesis generation + abandon tracking + drift check
- IF-4 follows — portal-guard recovery flow + magic-link embedding
- IF-E2E — Playwright E2E tests for the full flow
- The `calendar_config` singleton needs to be seeded for the booking flow to work (business hours JSON, timezone)
- Reflection Q8 (synthesis reveal) currently shows fallback text; IF-3 wires up the real Opus call
- Booking reminders (24h/2h before) are not yet implemented as scheduled tasks — they're tracked as IF-2 crons in BUILD_PLAN but the `scheduled_tasks` integration for per-booking scheduling should land in IF-3 or as a followup
