# SB-7 handoff — 2026-04-15

**Wave 8 SB-7 CLOSED.** Usage metering + cap enforcement landed: `recordUsage()` / `checkUsageLimit()` / `loadDashboardUsage()`, `usage_records` extended with idempotency + amount + period-end, sticky bar on active variant + at_cap full-page takeover with next-tier upgrade CTA, period-rollover cron (observability + self-chain), kill switch for enforcement.

**Spec:** `docs/specs/saas-subscription-billing.md` §5.

## What landed

- **`lib/db/migrations/0025_sb7_usage_idempotency_and_amount.sql`** (NEW, journaled at idx 25) — adds `amount` / `idempotency_key` / `billing_period_end_ms` columns + unique partial index on `idempotency_key`.
- **`lib/db/migrations/0026_sb7_usage_settings.sql`** (NEW, seed — `INSERT OR IGNORE`) — seeds `saas.usage_warn_threshold_percent = 80`.
- **`lib/db/migrations/meta/_journal.json`** — added idx 25 entry (ALTER TABLE can't be idempotent in pure SQL; journalling required).
- **`lib/db/schema/usage-records.ts`** (EDIT) — new fields + unique idempotency index.
- **`lib/db/schema/scheduled-tasks.ts`** — `"saas_subscription_usage_reset"` added to `SCHEDULED_TASK_TYPES` (SaaS cohort 3 → 4).
- **`lib/db/schema/activity-log.ts`** — `"saas_usage_period_rollover"` kind added.
- **`lib/settings.ts`** — new key `saas.usage_warn_threshold_percent: integer` under "2 — SB-2b, SB-7" block.
- **`lib/kill-switches.ts`** — new `saas_usage_enforcement_enabled: false`. When off, `checkUsageLimit` returns `allowed: true` regardless of tally (phase-6 flip).
- **`lib/saas-products/usage.ts`** (NEW, ~470 lines) — exports `resolveBillingPeriod`, `checkUsageLimit`, `recordUsage`, `loadDashboardUsage`, plus types. Signatures keyed on `(contactId, productId, dimensionKey)` per spec §5.1 (brief's `dealId` shape silently reconciled — SB-1 index + spec are locked).
- **`lib/scheduled-tasks/handlers/saas-subscription-usage-reset.ts`** (NEW) — logs `saas_usage_period_rollover` activity, self-chains next enqueue idempotent on `saas_usage_reset:{dealId}:{endMs}`. No destructive mutation — period is computed at read time (spec §5.4).
- **`lib/scheduled-tasks/handlers/index.ts`** — spread `SAAS_SUBSCRIPTION_HANDLERS` into `HANDLER_REGISTRY`.
- **`app/lite/onboarding/clients/onboarding-dashboard-client.tsx`** (REWRITE) — 4 variants: `at_cap` / `active` / `past_due` / `waiting`. New `UsageStickyBar` with per-dimension pills (calm/warn/at_cap colored bars + voice lines — "Making sure the juice is worth the squeeze." at warn, "Full tank." at cap). New `AtCapHero` with next-tier upgrade card + "wait for reset" card.
- **`app/lite/onboarding/page.tsx`** (EDIT) — contact lookup + `loadDashboardUsage(contact.id, summary.productId)` wired through to client.
- **`tests/saas-products/sb7-usage.test.ts`** (NEW, 16 tests) — period math (anniversary / month-end clamp / roll-forward), `recordUsage` (shape / idempotency / unknown sub / unknown dim / amount>1), `checkUsageLimit` (calm/warn/at_cap, enforcement on/off, null-limit top-tier, period reset), `loadDashboardUsage` (anyAtCap + nextTier / null when no deal).
- **`scripts/seed-sb7-e2e.ts`** (NEW) — hermetic fixture: 1 product + 2 tiers + 1 dimension + tier limits (10 / 100) + 2 active subscribers at 8/10 (warn) and 10/10 (at_cap). Period helper inlined (can't import `usage.ts` into fixtures — pulls `server-only`).
- **`tests/e2e/saas-usage-sticky-bar.spec.ts`** (NEW, 2 tests) — warn asserts active variant + `usage-pill-*` `data-status="warn"` + 8/10 copy + voice line + Brand DNA CTA still present; at_cap asserts `data-variant="at_cap"` + `at-cap-hero` + `upgrade-cta` targets tier2 + `wait-for-reset` + Brand DNA CTA suppressed + sticky bar suppressed.
- **`tests/settings.test.ts`** (EDIT) — seed count 92 → 93.

## Verification

- `npx tsc --noEmit` — 0 errors.
- `npm test` — 109 files, 789 passing / 1 skipped (+16 SB-7).
- Playwright `tests/e2e/saas-usage-sticky-bar.spec.ts` — **2/2 green** in 1.8 min.
- G4 literal grep: warn threshold 80 is seeded in migration 0026 only; `usage.ts` reads it via `settings.get("saas.usage_warn_threshold_percent")`. No other tunables inlined.
- Manual browser walk: **owed** (PATCHES_OWED `sb7_manual_browser_verify`).

## Silent reconciles per `feedback_technical_decisions_claude_calls`

1. **Signature keyed on `(contactId, productId, dimensionKey)`.** Brief said `(dealId, dimensionKey)`; spec §5.1 + SB-1's `usage_records` index both key on contact/product/dimension. Spec wins.
2. **Period math derived from `deals.created_at_ms`.** Brief suggested `committed_until_date_ms` minus commitment length; that column is nullable for monthly + churns on commitment changes. Using the deal's original anchor is stable across tier switches. Month-end day clamp (anchor day 31 → Feb 28) is built in.
3. **`amount` + `idempotency_key` + `billing_period_end_ms` via ALTER TABLE.** Brief sketched a full table re-create; SB-1's `usage_records` is live and referenced by tests. Three additive columns + a unique-partial index is lower blast radius.
4. **Period-rollover cron is observability-only.** Spec §5.4 explicitly reads the period at query time (no stored `current_period_id`), so there's nothing for the cron to mutate. The handler logs `saas_usage_period_rollover` (surfaces the boundary on the activity timeline) + self-chains. Keeps the cron table contract alive without inventing destructive work.
5. **Enforcement kill switch defaults off.** `saas_usage_enforcement_enabled: false` means v1.0 ships with sticky bar + voice but no hard blocks. Flip in phase 6 once the sticky bar has been observed in the wild for a release.
6. **Fixture inlines `resolveBillingPeriod`.** `usage.ts` imports `@/lib/db` (server-only); the seeder can't. Inlined a tiny copy with a comment. If period math changes, update both.

## PATCHES_OWED opened

- **`sb7_manual_browser_verify`** — Andy to drive: redeem SB-7 seed fixture token → land on `/lite/onboarding` → confirm warn pill renders with voice line for "warn" subscriber; redeem at_cap token → confirm full-page takeover + upgrade CTA on at_cap variant.
- **`sb7_enforcement_flip_checklist`** — before flipping `saas_usage_enforcement_enabled` to `true` in phase 6: (a) confirm at-cap hero copy review; (b) verify all hot-path action handlers route through `checkUsageLimit` (SB-7 didn't audit every handler — it only shipped the primitive); (c) decide what happens on top-tier null-limit (currently `allowed: true` forever, no at-cap treatment).
- **`sb7_dashboard_usage_unit_test`** — only integration tests cover `loadDashboardUsage`; no direct unit test for the anyAtCap / firstAtCapDim / nextTier selection rules.

## PATCHES_OWED closed

None this slice.

## Things SB-8 will need

- `checkUsageLimit` returns the current tier's `nextTier` already — SB-8 tier-change upgrade flow can pull the same shape.
- Tier downgrade past current usage should consult `loadDashboardUsage(...).dimensions` to warn the subscriber before commit (any dimension `used > nextTier.limit` → block or warn).
- Period math anchored on `deals.created_at_ms` — tier changes must NOT reset the anchor (downgrade pro-ration math depends on it).
- Product switch = new `saas_product_id` on the same deal. Usage is keyed on `(contactId, productId, dimensionKey)`, so a product switch effectively zeros the usage tally. Flag this in SB-8's brief — it may be a feature or a bug depending on voice.

## Memory alignment

- `project_tier_limits_protect_margin` — tier limits ARE the margin mechanism here; at-cap is the hand-raise for upgrade, not a punishment.
- `project_settings_table_v1_architecture` — warn threshold lives in `settings` table via `settings.get()`, never literal.
- `feedback_individual_feel` — sticky bar renders per-subscriber usage, not aggregates.
- `feedback_primary_action_focus` — at_cap takeover demotes Brand DNA hero to focus the upgrade decision; active variant keeps Brand DNA primary with sticky bar as secondary awareness.
- `feedback_motion_is_universal` — variant cross-fade + bar width spring + layout transitions all on `houseSpring`.
- `feedback_no_lite_on_client_facing` — no "Lite" on the dashboard.
- `feedback_earned_ctas_at_transition_moments` — at_cap is the earned transition (hit the ceiling); upgrade CTA + wait-for-reset are proportional.
