# `PM-3` — Realtime Channel (SSE Push Layer) — Handoff

**Closed:** 2026-04-19
**Type:** INFRA (medium)
**Model tier:** Sonnet

---

## What was built

### 1. Admin event bus (`lib/events/admin-event-bus.ts`)

In-process pub/sub. Three event types: `deal_bounce_rollback`, `payment_failed`, `quote_accepted`. Typed `AdminEvent` payload with optional `SoundKey`. `emitAdminEvent()` is fire-and-forget (listener errors swallowed). `subscribeAdminEvents()` returns an unsubscribe function.

### 2. SSE endpoint (`app/api/admin/events/route.ts`)

`GET /api/admin/events` — auth-gated (admin role only), kill-switch-gated (`admin_sse_enabled`). Returns `text/event-stream`. Each `emitAdminEvent()` call pushes a JSON `data:` frame to all connected admin clients. Stream cleanup on client disconnect via `cancel()`.

### 3. Client hook (`lib/events/use-admin-events.ts`)

`useAdminEvents(handler)` — opens an `EventSource` to `/api/admin/events`, parses JSON, calls the handler. Auto-reconnects on error with 5s backoff. Cleans up on unmount.

### 4. Toast consumer (`components/lite/admin-event-toasts.tsx`)

`<AdminEventToasts />` — renders `null`, subscribes via `useAdminEvents`, routes events to `useToastWithSound()` with sound pairings:
- `deal_bounce_rollback` → `toast.error()` + `error` sound
- `payment_failed` → `toast.error()` + `error` sound
- `quote_accepted` → `toast.success()` + `quote-accepted` sound

Mounted in `app/lite/admin/layout.tsx`.

### 5. Bounce rollback emitter (`lib/resend/webhook-handlers/email-bounced.ts`)

`emitAdminEvent({ type: "deal_bounce_rollback", ... })` fires after each hard-bounce deal rollback to `lead`. Message: `"{email} bounced. Deal rolled back to Lead."`.

### 6. Payment failed emitter (`lib/stripe/webhook-handlers/invoice-payment-failed.ts`)

`emitAdminEvent({ type: "payment_failed", ... })` fires on first payment failure (when deal moves to `past_due`). Message: `"Subscription payment failed — {subId} moved to past_due."`.

### 7. Quote accepted sound (`components/lite/quote-builder/quote-accept-block.tsx`)

`ConfirmationScreen` now plays `quote-accepted` sound on mount via `useSound().play()` + ref guard to prevent double-play in strict mode.

### 8. Kill switch (`lib/kill-switches.ts`)

`admin_sse_enabled` added, defaults to `true`. SSE endpoint returns 503 when OFF.

### New files (5)

| File | Purpose |
|---|---|
| `lib/events/admin-event-bus.ts` | In-process event bus |
| `lib/events/use-admin-events.ts` | Client-side `useAdminEvents()` hook |
| `app/api/admin/events/route.ts` | SSE endpoint |
| `components/lite/admin-event-toasts.tsx` | Toast consumer |
| `tests/pm3-admin-events.test.ts` | 8 tests |

### Edited files (5)

| File | Change |
|---|---|
| `app/lite/admin/layout.tsx` | Added `<AdminEventToasts />` |
| `lib/resend/webhook-handlers/email-bounced.ts` | Added `emitAdminEvent()` call |
| `lib/stripe/webhook-handlers/invoice-payment-failed.ts` | Added `emitAdminEvent()` call |
| `components/lite/quote-builder/quote-accept-block.tsx` | Added `useSound` + play on confirmation |
| `lib/kill-switches.ts` | Added `admin_sse_enabled` |

### PATCHES_OWED marked applied (3)

- `sp9_bounce_rollback_toast`
- `sp9_payment_failed_urgent_toast`
- `qb4c_sound_quote_accepted_emit`

## Key decisions

1. **In-process event bus, not Redis/external.** SQLite single-process architecture means in-memory pub/sub is sufficient and adds zero infrastructure. If Lite ever moves to multi-process, the bus becomes a Redis-backed adapter with the same API.
2. **SSE, not WebSocket.** One-directional server→client push. SSE is simpler, browser-native (`EventSource`), and auto-reconnects. No bidirectional need.
3. **Kill-switch defaults ON.** SSE is read-only and auth-gated — no spend, no external calls. Safe to enable by default.
4. **Quote accepted sound on public page via existing `SoundProvider`.** The root layout already wraps all routes in `SoundProvider`, so the public quote page has access to `useSound()` — no separate wiring needed. The sound respects the user's motion/sound preferences via the provider.

## What the next session should know

- The event bus is extensible — any server-side handler can `emitAdminEvent()` to push a toast to Andy's open admin tab. Future consumers (pipeline board live updates, inbox notifications) can subscribe via `useAdminEvents()`.
- The SSE connection is per-tab. Multiple tabs = multiple connections. This is fine for a single-user admin.
- No heartbeat/keepalive is implemented. If the connection dies silently (e.g. proxy timeout), the 5s reconnect in the client hook handles it. A future enhancement could add periodic `: keepalive\n\n` comments.
- The `SheetWithSound` reference in the sales-pipeline spec (§7.2, noted in PM-2 handoff) says "Silent" — slide-overs are indeed silent per design-system baseline. No action needed.

## Verification

- `npx tsc --noEmit` — 0 new errors (pre-existing `.next/types` duplicates only)
- `npm test` — 218 files, 1833 passed, 0 new failures
- No UI changes visible without triggering a webhook — structural verification only (SSE endpoint exists, toasts are wired, sound plays on confirmation screen)

## Rollback strategy

**Feature-flag-gated.** `admin_sse_enabled` kill switch disables the SSE endpoint (503). The emitters in webhook handlers are no-ops when no SSE clients are connected (empty listener set). Quote accepted sound is independent of SSE and is git-revertable.
