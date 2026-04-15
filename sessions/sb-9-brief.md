# `sb-9` — SaaS payment-failure lockout + recovery + data-loss escalation

**Wave:** 8. **Type:** FEATURE. **Spec:** `docs/specs/saas-subscription-billing.md` §4.6 (payment failure handling) + §7.4 (lockout UI) + §9 (webhook table).
**Predecessor:** `sessions/sb-8-handoff.md` — tier change primitives live; `subscription_state="past_due"` already rejects tier changes. Existing webhook handlers `invoice-payment-failed.ts` + `invoice-payment-succeeded.ts` log activity + flip `deals.subscription_state` to `past_due` / `active` but DO NOT enforce lockout UI, track a failure counter, or schedule the data-loss escalation.
**Model:** `/deep` (Opus). State-machine + branded lockout + native card-update (SetupIntent) + escalation scheduling + recovery reset.

## Goal

Turn `past_due` into a real, branded, recoverable experience. When Stripe fires `invoice.payment_failed` on a SaaS subscription: lock the subscriber out of product surfaces (dashboard variant already covers `past_due` as of SB-6b; tighten + add native card-update), increment a per-billing-cycle failure counter, and schedule a `saas_data_loss_warning` escalation 7 days out. On `invoice.paid` recovery: unlock, reset counter, cancel pending escalation, log `saas_payment_recovered`.

## Acceptance criteria (G12)

1. **Failure counter** — new column `deals.payment_failure_count INTEGER NOT NULL DEFAULT 0` + `deals.first_payment_failure_at_ms INTEGER` (nullable). Migration adds them; SB-1 schema module edited to declare them. Counter increments on each `invoice.payment_failed` webhook where `billing_reason` indicates a subscription cycle (not one-off invoices). Successful `invoice.paid` resets both columns to `0` / `null`.
2. **`saas_data_loss_warning` scheduled task kind** — new entry in `SCHEDULED_TASK_TYPES`; handler `lib/scheduled-tasks/handlers/saas-data-loss-warning.ts` checks `deals.subscription_state === "past_due"` (idempotent re-check — no-op if already recovered), logs `saas_data_loss_warning_sent`, sends Claude-drafted warning email via `sendEmail()`. Idempotency key `saas_data_loss:{dealId}:{firstFailureAtMs}`.
3. **Webhook wiring** — `lib/stripe/webhook-handlers/invoice-payment-failed.ts` extended: increment counter, stamp `first_payment_failure_at_ms` on first failure only, enqueue `saas_data_loss_warning` 7 days out (only on first failure). `invoice-payment-succeeded.ts` extended: reset counter + first_failure timestamp, log `saas_payment_recovered` if counter was > 0, mark any pending `saas_data_loss_warning` task for that deal as `cancelled`.
4. **Branded lockout dashboard hero** — tighten SB-6b's existing `past_due` variant in `onboarding-dashboard-client.tsx`: inline native Stripe Payment Element (SetupIntent) for card update, replacing the current `/api/stripe/billing-portal` POST button. On successful SetupIntent + card attached, show "Card's on file. Stripe'll retry within the hour." + auto-refresh after 60s. Voice honest, not corporate.
5. **Server Action + API route** — `app/lite/onboarding/actions-card-update.ts` exposes `createSetupIntentAction()` → returns client secret scoped to the subscriber's Stripe Customer. Success path attaches the new payment method as default via `stripe.customers.update({invoice_settings.default_payment_method})`.
6. **Activity log kinds (new)** — `saas_payment_recovered`, `saas_data_loss_warning_sent`. (Existing `saas_payment_failed_lockout` from earlier phase is reused; grep confirms presence.)
7. **Email slugs** — `saas-payment-failed-lockout` (already exists or add) and `saas-data-loss-warning` — both route through `quote-builder`-style Claude-drafted email pattern established in BI-2b-ii + SW-8 voice crons. Draft slug for LLM registry if net-new.
8. **Kill switches** — `saas_payment_recovery_enabled: true` (default on). Off = dashboard falls back to `/api/stripe/billing-portal` link (SB-6b behaviour).
9. **Tests** — `tests/saas-products/sb9-payment-failure.test.ts`: first-failure webhook increments counter + enqueues warning, repeat failure increments without re-enqueueing, `invoice.paid` resets + cancels task + logs recovery, data-loss handler no-op on recovered state, handler sends email + logs on still-past_due state, tier-change still rejects past_due (regression guard).

## Out of scope

- Cancel flow (SB-11).
- Pause flow (Q-level — may land in a later session).
- Admin cockpit alert visualisation (parked — see Things SB-10 will need).
- Card expiry warning cron `saas_card_expiry_warning` (separate session — spec §9).
- Annual renewal reminder cron `saas_annual_renewal_reminder` (separate session).

## Gates

- **G0** — read this brief + `sessions/sb-8-handoff.md` + spec §4.6 + §7.4 + existing handlers `lib/stripe/webhook-handlers/invoice-payment-{failed,succeeded}.ts` + memory `project_tier_limits_protect_margin`, `feedback_primary_action_focus`, `feedback_individual_feel`, `feedback_motion_is_universal`.
- **G1 preconditions** — grep-verify:
  - `deals` table has `subscription_state` column (SB-1).
  - `invoice-payment-failed.ts` + `invoice-payment-succeeded.ts` handlers exist.
  - `onboarding-dashboard-client.tsx` renders `past_due` variant via `BillingPortalHero`.
  - `scheduled_tasks` table + handler registry wired (SB-7 + SB-8).
  - Stripe SetupIntent primitive — audit `lib/stripe/` for existing helper; create if absent.
- **G3 whitelist (NEW unless marked):**
  - `lib/db/migrations/0027_sb9_payment_failure_counter.sql` (migration)
  - `lib/db/schema/deals.ts` (EDIT — 2 cols)
  - `lib/db/schema/scheduled-tasks.ts` (EDIT — new kind)
  - `lib/db/schema/activity-log.ts` (EDIT — 2 new kinds)
  - `lib/stripe/webhook-handlers/invoice-payment-failed.ts` (EDIT)
  - `lib/stripe/webhook-handlers/invoice-payment-succeeded.ts` (EDIT)
  - `lib/stripe/setup-intents.ts` (NEW if not present)
  - `lib/scheduled-tasks/handlers/saas-data-loss-warning.ts` (NEW)
  - `lib/scheduled-tasks/handlers/index.ts` (EDIT)
  - `lib/kill-switches.ts` (EDIT)
  - `app/lite/onboarding/actions-card-update.ts` (NEW Server Action)
  - `app/lite/onboarding/clients/onboarding-dashboard-client.tsx` (EDIT — past_due variant inline card update)
  - `app/lite/onboarding/clients/past-due-card-update-client.tsx` (NEW — Payment Element host)
  - `tests/saas-products/sb9-payment-failure.test.ts`
- **G4 literal grep** — 7-day escalation window read from `settings.get("saas.data_loss_warning_days")` (seed `7`); no inline `7 * 24 * 60 * 60 * 1000`.
- **G10.5 external reviewer** — required. State-change moment + user-visible failure copy; reviewer sanity-checks voice (must not be guilt-trip), lockout proportion, recovery relief flourish.
- **G11.b pre-compile `sessions/sb-10-brief.md`** at close — likely topic: admin cockpit SaaS headline signals (new signups / churn / payment failures / MRR delta / subscribers near cap) per spec §752.
- **G12** — typecheck / unit tests / Playwright scoped spec for lockout → card update → recovery happy path (Stripe stub). Playwright may defer to PATCHES_OWED if Stripe stub plumbing still absent (SB-8 opened `sb8_playwright_upgrade_e2e` for the same reason — this is the session to unblock it if scope allows).

## Reconcile notes

- Spec §4.6 says "immediate lockout" on first failure — interpret as dashboard variant + product-route middleware check, but product-route middleware is not in SB-9's whitelist (no SaaS product surfaces exist yet in Lite v1). Lockout for SB-9 = dashboard hero + `subscription_state=past_due` gate on tier-change (already in place). When the first SaaS product ships, it reads `subscription_state` and renders its own locked state.
- Spec §9 `saas_data_loss_warning` fires "7 days after first payment failure if not resolved" — interpret "resolved" as `subscription_state !== "past_due"` at handler fire time. Simpler than tracking explicit resolution timestamps.
- Counter per billing cycle (spec §246) — honour by resetting on `invoice.paid` (same-cycle success clears the counter; next-cycle failure starts fresh). No per-cycle bucketing table.
- Existing `subscription_payment_failed` / `subscription_payment_recovered` activity-log kinds (grep to confirm) may already cover §6; reuse and collapse if so — silent reconcile per `feedback_technical_decisions_claude_calls`.

## Rollback strategy (G6)

- `feature-flag-gated` — `saas_payment_recovery_enabled` kill switch. Flip off = dashboard reverts to SB-6b billing-portal link; webhook handlers still increment counter (safe). Warning scheduled tasks remain queued — handler is state-checked (idempotent no-op if subscription recovers before fire).

## Memory alignment (pre-flight)

- `feedback_setup_is_hand_held` — card update is inline SetupIntent, not a "click here to open Stripe" redirect.
- `feedback_individual_feel` — lockout hero reads "Your card didn't land" referencing the subscriber's product; not "A payment failed for your account."
- `feedback_motion_is_universal` — state transitions (idle → submitting → retrying → recovered) all animate with `houseSpring`.
- `feedback_primary_action_focus` — one action on the lockout hero (update card); no secondary CTAs cluttering the recovery moment.
- `feedback_earned_ctas_at_transition_moments` — the "Card's on file" confirmation is a transition moment; soft CTA back to the dashboard (not aggressive).
- `project_tier_limits_protect_margin` — unrelated; payment failure ≠ margin protection.
- `feedback_no_lite_on_client_facing` — no "Lite" on the lockout copy.

## Notes for the next-session brief writer (SB-10)

- SB-9 ships `payment_failure_count` + `first_payment_failure_at_ms` — admin cockpit (SB-10 candidate) headline signals should read these columns directly for the payment-failure feed.
- `saas_data_loss_warning_sent` activity kind gives SB-10 a feed item to render.
- If Playwright Stripe stub lands in SB-9 (G12), SB-10 inherits it; otherwise `sb8_playwright_upgrade_e2e` + `sb9_playwright_recovery_e2e` remain PATCHES_OWED.
- `saas_payment_recovery_enabled` kill switch pairs with SB-8's `saas_tier_change_enabled` — SB-10 cockpit should surface both toggle states if it renders a kill-switch panel.
