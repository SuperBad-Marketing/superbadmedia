# DC-3 Handoff — Daily Cockpit: Material-Event Regen

**Date:** 2026-04-21
**Wave:** 22 (third session)
**Status:** COMPLETE

## What was built

### 1. `lib/cockpit/brief-triggers.ts` — denylist + `maybeRegenerateBrief()`

Core helper for material-event-triggered brief regeneration:

- **Denylist** of 10 material events per spec: `subscription_payment_failed`, `subscription_cancelled`, `invoice_paid_large`, `outreach_reply_positive`, `intro_funnel_booking_confirmed`, `deal_won`, `deal_lost`, `graph_api_token_expired`, `graph_api_subscription_lapsed`, `cost_anomaly_detected`
- **`maybeRegenerateBrief(eventKey, payload)`** — resolves current slot, reads debounce window from `cockpit.material_event_debounce_minutes` setting (10 min default), checks for pending `cockpit_brief_regenerate` tasks created within the window. If none, enqueues via `enqueueTask()`. Returns `{ enqueued: true }` or `{ enqueued: false, reason: "debounced" }`.
- **`isMaterialEvent(key)`** — type guard for denylist membership
- Debounce is at enqueue time per spec — queries `scheduled_tasks` for pending tasks with `created_at_ms >= windowStart`

### 2. Source spec callsite wiring (7 files)

Wired `maybeRegenerateBrief()` into every source spec that already fires a denylist event:

- **`lib/stripe/webhook-handlers/invoice-payment-failed.ts`** — `subscription_payment_failed` after first-failure activity log
- **`lib/saas-products/cancel-actions.ts`** — `subscription_cancelled` in all 3 branches (paid_remainder, buyout, post_term)
- **`lib/intro-funnel/booking-actions.ts`** — `intro_funnel_booking_confirmed` after `shoot_booked` activity log
- **`lib/invoicing/mark-paid.ts`** — `invoice_paid_large` when `total_cents_inc_gst >= 50000` ($500+)
- **`lib/observatory/hard-threshold-detector.ts`** — `cost_anomaly_detected`
- **`lib/observatory/rate-detector.ts`** — `cost_anomaly_detected`
- **`lib/observatory/learned-band-detector.ts`** — `cost_anomaly_detected`

All calls are fire-and-forget (`.catch(() => {})`) — regen failure never blocks source spec logic.

### 3. Events not yet wired (no callsite exists)

These denylist events are registered but have no source spec callsite yet — they'll auto-fire once their parent specs ship:

- `outreach_reply_positive` — Lead Gen reply classification not yet implemented
- `deal_won` / `deal_lost` — Sales Pipeline stage transitions not yet implemented
- `graph_api_token_expired` / `graph_api_subscription_lapsed` — Unified Inbox Graph API integration not yet implemented

### 4. Chain anchoring

Per spec rule 67: mid-slot regen chains off the original morning brief, not the previous in-slot regen. This is inherently correct — `getPriorBriefs()` (DC-2) reads by slot name, and the unique constraint means only one row per (user, slot, date). Regen overwrites; the morning brief read by midday/evening is always the latest version of morning, never an in-slot regen.

## New files

- `lib/cockpit/brief-triggers.ts`
- `tests/dc3-brief-triggers.test.ts`

## Edited files

- `lib/stripe/webhook-handlers/invoice-payment-failed.ts` — added import + `maybeRegenerateBrief` call
- `lib/saas-products/cancel-actions.ts` — added import + 3 `maybeRegenerateBrief` calls
- `lib/intro-funnel/booking-actions.ts` — added import + `maybeRegenerateBrief` call
- `lib/invoicing/mark-paid.ts` — added import + `maybeRegenerateBrief` call (with $500 threshold)
- `lib/observatory/hard-threshold-detector.ts` — added import + `maybeRegenerateBrief` call
- `lib/observatory/rate-detector.ts` — added import + `maybeRegenerateBrief` call
- `lib/observatory/learned-band-detector.ts` — added import + `maybeRegenerateBrief` call

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/dc3-brief-triggers.test.ts` — 8 passed
- Full suite — 285 files, 2904 tests, zero regressions (up from 284/2896)

## Rollback

- All changes are additive — git-revertable
- `maybeRegenerateBrief()` is gated by debounce + the existing `cockpit_briefs_enabled` kill switch (via the handler)
- All callsite wiring is fire-and-forget; removing the calls has zero impact on source spec behaviour

## Key decisions

- **$500 threshold for `invoice_paid_large`.** Spec says "large" without defining it. $500 (50000 cents) is a sensible default for a marketing agency. Could be promoted to a settings key later if needed.
- **Fire-and-forget pattern for all callsites.** Regen is best-effort — a failed enqueue should never block an invoice payment, subscription cancel, or anomaly detection.
- **Debounce checks `created_at_ms`, not `run_at_ms`.** Two rapid events in 10 min = one regen. The second event sees the first's pending task and skips.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)

## Next session should know

- **DC-3 completes Wave 22.** The Daily Cockpit is fully wired: scaffold (DC-1) + briefs pipeline (DC-2) + material-event regen (DC-3). Remaining cockpit sessions (DC-4 attention rail wiring, DC-5 banner wiring) are in later waves when source specs ship their `getWaitingItems()` / `getHealthBanners()` implementations.
- The pre-existing egg build error (`lib/eggs/admin-triggers/three-wons.ts` → `pipeline-board.tsx` client component chain) still blocks dev overlay and production builds.
- Five denylist events (`outreach_reply_positive`, `deal_won`, `deal_lost`, `graph_api_token_expired`, `graph_api_subscription_lapsed`) are registered but unwired — their source specs haven't shipped the relevant activity log calls yet.
