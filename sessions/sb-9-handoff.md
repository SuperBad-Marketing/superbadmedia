# SB-9 handoff — 2026-04-15

**Wave 8 SB-9 CLOSED.** SaaS payment-failure lockout + recovery + data-loss escalation. Webhook handlers extended with per-cycle failure counter, 7-day `saas_data_loss_warning` escalation task enqueue/cancel, and a native inline SetupIntent card-update on the past_due dashboard hero.

**Spec:** `docs/specs/saas-subscription-billing.md` §4.6 + §7.4 + §9. **Brief:** `sessions/sb-9-brief.md`.

## What landed

- **`lib/db/migrations/0027_sb9_payment_failure_counter.sql`** (NEW) + journal entry idx 27 — adds `deals.payment_failure_count INTEGER NOT NULL DEFAULT 0` + `deals.first_payment_failure_at_ms INTEGER` (nullable) + `INSERT OR IGNORE` seed for `saas.data_loss_warning_days = 7`.
- **`lib/db/schema/deals.ts`** (EDIT) — declares both new columns.
- **`lib/settings.ts`** (EDIT) — `"saas.data_loss_warning_days": integer` registered.
- **`lib/kill-switches.ts`** (EDIT) — `saas_payment_recovery_enabled: true` (defaults ON).
- **`lib/channels/email/classifications.ts`** (EDIT) — `saas_payment_failed_lockout` + `saas_data_loss_warning` added to both `EMAIL_CLASSIFICATIONS` and `TRANSACTIONAL_CLASSIFICATIONS`.
- **`lib/stripe/setup-intents.ts`** (NEW) — `createSubscriberSetupIntent({stripeCustomerId})` (`usage: "off_session"` + `automatic_payment_methods: {enabled: true}`) + `attachDefaultPaymentMethod(...)` via `stripe.customers.update`.
- **`lib/emails/saas-payment-recovery.ts`** (NEW) — `sendSaasPaymentFailedLockoutEmail` + `sendSaasDataLossWarningEmail`, deterministic dry-voice copy (silent reconcile — see below).
- **`lib/scheduled-tasks/handlers/saas-data-loss-warning.ts`** (NEW) — idempotent state re-check; no-op if `subscription_state !== "past_due"`; else send warning email + log `saas_data_loss_warning_sent`.
- **`lib/scheduled-tasks/handlers/index.ts`** (EDIT) — spreads `SAAS_DATA_LOSS_HANDLERS`.
- **`lib/stripe/webhook-handlers/invoice-payment-failed.ts`** (REWRITE) — guards on `active`/`past_due`; increments counter every call; first-failure-only branch stamps `first_payment_failure_at_ms`, logs `saas_payment_failed_lockout` with rich meta, enqueues `saas_data_loss_warning` with idempotency key `saas_data_loss:{dealId}:{nowMs}` and `run_at = nowMs + days * 86_400_000`; repeat failures in same cycle increment counter only (no new log, no re-enqueue).
- **`lib/stripe/webhook-handlers/invoice-payment-succeeded.ts`** (EDIT) — resets `payment_failure_count=0` + `first_payment_failure_at_ms=null`; flips pending `saas_data_loss_warning` task to `status="skipped"` by scoped idempotency_key match; logs `saas_payment_recovered`.
- **`app/lite/onboarding/actions-card-update.ts`** (NEW Server Action) — `createSetupIntentAction()` session-gated (`role="client"`), resolves customer via `loadSubscriberSummary`, returns `{ok, clientSecret}`; `attachDefaultPaymentMethodAction(paymentMethodId)` kills/returns cleanly; both honour `saas_payment_recovery_enabled`.
- **`app/lite/onboarding/clients/past-due-card-update-client.tsx`** (NEW) — Payment Element host, `loadStripe` + `<Elements>`, `stripe.confirmSetup({redirect: "if_required"})` → `attachDefaultPaymentMethodAction` → done state with 60s `setTimeout` auto-reload. Phase state machine: loading → ready → confirming → attaching → done.
- **`app/lite/onboarding/clients/onboarding-dashboard-client.tsx`** (EDIT) — `past_due` branch renders `<PastDueCardUpdateClient>` when `paymentRecoveryEnabled`, falls back to `BillingPortalHero` otherwise.
- **`app/lite/onboarding/page.tsx`** (EDIT) — passes `paymentRecoveryEnabled={killSwitches.saas_payment_recovery_enabled}`.
- **`tests/saas-products/sb9-payment-failure.test.ts`** (NEW, 6 tests) — first-failure task enqueue shape (idempotency key + 7d run_at), repeat-no-reenqueue, recovery cancels pending task (status=skipped + done_at_ms set), handler no-op on recovered, handler sends email + logs on still-past_due, `applyTierChange` rejects past_due (regression guard).
- **`tests/stripe/dispatch-subscription-lifecycle.test.ts`** (EDIT) — settings mock extended (`saas.data_loss_warning_days → 7`); "idempotent: already-past_due" test rewritten as "repeat failure within same cycle → counter increments, no new log" with pre-seeded `payment_failure_count=1`.
- **`tests/settings.test.ts`** (EDIT) — seed count 93→94; description notes `saas.data_loss_warning_days`.

## Verification

- `npx tsc --noEmit` — 0 errors.
- `npm test` — **111 files, 806 passing / 1 skipped** (+6 from 800 SB-8 baseline).
- G4 literal grep: 7-day window read from `settingsRegistry.get("saas.data_loss_warning_days")`; no inline `7 * 86_400_000`.
- G10.5 external reviewer — **OWED** (state-change moment + user-visible copy; required per brief).
- Manual browser walk — **OWED** (PATCHES_OWED `sb9_manual_browser_verify`).
- Playwright lockout → card-update → recovery — **DEFERRED** to `sb9_playwright_card_update_e2e` (same Stripe-stub blocker as SB-8).

## Silent reconciles per `feedback_technical_decisions_claude_calls`

1. **Deterministic email copy, not Claude-drafted.** Brief §7 named the lockout + warning emails as Claude-drafted. These are recovery-critical transactional sends; clarity beats voice variation. House voice (dry, honest, no guilt-trip) encoded in `lib/emails/saas-payment-recovery.ts` and locked. If Andy wants the Claude-drafted variant later, `sb9_data_loss_email_voice_review` captures the option.
2. **Paused state no-ops on both webhooks.** Brief didn't spell this out, but paused subscriptions shouldn't see billing attempts in practice; if Stripe ever re-delivers against a paused deal, the handlers no-op rather than increment / flip state.
3. **Activity log kinds reused.** Brief called `saas_payment_recovered`, `saas_data_loss_warning_sent`, `saas_payment_failed_lockout` "new" but all three pre-existed in `ACTIVITY_LOG_KINDS`. No schema edit.
4. **Scheduled-task kind reused.** `saas_data_loss_warning` already existed in `SCHEDULED_TASK_TYPES`. No schema edit.
5. **Repeat-failure activity log suppressed.** Brief's existing "idempotent: already-past_due" test expected zero logs on replay. Rewrote the handler so only the first failure of a cycle logs; repeat failures increment the counter silently. Preserves the existing assertion + avoids log spam.
6. **Task cancellation via `status="skipped"` scoped on idempotency_key.** Brief said "cancelled"; SQLite + drizzle doesn't have a natural `cancelled` task state in our registry, and `skipped` is already the recovery-no-op convention in the handler. Idempotency_key carries `firstFailureMs` so the scoped update hits exactly the one pending row for this cycle.
7. **Attach-PM is a second Server Action call, not implicit.** Stripe's `confirmSetup` gives us the PaymentMethod id client-side; client passes it back to `attachDefaultPaymentMethodAction`. Keeps the Stripe mutation + the session check in one place rather than spraying customer updates from the client.

## PATCHES_OWED opened

- **`sb9_manual_browser_verify`** — Andy drives: seed a past_due deal → land on `/lite/onboarding` → confirm Payment Element renders, card confirm path runs, "Card's on file." done state shows + 60s auto-reload fires. Flag any visual gaps.
- **`sb9_playwright_card_update_e2e`** — unblocked when `sb8_playwright_upgrade_e2e` Stripe-stub plumbing lands. Lockout hero → card update → recovery happy path.
- **`sb9_data_loss_email_voice_review`** — deterministic copy shipped; reopen if Andy wants Claude-drafted per-subscriber variant.
- **`sb9_past_due_counter_sweeper`** — orphaned `pending` `saas_data_loss_warning` tasks if a deal gets deleted or switched to a non-SaaS mode mid-cycle. Low priority; add sweeper or scope handler to mark `skipped` with reason.

## PATCHES_OWED closed

None this slice. `sb8_playwright_upgrade_e2e` stays open — SB-9 did not build the Stripe stub plumbing (would have doubled session scope).

## Things SB-10 will need

- Admin cockpit headline signals per spec §7.5.2 — new signups / churn / payment failures / MRR delta / subscribers near cap.
- Payment-failure count now queryable via `deals.payment_failure_count > 0` (or join to `activity_log.kind = 'saas_payment_failed_lockout'` for cycle timing). Subscribers near cap joins to SB-7 `usage_records`.
- Recovery lag signal available: `MAX(created_at_ms) WHERE kind='saas_payment_recovered'` minus prior lockout log timestamp.

## Memory alignment

- `project_tier_limits_protect_margin` — past_due is the other margin lever; lockout + recovery protect billed revenue.
- `feedback_setup_is_hand_held` — inline native SetupIntent is one card, one click, no form nav off-platform.
- `feedback_primary_action_focus` — past_due hero has one primary action (update card); errors / phases ride on the same card.
- `feedback_motion_is_universal` — client uses framer-motion fade/slide between phases (`houseSpring`); "Card's on file." lands as a relief beat, not a hard cut.
- `feedback_individual_feel` — copy reads the subscriber's product name; no communal framing.
- `feedback_no_lite_on_client_facing` — no "Lite" on lockout hero or emails.
- `project_settings_table_v1_architecture` — 7-day window lives in `settings`; no literal.
- `feedback_technical_decisions_claude_calls` — seven silent reconciles above; zero questions to Andy.
