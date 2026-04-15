# `sb-7` — SaaS usage metering + cap enforcement

**Wave:** 8. **Type:** FEATURE. **Spec:** `docs/specs/saas-subscription-billing.md` §2.2 (usage dimensions), §6 (usage + caps).
**Predecessor:** `sessions/sb-6b-handoff.md` — authed dashboard with summary + CTA is stable; `loadSubscriberSummary` returns `dealId / productId / tierName` for usage joins.
**Model:** `/deep` (Opus). New primitive + period boundaries + hard-cap state + approaching-cap comms.

## Goal

Land `recordUsage()` + `checkUsageLimit()` + `usage_records` table + tier-limits lookup + a sticky bar on the subscriber dashboard surfacing approaching-cap / at-cap state. Hard-cap actions route through `checkUsageLimit()` which short-circuits with a branded "you're at the cap — upgrade or next period" screen.

## Acceptance criteria (G12)

1. **`usage_records` table** with: `id / deal_id / dimension_key / amount_numerator / recorded_at_ms / idempotency_key UNIQUE / period_start_ms / period_end_ms`.
2. **`recordUsage(dealId, dimensionKey, amount, idempotencyKey)`** — idempotent write; resolves current billing period from deal's subscription anchor.
3. **`checkUsageLimit(dealId, dimensionKey)`** → `{ allowed: true } | { allowed: false, reason: "at_cap", resetsAtMs }`. Tier limits pulled from `saas_tier_limits` joined on current tier.
4. **Sticky bar** on `/lite/onboarding` active variant — per-dimension progress pill (e.g. "47 / 100 outreach touches this cycle"); rises to warning at 80% + surfaces upgrade CTA at 100%.
5. **Period rollover cron** — `saas_subscription_usage_reset_on_period` per BUILD_PLAN.md cron table; billing-cycle anniversary boundary.
6. **Tests** — `recordUsage` idempotency, `checkUsageLimit` at/below/over/after-reset, period boundary math.

## Out of scope

- Tier change flow (SB-8) + payment failure sequence (SB-9).
- Usage-driven invoicing beyond the $0-setup cap mechanism.
- Per-tier feature-flag gating beyond quantitative dimensions.

## Gates

- G0 read this brief + `sessions/sb-6b-handoff.md` + spec §6 + `project_tier_limits_protect_margin`.
- G1 preconditions: `saas_tier_limits` table exists from SB-1; `loadSubscriberSummary` returns `dealId` + `productId`.
- G3 whitelist (NEW unless marked):
  - `lib/db/schema/usage-records.ts`
  - `lib/db/migrations/NNNN_sb7_usage_records.sql`
  - `lib/saas-products/usage.ts` (recordUsage + checkUsageLimit)
  - `lib/scheduled-tasks/handlers/saas-subscription-usage-reset.ts`
  - `app/lite/onboarding/clients/onboarding-dashboard-client.tsx` (EDIT — sticky bar slot)
  - `tests/saas-products/sb7-*.test.ts`
- G10.5 required — surfaces per-subscriber tier posture; `feedback_individual_feel` + `feedback_primary_action_focus` + `project_tier_limits_protect_margin` self-review.
- G11.b pre-compile `sessions/sb-8-brief.md` (tier change + product switch) at close.
- G12 typecheck / unit tests / Playwright scoped spec for the sticky-bar render.

## Reconcile notes

- SB-6b exposes `brand-dna-hero` as the only primary action on `active`. SB-7's sticky bar is a **secondary** surface — above fold but below hero weight. If usage is at-cap, promote to a full-page takeover variant instead (`/lite/onboarding` resolves to `at_cap` variant before `active`).
- Period start resolution: use `deals.committed_until_date_ms` minus commitment length as anchor, or fall back to `deals.created_at_ms` month-anniversary. Confirm at brief-start.
