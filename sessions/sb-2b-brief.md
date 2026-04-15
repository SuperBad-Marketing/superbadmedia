# `sb-2b` — SaaS product publish (tier editor + pricing + demo + review + Stripe)

**Wave:** 8. **Type:** FEATURE. **Spec:** `docs/specs/saas-subscription-billing.md` §4.5, §8.2 (steps 3–7), §1.1.
**Predecessor:** `sessions/sb-2a-handoff.md` — wizard def + steps 1–2 are live. Resume against `states.__draft.productId`.
**Stripe sync helpers:** `lib/billing/stripe-product-sync.ts` (`syncProductToStripe`, `syncTierPricesToStripe`) — landed in SB-1, **never called from app code yet**. SB-2b is the first caller.

**Model:** `/deep` (Opus). State machines, Stripe round-trips, price math, transaction-vs-network boundary.

## Goal

Fill in the four stubbed steps + celebration. Add the publish action that flips `saas_products.status` from `draft → active` and calls Stripe to materialise one Product + 9 Prices (3 tiers × 3 cadences). After SB-2b ships, Andy can complete the saas-product-setup wizard end-to-end and verify the Stripe Dashboard test-mode shows the new Product + Prices.

## Acceptance criteria (G12)

1. **Tier-editor step (`tier-editor-step-client.tsx`)** — three fixed `tier_rank` rows (1=small, 2=medium, 3=large per `project_saas_popcorn_pricing`). Per row:
   - Name (text input, default "Small"/"Medium"/"Large").
   - `feature_flags` (toggle list — start empty for SB-2b unless spec §8.2 prescribes a starter set; lock the JSON shape `Record<string, boolean>`).
   - One `limit_value` input per dimension declared in step 2 (read from `saas_usage_dimensions`). Each input has a "∞ Unlimited" checkbox that nulls the value (spec §8.2).
   - Tier rows are NOT removable (rank is structural). Add validation that all three tier rows have a name + price (price step enforces this in step 4).
2. **Pricing step (`pricing-step-client.tsx`)** — per tier:
   - Monthly price input (cents-inc-GST). Locked >0.
   - Setup fee defaults from new setting `billing.saas.monthly_setup_fee_cents` (route through `settings.get()`; route any literal through registry).
   - Annual price = monthly per spec §1 Q5 (no separate input — render as a derived "Annual: monthly × 12" preview).
   - Live preview block under each row: "Monthly $X · Annual billed monthly $X · Annual upfront $Y" (Y = monthly × 12).
3. **Demo-config step (`demo-config-step-client.tsx`)** — toggle `demo_enabled` + JSON config (start with a thin shape, e.g. `{ sample_payload?: string }`; spec §8.2 lets it be optional).
4. **Review step** — full summary of name / dimensions / tiers / pricing / demo flag with "Edit" buttons per section that jump back via `setIndex`. Wire into the existing `review-and-confirm` step type (see `wizard-steps/review-confirm-step.tsx` for the contract).
5. **Celebration step** — voice-treated copy from `voiceTreatment.outroCopy` ("Product live. The popcorn machine is on."); sound trigger from the locked 8-sound registry (use the "completion" key — verify name in `lib/sound/registry.ts` first).
6. **`publishSaasProductAction(productId, draftPayload)`** — end-to-end:
   - Admin gate.
   - Single `db.transaction`: insert tier rows + tier_limits rows + flip `saas_products.status` to `active` + bump `updated_at_ms`. Activity log: `kind: 'saas_product_published'` (already in enum).
   - **Outside** the transaction: call `syncProductToStripe(productId)` then `syncTierPricesToStripe(tierId)` per tier. Stripe failures: revert the product back to `draft` (separate write) and surface error in the wizard error tray. Log a `kind: 'note'` activity row with `meta.kind: 'saas_product_publish_stripe_failed'` capturing the Stripe error message.
   - On success: write the `wizard_completions` row (mirrors `actions-pixieset.ts`), return `{ ok: true, observatorySummary }`.
7. **New setting key** — `billing.saas.monthly_setup_fee_cents` (default 0). Append a seed migration; update `docs/settings-registry.md` row + `lib/settings/keys.ts` registration.
8. **Resume integrity** — `saas-product-setup-client.tsx` already stashes `productId`. Wire the new steps to read it. If a user lands on step 3 with no `productId` (e.g. resumed past expiry), reroute to step 2.

## Out of scope for SB-2b (defer to SB-2c)

- Product detail page `/lite/admin/products/[id]` (spec §8.3).
- Archive / un-archive UI (spec §8.4).
- Subscriber count / MRR / churn analytics on the index — wait for SB-7/SB-8.
- Tier deletion (rank is structural; tier deletion is a SB-2c concern under archive/lifecycle).
- `scheduled_tasks.task_type` enum additions — first SB-* wave that enqueues `saas_data_loss_warning` (SB-9) per `sb-1-handoff.md`.

## Gates

- **G0** read this brief + `sessions/sb-2a-handoff.md` + `sessions/sb-1-handoff.md` + spec §4.5 + §8.2 (steps 3–6) + `lib/billing/stripe-product-sync.ts` (entire file — it's the contract).
- **G1** preconditions verify before code:
  - `lib/wizards/defs/saas-product-setup.ts` exists and registers all 7 steps.
  - `lib/billing/stripe-product-sync.ts` exports `syncProductToStripe` + `syncTierPricesToStripe` + `archiveTierPrices`.
  - `lib/db/schema/saas-tiers.ts` + `saas-tier-limits.ts` exist.
  - `ACTIVITY_LOG_KINDS` includes `saas_product_published` + `saas_product_created`.
  - `saas-product-setup-client.tsx` exposes the `__draft.productId` slot in its state bag.
- **G2** cite `docs/specs/saas-subscription-billing.md §4.5, §8.2, §1.1` in commit message.
- **G3** file whitelist:
  - `app/lite/setup/admin/[key]/clients/tier-editor-step-client.tsx` (NEW)
  - `app/lite/setup/admin/[key]/clients/pricing-step-client.tsx` (NEW)
  - `app/lite/setup/admin/[key]/clients/demo-config-step-client.tsx` (NEW)
  - `app/lite/setup/admin/[key]/clients/saas-product-setup-client.tsx` (modify — wire steps 3–6 + publish)
  - `app/lite/setup/admin/[key]/actions-saas-product.ts` (modify — add `publishSaasProductAction`)
  - `lib/wizards/defs/saas-product-setup.ts` (modify — `verify()` returns ok, step 6 config gets the real summary callback)
  - `lib/db/migrations/0022_sb2b_setup_fee_setting.sql` (NEW seed migration)
  - `docs/settings-registry.md` (1 row added)
  - `lib/settings/keys.ts` (1 key added)
  - `tests/saas-products/sb2b-tier-editor.test.ts` (NEW)
  - `tests/saas-products/sb2b-publish-action.test.ts` (NEW — happy + Stripe-rollback paths)
  - `tests/saas-products/sb2b-setting-seed.test.ts` (NEW — seed migration writes the row with the right default)
  - `sessions/sb-2b-handoff.md` + `sessions/sb-2c-brief.md` + `SESSION_TRACKER.md`.
- **G4** literal grep: `monthly × 12` math is structural per spec §1 Q5 — comment inline. Setup fee default routes through `settings.get()` always; no literals in autonomy-sensitive paths.
- **G5** motion: `houseSpring` on tier-row toggle/edit reveals; `AnimatePresence` on review-step "Edit" jumps; celebration step inherits the registry sound from the existing 8-sound registry.
- **G6** rollback: seed migration is reversible (0022 down-migration writes `DELETE FROM settings WHERE key = '…'`); publish path is reversible by reverting the status flip + archiving the Stripe Prices via `archiveTierPrices` (don't delete — keeps historical subscriber state per spec §4.1).
- **G7** npm deps: zero new packages.
- **G10.5** external-reviewer gate: **required** (first end-to-end SaaS publish path; touches Stripe live wiring). Self-review against:
  - `feedback_individual_feel` — wizard chrome consistent with the SW-9 family.
  - `feedback_setup_is_hand_held` — pricing math is shown live, not hidden behind a "review" leap.
  - `feedback_curated_customisation` — three fixed tier rows, not a "Add tier" picker.
  - `feedback_motion_is_universal` — every step transition + tier edit + review-edit jump animates.
  - `project_saas_popcorn_pricing` — verify the medium→large gap-in-price + jump-in-value framing is visible to Andy at the pricing step (call it out in inline copy if the math doesn't already).
- **G11.b** next brief: `sessions/sb-2c-brief.md` (product detail page + archive/un-archive). Pre-compile in this same session.
- **G12** verification:
  - `npx tsc --noEmit` zero errors.
  - `npm test` green.
  - Manual browser check **mandatory**: complete the wizard end-to-end on a fresh draft from SB-2a's manual verify; confirm Stripe Dashboard (test mode) shows one Product with three Prices per tier.
  - Playwright not required this slice (SB-E2E owns the full critical-flow run).

## Mid-session checkpoint
At ~70% context, write an interim handoff and stop. Tier editor + pricing alone justify a split if step 5 (demo-config) starts ballooning.

## Open question for Andy
**None expected.** Tier rank semantic (1/2/3 = small/medium/large), monthly = annual rate, 3 cadences per tier — all locked in spec §4.5 + §1 Q5. If anything ambiguous surfaces, lock silently per `feedback_technical_decisions_claude_calls`.

## Memory-alignment to check before starting
- `project_saas_popcorn_pricing` — tier-rank semantic and the medium→large pricing logic.
- `feedback_setup_is_hand_held` — wizard reads as a guided walk.
- `feedback_individual_feel` — admin chrome continuity with `/lite/admin/invoices` and `/lite/admin/deals`.
- `feedback_motion_is_universal` — every state change animates.
- `feedback_takeaway_artefacts_brand_forward` — N/A this slice (no exports).
- `project_settings_table_v1_architecture` — every tunable through `settings.get()`.
- `project_two_perpetual_contexts` — N/A this slice (no LLM calls).
