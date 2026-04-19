# `PM-4` — Subscription State Naming Reconciliation — Handoff

**Closed:** 2026-04-19
**Type:** INFRA (small)
**Model tier:** Sonnet

---

## What was done

Renamed two `DEAL_SUBSCRIPTION_STATES` enum values to match FOUNDATIONS §12 canonical state machine names:

- `active` → `active_current`
- `pending_early_exit` → `cancel_scheduled_preterm`

### Migration

`0051_pm4_subscription_state_rename.sql` — two UPDATE statements renaming existing rows in the `deals` table. Journal entry added at idx 51.

### Files edited (25+)

**Schema:**
- `lib/db/schema/deals.ts` — enum values renamed

**Stripe webhook handlers (4):**
- `lib/stripe/webhook-handlers/payment-intent-succeeded.ts`
- `lib/stripe/webhook-handlers/invoice-payment-succeeded.ts`
- `lib/stripe/webhook-handlers/invoice-payment-failed.ts`
- `lib/stripe/webhook-handlers/subscription-updated.ts` — `mapStatus()` now returns `active_current` for Stripe `active`

**Subscription logic (3):**
- `lib/subscription/early-cancel.ts` — all state comparisons + comments
- `lib/invoicing/handlers.ts` — chain-stop guard
- `lib/saas-products/cancel-actions.ts` — no changes needed (already used terminal states only)

**SaaS product logic (3):**
- `lib/saas-products/headline-signals.ts` — MRR_STATES + near-cap filter
- `lib/saas-products/tier-change.ts` — state guard (2 locations)
- `lib/scheduled-tasks/handlers/saas-subscription-usage-reset.ts` — live-subscription check
- `lib/scheduled-tasks/handlers/saas-subscription-tier-downgrade-apply.ts` — active guard

**Portal / inbox / classify (3):**
- `lib/portal/mode.ts` — retainer-active check
- `lib/graph/classify-support-ticket-type.ts` — live-states set
- `app/lite/inbox/_queries/load-support-customer-context.ts` — live subscriber states
- `app/lite/inbox/_components/customer-context-panel.tsx` — display label

**App pages (3):**
- `app/get-started/checkout/page.tsx` — existing-sub guard
- `app/get-started/checkout/actions.ts` — deal creation
- `app/lite/admin/clients/page.tsx` — active check
- `app/lite/onboarding/clients/onboarding-dashboard-client.tsx` — variant resolver + humanState

**Test files (7):**
- `tests/crm/schema.test.ts`
- `tests/qb8-early-cancel.test.ts`
- `tests/stripe/dispatch-subscription-lifecycle.test.ts`
- `tests/stripe/dispatch-payment-intent-invoice.test.ts`
- `tests/bi1-invoicing.test.ts`
- `tests/bi2a-supersede.test.ts`
- `tests/bi2b-ii-compose-emails.test.ts`
- `tests/saas-products/sb9-payment-failure.test.ts`
- `tests/saas-products/sb10-headline-signals.test.ts`
- `tests/saas-products/sb8-tier-change.test.ts`
- `tests/e2e/saas-signup.spec.ts`

**Seed scripts (3):**
- `scripts/seed-bi-e2e.ts`
- `scripts/seed-sb6b-e2e.ts`
- `scripts/seed-sb7-e2e.ts`

### PATCHES_OWED marked applied (1)

- `qb_subs_subscription_state_naming_drift`

## Key decisions

1. **Migration is data-only UPDATE, not column recreate.** SQLite text columns don't enforce enum values at the DB level (enforcement is in Drizzle's TypeScript types). Two UPDATE statements are the simplest, safest path.
2. **UI display labels updated.** `cancel_scheduled_preterm` displays as "Cancelling at term end" in the customer context panel (previously "Pending early exit"). `active_current` displays as "Active" (unchanged user-facing label).
3. **Variant names in onboarding dashboard left as-is.** The UI variant type (`"active" | "at_cap" | "past_due" | "waiting"`) is an internal UI concern, not a subscription state value — no rename needed there.

## What the next session should know

- The `invoice-payment-succeeded` handler's activity log body now reads `past_due → active_current` instead of `past_due → active`. This is an internal log string, not user-facing.
- Any future code comparing subscription state must use `active_current` and `cancel_scheduled_preterm` — TypeScript will enforce this via the enum type.
- The FOUNDATIONS §12 state machine lists additional states (`trial_pending`, `trial_active`, `trial_completed_awaiting_decision`, `quote_draft`, `quote_sent`, `quote_accepted`) that don't exist in the code enum yet — those are owned by Intro Funnel and Quote Builder specs that haven't been built yet.

## Verification

- `npx tsc --noEmit` — 0 new errors (pre-existing `.next/types` duplicates only)
- `npm test` — 218 files, 1833 passed, 0 failures
- No UI changes — no browser check needed (enum rename only)

## Rollback strategy

**Migration reversible.** Down-migration: `UPDATE deals SET subscription_state = 'active' WHERE subscription_state = 'active_current'; UPDATE deals SET subscription_state = 'pending_early_exit' WHERE subscription_state = 'cancel_scheduled_preterm';` + revert schema enum. Git-revertable as a single commit.
