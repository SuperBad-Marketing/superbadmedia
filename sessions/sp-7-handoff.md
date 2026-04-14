# SP-7 — Stripe webhook dispatch (idempotent) — Handoff

**Closed:** 2026-04-14
**Spec:** `docs/specs/sales-pipeline.md` §§3.1, 3.3, 10.1, 12.1
**Brief:** `sessions/sp-7-brief.md`

## What shipped

- **`lib/stripe/webhook-handlers/`** — new module:
  - `index.ts` — `dispatchStripeEvent(event, opts?)`. Kill-switch gated
    via `settings.get("pipeline.stripe_webhook_dispatch_enabled")`. Routes
    `checkout.session.completed` + `payment_intent.succeeded`; every
    other event type returns `skipped:unhandled_event_type:<x>`.
  - `checkout-session-completed.ts` — branches on
    `session.metadata.product_type` (`intro` / `retainer` / `saas`).
    Exports `PRODUCT_TYPES`, `isProductType()`. Catches CRM-thrown errors
    and returns `{ result: 'error', error }` rather than propagating —
    Stripe retries are worse than a recorded failure.
  - `payment_intent.succeeded.ts` — known-skipped (reason
    `covered_by_checkout_session`). Registered so future SB work has a
    hook.
  - `types.ts` — `DispatchOutcome { result: WebhookResult; error? }`.

- **`lib/crm/mark-company-trial-shoot-booked.ts`** — intro-path helper.
  One transaction: (1) if deal not already `trial_shoot`, transition;
  (2) if company `trial_shoot_status` is a forward move from current
  → `booked`, advance it; (3) always write a `trial_shoot_booked`
  activity row on top of the structural rows from steps 1–2.

- **`lib/crm/finalise-deal.ts`** — extended `FinaliseWonPayload` with
  optional `value_cents`. When provided, the deal write also stamps
  `value_cents` + flips `value_estimated = false`. Existing SP-6 callers
  unchanged (payload silently omits the field).

- **`app/api/stripe/webhook/route.ts`** — rewritten. Still verifies
  signature, still emits the SW-5c `external_call_log` receipt row. Now
  also:
  - Inserts `{ id: event.id, provider: 'stripe', event_type, payload,
    processed_at_ms, result: 'ok' }` into `webhook_events` with
    `onConflictDoNothing()`. If the PK collides, the handler
    short-circuits with `{ dispatch: 'replay' }` and 200.
  - Calls `dispatchStripeEvent(event)` inside a try/catch. Unexpected
    throws become `{ result: 'error', error: 'unexpected:<msg>' }`.
  - Updates the `webhook_events` row with the outcome (`result` +
    `error`).
  - Always 200s on a well-formed signed request. Only bad signature /
    missing secret returns 400.

- **Settings + migration:**
  - `pipeline.stripe_webhook_dispatch_enabled` (boolean, default `true`)
    added to `docs/settings-registry.md` + `lib/settings.ts` registry.
  - `lib/db/migrations/0013_sp7_webhook_dispatch_setting.sql` seeds the
    single row. `INSERT OR IGNORE` → re-running is idempotent.

- **Tests:**
  - `tests/stripe/dispatch-checkout-session-completed.test.ts` — 9 cases:
    intro / retainer / saas happy paths, missing metadata.deal_id,
    unknown product_type, retainer with null amount_total, unknown deal
    id (recorded error not throw), illegal transition (lead → won),
    intro on a deal already in `trial_shoot` (idempotent-friendly).
  - `tests/stripe/dispatch-payment-intent-succeeded.test.ts` — 2 cases:
    PI.succeeded skip reason + unhandled event type skip reason.
  - `tests/stripe/dispatch-kill-switch.test.ts` — 2 cases: kill-switch
    short-circuits checkout.session.completed + payment_intent.succeeded
    before any metadata or business logic runs.
  - `tests/settings.test.ts` — seed-count assertions bumped 81 → 82 and
    the test description updated.

- **E2E:**
  - `tests/e2e/stripe-webhook-critical-flow.spec.ts` — POSTs a signed
    `checkout.session.completed` for a seeded quoted deal; asserts 200
    + `{ dispatch: 'ok' }` + deal in Won with `value_cents` + `result:
    'ok'` row in `webhook_events` + replay returns `{ dispatch: 'replay'
    }`. Skipped unless `SP7_WEBHOOK_E2E=1` is set.
  - `tests/e2e/fixtures/stripe-signature.ts` — extended
    `buildSignedWebhook` to accept a custom data object (previously
    only the event type was customisable). Back-compat: second arg
    defaults to the old placeholder.

## Decisions

- **Errors become recorded outcomes, not 5xx.** Unknown deal, illegal
  transition, missing metadata, null amount — all land as
  `webhook_events.result = 'error'` with a descriptive reason. Stripe
  still sees 200, does not retry. Triage happens off the table.
  Cockpit health banner for failed webhooks is Cockpit's problem.
- **Intro path is forward-only for both the deal stage and the company
  trial-shoot status.** `markCompanyTrialShootBooked` checks
  `isForwardTransition(current, 'booked')` and skips the company
  advance when a prospect who's already further along (e.g.
  `completed_feedback_provided`) re-purchases. Deal-stage check is the
  same — already-`trial_shoot` deals don't re-transition.
- **Reused `finaliseDealAsWon` over a new helper.** The spec §3.3
  matrix is already enforced there; extending its payload with an
  optional `value_cents` preserves the single owner of the Won
  transition. SP-6's callers pass nothing → no behavioural change.
- **`stage_change` activity meta carries Stripe context.** `source:
  'stripe_webhook'`, `event_id`, `product_type`, `stripe_session_id`.
  Avoids writing a second semantic row for the retainer/saas path;
  the stage_change row is already the warmth trigger. Intro keeps a
  `trial_shoot_booked` row on top of stage_change because the cockpit
  consumes the semantic kind, not the structural transition.
- **No `payment_received` activity kind emitted.** It's in the enum but
  cockpit consumers haven't wired it yet. The `stage_change` row with
  `meta.event_id` is sufficient audit. If SP-9's celebration needs a
  dedicated kind, flip the switch then — trivial one-liner in
  `checkout-session-completed.ts`.
- **Kill-switch is the rollback.** Flipping
  `pipeline.stripe_webhook_dispatch_enabled = false` halts all business
  dispatch without a deploy. Signature verification + idempotency still
  run; Stripe still sees 200s. Migration down-path = DELETE the
  settings row.

## Preconditions verified

- `webhook_events` table + `WEBHOOK_RESULTS` enum (SP-1). ✓
- `deals.value_cents`, `deals.value_estimated` (SP-1). ✓
- `transitionDealStage` accepts external tx arg (SP-2). ✓
- `advanceTrialShootStatus` accepts external tx arg (SP-5). ✓
- `finaliseDealAsWon` transactional (SP-6). ✓
- `settings.get()` pattern + cache invalidation (`lib/settings.ts`). ✓
- `ACTIVITY_LOG_KINDS` already includes `trial_shoot_booked`,
  `stage_change`, `payment_received` (SP-1 + pre-existing). ✓

## Verification

- `npx tsc --noEmit` — clean.
- `npm test -- --run` — **492/492 green** (+13 SP-7 tests; settings
  seed-count assertion bumped 81 → 82).
- G4 literal-grep — no autonomy thresholds introduced. Kill switch
  reads via `settings.get()`. Enum values (`intro`/`retainer`/`saas`,
  `ok`/`error`/`skipped`) are schema, not tunables.
- G11 — new settings key registered in `docs/settings-registry.md` +
  `lib/settings.ts` + seed migration. Consumer reads via
  `settings.get("pipeline.stripe_webhook_dispatch_enabled")`.
- G12 (Playwright) — spec shipped, opt-in via `SP7_WEBHOOK_E2E=1`.
  Hermetic: no live Stripe calls, local HMAC signing against the
  Playwright fixture `STRIPE_WEBHOOK_SECRET`. **Not run this session**
  (no dev-server; aligns with existing E2E conventions where critical-
  flight specs are skipped without the matching env var).
- **Manual browser — still owed** for SP-5 (TrialShootPanel) + SP-6
  (Won/Lost modals). Not regressed by SP-7 (pure additive). Seed
  instructions live in sp-5-handoff.md + sp-6-handoff.md.

## Not shipped (out of scope)

- Subscription lifecycle (`customer.subscription.*`) — SB spec.
- Resend inbound / bounce webhooks — SP-8.
- Customer-warmth sound playback wiring — SP-9.
- Client Management provisioning on Won — CM spec.
- Cockpit health banner for failed webhooks — Cockpit spec.
- Drag-out-of-Won reversal — deferred per SP-6 handoff.
- Intro Funnel's responsibility for stamping `session.metadata.deal_id`
  + `session.metadata.product_type` when creating Checkout Sessions —
  lives in Intro Funnel + Quote Builder specs respectively. Cross-spec
  contract named below.

## Cross-spec contracts produced

- **Intro Funnel + Quote Builder** must set
  `stripe.checkout.Session.metadata.deal_id` (string, required) and
  `stripe.checkout.Session.metadata.product_type` (string, one of
  `"intro" | "retainer" | "saas"`, required) on every Checkout Session
  they create. Missing or unknown metadata is not a soft failure — the
  webhook records an `error` row and the deal does not move. Logged to
  `PATCHES_OWED.md` against both specs.

## PATCHES_OWED

- **Opened — IF-7a** (Intro Funnel): Stripe Checkout Session creation
  must stamp `metadata.deal_id` + `metadata.product_type='intro'`. SP-7
  webhook dispatch rejects sessions missing either field.
- **Opened — QB-7a** (Quote Builder): Stripe Checkout Session creation
  must stamp `metadata.deal_id` + `metadata.product_type` ∈
  `retainer|saas`. Same rejection rule.

## Settings keys consumed

- `pipeline.stripe_webhook_dispatch_enabled` (new this session).

## Rollback

- Flip `pipeline.stripe_webhook_dispatch_enabled` to `false` in the
  `settings` table. No deploy required.
- Migration down-path: `DELETE FROM settings WHERE key =
  'pipeline.stripe_webhook_dispatch_enabled';`
- Git-revert: the route.ts rewrite is a single commit; reverting
  restores the SW-5b receiver (logs + 200, no dispatch). The
  `webhook-handlers/` module + helpers are net-new, safe to leave.

## Next session

**Wave 5 SP-8** — Resend inbound webhook + bounce/complaint handling +
stage rollback + `do_not_contact` flag. Per `BUILD_PLAN.md` Wave 5.

**Also owed before Phase 6:** manual browser pass for SP-5 + SP-6
(seed instructions in those handoffs); IF-7a + QB-7a metadata stamping
when Intro Funnel / Quote Builder are built.
