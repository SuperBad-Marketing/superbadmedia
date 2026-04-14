# qb-subs — Subscription-lifecycle webhooks (Wave 6)

**Date:** 2026-04-14
**Closes:** `qb4c_subscription_lifecycle_webhooks`
**Tier:** Opus / `/deep`
**Tests:** 585/585 green (was 562/562) · typecheck clean · G4 clean

## What landed

Four new Stripe webhook handlers wired into `dispatchStripeEvent`. All
mirror the SP-7 / QB-5 handler pattern (return `DispatchOutcome`, thread
`dbArg` for hermetic tests, log via `database.insert(activity_log)`
directly so test DB threading works).

| Event | Handler | Behaviour |
|---|---|---|
| `customer.subscription.updated` | `subscription-updated.ts` | Maps Stripe `Subscription.status` → `deals.subscription_state`. `active` ↔ `active`; `past_due`/`unpaid` → `past_due`; `paused` → `paused`. Idempotent (no-op when target state matches current). `canceled`/`trialing`/`incomplete*` skipped (canceled is owned by `.deleted`; trial states out of scope for retainer). |
| `customer.subscription.deleted` | `subscription-deleted.ts` | Handshake log only. Our cancel flow (Quote Builder §7.2, not yet built) owns terminal state authoritatively. Logs `subscription_cancelled_stripe_initiated` with current state for audit. |
| `invoice.payment_failed` | `invoice-payment-failed.ts` | `active → past_due` + log `subscription_payment_failed` with `attempt_count` + `next_payment_attempt_unix`. Idempotent. One-off invoices (no `subscription`) skipped. No auto-cancel — Stripe owns dunning. |
| `invoice.payment_succeeded` | `invoice-payment-succeeded.ts` | Recovery-only: `past_due → active` + log `subscription_payment_recovered`. Healthy ongoing payments produce no log (Branded Invoicing's `invoices` table is the cycle record-of-truth). |

Schema: `DEAL_SUBSCRIPTION_STATES` grew 7 → 8 (added `past_due` between
`active` and `paused`). No migration file — drizzle TS-enum addition
flows at build time. Existing rows unaffected (only valid for new
`past_due` writes from the new handler).

Existing test `tests/crm/schema.test.ts` updated to expect the new
8-tuple.

## Cross-spec contract

- **State machine:** FOUNDATIONS §12 is the canonical reference. NB: §12
  uses `active_current` + `cancel_scheduled_preterm`; code has used
  `active` + `pending_early_exit` since SP-1. New PATCHES_OWED row
  `qb_subs_subscription_state_naming_drift` opens this for a
  reconciliation session (don't bundle into another feature build).
- **Activity log convention:** `kind:"note"` + `meta.kind:"<verb>"`, per
  the SP-9 / QB-5 precedent. Doesn't widen `ACTIVITY_LOG_KINDS`. Meta
  carries `event_id` for cross-reference to `webhook_events`.
- **Idempotency:** route-level `webhook_events` PK on `event.id` is the
  outer guard (replays return `{dispatch:'replay'}`). Handler-level
  guard is "read current state, no-op if already in target". Belt and
  braces — replays from forced reprocessing also no-op cleanly.

## Out of scope / deferred

- **`customer.subscription.paused` / `customer.subscription.resumed`** —
  SaaS-only (retainer clients can't pause per FOUNDATIONS §12). Owned
  by SaaS Subscription Billing build session.
- **`customer.subscription.created`** — we create the subscription
  server-side in `payment-intent-succeeded.ts`, so the receive-side
  webhook is informational only. Not wired; can be added later as audit
  redundancy if useful.
- **Dunning emails on `invoice.payment_failed`** — Stripe's policy owns
  retries + escalation. Spec §7.1 explicitly defers. No email send,
  just state mirror + activity log.
- **Customer-facing surfacing of `past_due`** — admin Cockpit + portal
  surfaces will read `deals.subscription_state` once those build
  sessions land. State is now stamped correctly from day one.
- **Naming drift fix** — see `qb_subs_subscription_state_naming_drift`.

## Files touched

**New:**
- `lib/stripe/webhook-handlers/subscription-updated.ts`
- `lib/stripe/webhook-handlers/subscription-deleted.ts`
- `lib/stripe/webhook-handlers/invoice-payment-failed.ts`
- `lib/stripe/webhook-handlers/invoice-payment-succeeded.ts`
- `tests/stripe/dispatch-subscription-lifecycle.test.ts`
- `sessions/qb-subs-handoff.md`

**Modified:**
- `lib/db/schema/deals.ts` (enum +1)
- `lib/stripe/webhook-handlers/index.ts` (4 new case branches + imports)
- `tests/crm/schema.test.ts` (8-tuple expectation)
- `PATCHES_OWED.md` (close + open one)

**Unchanged:** route receiver `app/api/stripe/webhook/route.ts` (no
signature/idempotency change; new event types route through the
existing dispatcher path); no migration; no settings keys; no env vars;
no new npm deps.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 585/585 (1 pre-existing skip), no regressions
- New file alone: 23 tests, 8 + 3 + 6 + 6 (split per event)
- G4 literal grep: clean. No autonomy thresholds, retry counts, or
  timeouts in the new code; only Stripe enum strings and our
  schema-enum strings.
- G6 rollback: kill switch (`pipeline.stripe_webhook_dispatch_enabled`)
  flips dispatch off platform-wide. Enum addition is additive (no down
  migration needed; old rows have `null` or one of the 7 prior values).
- Manual browser verify: N/A (webhook-only). Stripe-CLI dry-run owed
  before live customer flips a `past_due` state — track in the next
  Stripe-touching session.

## Next session

Per `BUILD_PLAN.md` Wave 6, options:
- **QB-6** — scheduled-task handlers (`quote_reminder_3d`, `quote_expire`,
  `manual_invoice_generate`, `manual_invoice_send`). Stubs throw
  `NotImplementedError` today; reminder + expire are pure QB, the two
  invoice handlers shared with BI-1.
- **QB-7** — supersede/withdrawal/expired URL states.
- **QB-8** — early-cancel skeleton (data shape).

QB-6 is the load-bearing next row — the reminder enqueue from QB-4b is
firing into a `NotImplementedError` today. Recommend QB-6 next.

Manual browser verification still owed for QB-2b + QB-3 + QB-4a/b/c
(non-blocking). Carry forward.
