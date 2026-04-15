# `sb-2` — SaaS product admin (`/lite/products` + `saas-product-setup` wizard)

**Wave:** 8. **Type:** FEATURE. **Spec:** `docs/specs/saas-subscription-billing.md` §1.1 (wizard reference), §8 (product admin), §11.1 (schema, already landed).
**Predecessor:** `sessions/sb-1-handoff.md` — schema + `lib/billing/stripe-product-sync.ts` are live; sync helpers have **never been called** by app code yet (SB-2b wires them).
**Wizard primitive owner:** `docs/specs/setup-wizards.md` §5.2; shell lives in `lib/wizards/` + `app/lite/setup/admin/[key]/`.

> **This card splits.** SB-2 is too large for a single session per Phase 5 sizing (spec §19 calls Session B "medium-large", and that estimate predates the wizard-shell offload). Run **SB-2a first; SB-2b in a fresh session.** Product detail page (spec §8.3) is **deferred to a future SB-2c** — call that out in the SB-2b handoff if it isn't pulled forward.

---

## SB-2a — Index page + wizard shell (steps 1–2 only)

**Model:** `/deep` (Opus). New surface, new wizard def, new Server Actions, draft persistence — judgement-heavy. **No Stripe calls in this slice.**

### Goal
Stand up `/lite/products` and the `saas-product-setup` wizard far enough that Andy can: open the index, click "New product", complete steps 1 (name/description/slug) and 2 (usage dimensions), and have a **`saas_products` row in `status='draft'`** persist with its dimensions. Steps 3–7 are stubbed as "Coming in SB-2b" placeholder steps (so the wizard def's full step list is shape-complete; SB-2b fills in their components without re-registering the def).

### Acceptance criteria (G12)

1. **`app/lite/admin/products/page.tsx`** — admin-gated Server Component matching the `/lite/admin/*` pattern (mirror `app/lite/admin/invoices/page.tsx` for nav placement, breadcrumb, page-shell). Spec §8.1.
   - **Summary cards row** (4 cards, top): "Active subscribers" / "Total MRR" / "New this month" / "Churn this month". For SB-2a, **all four read 0** — no subscribers exist yet. The cards are present, query helpers return 0 deterministically. Real values land when SB-7/SB-8 wire `usage_records` + subscription deltas. Cite `feedback_individual_feel` for card layout consistency with the invoices index.
   - **Product list below** — card per row from `saas_products`: name, status badge (draft/active/archived with the existing pill component), subscriber count (0 for now), product MRR (0), tier breakdown bar chart **placeholder** (empty bar with "No tiers yet" if no tiers exist; SB-2b paints the real distribution).
   - **"New product" button** top-right → `/lite/setup/admin/saas-product-setup` (the standard admin wizard route from SW-9).
   - Empty state if zero products: dry copy ("No products yet. The popcorn machine is off.") + the "New product" CTA. Honour `feedback_takeaway_artefacts_brand_forward` only if surfacing exports — N/A here.

2. **`lib/saas-products/queries.ts`** — server-only query module with three functions used by the index:
   - `listSaasProducts()` → returns `Array<{ row: SaasProductRow; tierCount: number; subscriberCount: number; mrrCents: number }>`. For SB-2a `subscriberCount` and `mrrCents` are stubbed to `0` (helper exists; SB-7 fills it). Document the stub in JSDoc citing this brief.
   - `getSaasProductSummaryCounts()` → returns `{ activeSubscribers: 0, mrrCents: 0, newThisMonth: 0, churnThisMonth: 0 }` — same stub shape; same JSDoc note.
   - `findSaasProductBySlug(slug)` → `SaasProductRow | null` for slug-uniqueness checks.

3. **`lib/wizards/defs/saas-product-setup.ts`** — `WizardDefinition<SaasProductSetupPayload>` registered via `registerWizard()` on import:
   - `key: "saas-product-setup"`, `audience: "admin"`, `renderMode: "slideover"` (per spec §1.1).
   - `killSwitchKey: "setup_wizards_enabled"` (shared family flag — same as SW-9/10/11/12).
   - **Step list (full 7-step shape registered now):**
     1. `name-and-slug` — `type: "form"`, label "Name", config wraps Zod schema `{ name: string≥2, description: string nullable, slug: string slug-regex /^[a-z0-9-]+$/ ≥2 }` + custom slug-uniqueness check (calls `findSaasProductBySlug` from a Server Action; rejects on conflict with branded copy).
     2. `usage-dimensions` — `type: "custom"`, label "Usage dimensions". Component is `DimensionsStepClient` (see #4). State shape: `{ dimensions: Array<{ tempId: string; key: string; displayName: string }> }`. Validate: 1 ≤ length ≤ 3 (spec §8.2 + Q3 in §1); each `key` matches `/^[a-z][a-z0-9_]*$/`; keys unique within the array. Plain-English helper text on what a "dimension" is per spec §8.2 + memory `feedback_setup_is_hand_held`.
     3. `tiers` — `type: "custom"`, **stub component** that renders "Coming in SB-2b" + a disabled "Continue" button. Validate: `() => invalid("Tier editor not implemented yet")`. Step is registered so resume works post-SB-2b without a def-level migration.
     4. `pricing` — same stub pattern.
     5. `demo-config` — same stub pattern.
     6. `review` — `type: "review-and-confirm"`, stub config (SB-2b populates the summary).
     7. `celebration` — `type: "celebration"`, no behaviour for SB-2a (unreachable until step 3+ are real).
   - `completionContract.verify` — for SB-2a, throw `NotImplementedError("saas-product-setup completion lands in SB-2b")`. The wizard cannot reach completion until 2b ships, so this is unreachable in practice but typed-correct.
   - `artefacts.integrationConnections: false` (SaaS products don't write to `integration_connections`); `artefacts.wizardCompletions: true`.
   - **No `unstable_update()`** — saas-product-setup isn't a critical-flight wizard.

4. **`app/lite/setup/admin/[key]/clients/saas-product-setup-client.tsx`** + **`app/lite/setup/admin/[key]/clients/dimensions-step-client.tsx`** — follow the SW-7/SW-9 split pattern. The dispatcher in `page.tsx` adds a new `case "saas-product-setup":` branch.
   - `dimensions-step-client.tsx` renders an editable list of up to 3 rows (`displayName` text input + auto-derived `key` slug suggestion that the user can override; "Add dimension" button disabled at 3; "Remove" button on each row; min-1 enforced visually). House-spring entrance/exit on add/remove (`framer-motion` `AnimatePresence` + `houseSpring`) per `feedback_motion_is_universal`.

5. **Server Actions in `app/lite/setup/admin/[key]/actions-saas-product.ts`:**
   - `checkSaasProductSlugAction(slug)` → `{ ok: true } | { ok: false; reason }`. Used by the form step's slug field for live uniqueness feedback.
   - `persistSaasProductDraftAction(payload: { name; description; slug; dimensions: Array<{ key; displayName }> })` — runs **inside one `db.transaction`**:
     1. Re-check slug uniqueness (race-safe).
     2. Insert `saas_products` row with `status: 'draft'`, no `stripe_product_id`, `display_order = (max + 1)`.
     3. Insert one `saas_usage_dimensions` row per submitted dimension, `display_order = index`.
     4. Write `activity_log` with `kind: 'saas_product_created'` (already in the enum from SB-1).
     5. Return `{ ok: true; productId }` for the wizard shell to stash for SB-2b to resume against.
   - This action is invoked from the dimensions step's `onNext` (advancing past step 2 = a draft product exists). Steps 3+ then read+write the same `productId` via SB-2b actions.
   - Failure path: any step throws → transaction rolls back, no partial draft. Surface branded copy in the wizard's error tray.

6. **Settings keys:** none new this slice. `billing.saas.monthly_setup_fee_cents` (BUILD_PLAN-owned by SB-2 overall) lands in **SB-2b** alongside the pricing step that consumes it. If a tunable surfaces unexpectedly, route through `settings.get()` per `project_settings_table_v1_architecture`.

7. **Tests** under `tests/saas-products/`:
   - `sb2a-index-queries.test.ts` — seed two products (one draft, one active), assert `listSaasProducts()` returns both with stubbed counts; assert `getSaasProductSummaryCounts()` returns all-zeros; assert `findSaasProductBySlug` hit + miss.
   - `sb2a-persist-draft.test.ts` — seed an admin user; call `persistSaasProductDraftAction` with a clean payload, assert row + dimensions + activity_log; call again with same slug, assert rejection; call with 4 dimensions, assert validation rejection; call with duplicate dimension keys, assert rejection.
   - `sb2a-wizard-def.test.ts` — import the def, assert step list shape (7 entries with the right `type` + `key`), audience = admin, renderMode = slideover, killSwitchKey, registration in barrel after `import "@/lib/wizards/defs"` side effect. Mirror the shape assertions in `tests/pixieset-admin-wizard.test.ts`.

8. **Barrel update** — `lib/wizards/defs/index.ts` adds `import "./saas-product-setup";` so registration fires on first import (matches the SW-9 pattern).

### Out of scope for SB-2a (defer to SB-2b unless flagged)

- Tier editor + feature-flag toggles (step 3) → SB-2b.
- Pricing step + GST math + setup-fee field + price preview → SB-2b. Settings key `billing.saas.monthly_setup_fee_cents` lands here.
- Demo-config step (step 5) → SB-2b.
- Real `review-and-confirm` summary (step 6) → SB-2b.
- Celebration content → SB-2b.
- Stripe publish wiring (`syncProductToStripe` + `syncTierPricesToStripe`) → SB-2b.
- Product detail page `/lite/admin/products/[id]` (spec §8.3) → **SB-2c** (deferred from this wave's split).
- Archive / un-archive UI (spec §8.4) → SB-2c.
- Real subscriber/MRR/churn analytics on the index → SB-7/SB-8 once `usage_records` + subscription deltas exist.
- `scheduled_tasks.task_type` enum additions (spec §11.4) → first SB-* wave that enqueues `saas_data_loss_warning` (SB-9) per `sb-1-handoff.md`.

### Gates

- **G0** read this brief + `sessions/sb-1-handoff.md` + `sessions/sw-9-handoff.md` (admin-tree pattern reference) + spec §1.1 + §8.1 + §8.2.
- **G1** preconditions verify before code:
  - `lib/db/schema/saas-products.ts` exists + `SAAS_PRODUCT_STATUSES` exported.
  - `lib/db/schema/saas-usage-dimensions.ts` exists with `UNIQUE(product_id, dimension_key)`.
  - `lib/wizards/registry.ts` exports `registerWizard` + `getWizard`.
  - `app/lite/setup/admin/[key]/page.tsx` exists + dispatches by `def.key`.
  - `setup_wizards_enabled` setting key exists in `docs/settings-registry.md` + `settings` table.
  - `activity_log.kind` includes `saas_product_created` (added in SB-1; verify with grep).
  - `lib/db/schema/index.ts` re-exports the SaaS schema modules.
  - If any precondition is missing, **stop and reroute** — don't build on a claim from SB-1's handoff that the repo doesn't back up.
- **G2** cite `docs/specs/saas-subscription-billing.md §8.1, §8.2, §1.1` in commit message.
- **G3** file whitelist (NEW unless noted):
  - `app/lite/admin/products/page.tsx`
  - `app/lite/admin/products/products-index-client.tsx` (only if interactivity needed beyond the link CTA — try server-only first)
  - `lib/saas-products/queries.ts`
  - `lib/wizards/defs/saas-product-setup.ts`
  - `lib/wizards/defs/index.ts` (1-line import addition)
  - `app/lite/setup/admin/[key]/clients/saas-product-setup-client.tsx`
  - `app/lite/setup/admin/[key]/clients/dimensions-step-client.tsx`
  - `app/lite/setup/admin/[key]/page.tsx` (1-case dispatcher addition)
  - `app/lite/setup/admin/[key]/actions-saas-product.ts`
  - `tests/saas-products/sb2a-index-queries.test.ts`
  - `tests/saas-products/sb2a-persist-draft.test.ts`
  - `tests/saas-products/sb2a-wizard-def.test.ts`
  - `sessions/sb-2a-handoff.md` + `sessions/sb-2b-brief.md` + `SESSION_TRACKER.md`.
  - **Nothing else.** No schema migration, no settings migration, no Stripe code path touched.
- **G4** literal grep: dimensions cap `3`, dimensions floor `1`, slug regex — all are **structural product rules from spec §8.2 + Q3**, not autonomy thresholds. Document inline with a `// spec §8.2` comment so the audit pass doesn't flag them. No review windows / timeouts / confidence cutoffs introduced.
- **G5** motion: dimensions step uses `houseSpring` for add/remove (`feedback_motion_is_universal`); index page card hover/tap follows the existing admin-list pattern; slideover wizard inherits motion from the shell — no new transitions.
- **G6** rollback: no migration ⇒ git-revert clears the slice. Killing `setup_wizards_enabled` (existing setting) hides the wizard route. Index page is read-only on draft data; reverting the page leaves no orphan rows because no rows exist yet in production.
- **G7** npm deps: zero new packages.
- **G10.5 external-reviewer gate:** **required** (new admin surface + new wizard + new Server Actions = first user-touchable SaaS surface). Self-review against:
  - `feedback_individual_feel` — admin index visual consistency with `/lite/admin/invoices` + `/lite/admin/deals`.
  - `feedback_setup_is_hand_held` — dimensions step copy explains "what is a dimension" plainly; no raw form vibes.
  - `feedback_curated_customisation` — slug field offers an auto-suggested slug from name; doesn't expose a free-form picker for tier-rank or status (those stay structural).
  - `feedback_motion_is_universal` — dimensions add/remove animates; wizard transitions handled by shell.
  - `feedback_no_lite_on_client_facing` — admin surface, "SuperBad Lite" branding fine here.
- **G11.b** next brief: `sessions/sb-2b-brief.md` (tier editor + pricing + demo-config + review + celebration + Stripe publish wiring). Pre-compile in this same session per the rolling-cadence rule.
- **G12** verification:
  - `npx tsc --noEmit` zero errors.
  - `npm test` green; new tests counted.
  - Manual browser check: navigate to `/lite/admin/products` (logged in as admin), click "New product", complete steps 1–2, refresh `/lite/admin/products` and confirm the new draft product appears in the list. **Mandatory** — first user-touchable SaaS surface.
  - Playwright: not required this slice (SB-E2E owns the full critical-flow run).

### Mid-session checkpoint
At ~70% context, write an interim handoff and stop cleanly. Better to ship index + wizard def alone (with steps 3+ stubbed) and split persistence into a follow-up than to ship drift.

### Open question for Andy
**None expected.** Slug regex, dimension key regex, dimension cap, tier rank semantic — all locked in spec §8.2 + §11.1 + Q3. If anything ambiguous surfaces, lock silently per `feedback_technical_decisions_claude_calls`.

### Memory alignment to check before starting
- `feedback_setup_is_hand_held` — wizard copy reads as a guided walk, not a form dump.
- `feedback_individual_feel` — admin surfaces still feel personal, not communal SaaS.
- `feedback_motion_is_universal` — every state change animates with `houseSpring`.
- `feedback_takeaway_artefacts_brand_forward` — N/A this slice (no exports).
- `project_saas_popcorn_pricing` — note for SB-2b: tier ordering 1=small, 2=medium, 3=large, with the medium→large gap small in price + big in value.
- `project_settings_table_v1_architecture` — any tunable surfacing unexpectedly routes through `settings.get()`.
- `project_two_perpetual_contexts` — N/A this slice (no LLM calls; SB-2 doesn't read Brand DNA / Client Context).

---

## SB-2b — Tier editor + pricing + demo-config + review + Stripe publish (next session)

**Model:** `/deep` (Opus). State machines + Stripe round-trips + price math + `review-and-confirm` summary.

### Goal
Fill in the four stubbed steps (3 tier editor, 4 pricing, 5 demo-config, 6 review, 7 celebration), implement the publish action that calls `syncProductToStripe` + `syncTierPricesToStripe` from SB-1, and write the activity-log entry on transition `draft → active` (`saas_product_published`). After SB-2b ships, Andy can publish a SaaS product end-to-end and the resulting Stripe Product + 9 Prices (3 tiers × 3 cadences) exist in the test-mode Stripe account.

### Acceptance criteria (high-level — full brief authored at SB-2a close)

1. **Tier step (`tier-editor-step-client.tsx`)**: 3 fixed-rank rows (tier_rank 1/2/3 — structural, not user-removable). Per row: name (text), feature_flags (toggle list seeded from a per-product registry — start empty for SB-2b unless spec §8.2 demands a starter set), per-dimension limit_value inputs (`null` checkbox = unlimited).
2. **Pricing step (`pricing-step-client.tsx`)**: per-tier monthly price (cents-inc-GST input); setup fee defaults from new setting `billing.saas.monthly_setup_fee_cents` (seed migration writes it; spec defaults — pick a sensible value or 0); annual price = monthly (per spec §1 Q5 — same rate, no setup fee). Live preview of all three cadence price points per tier.
3. **Demo-config step**: toggle `demo_enabled` + JSON config (start with a thin shape; spec §8.2 step 5 lets it be optional).
4. **Review step**: full summary of name/dimensions/tiers/pricing/demo-config; "Edit" buttons jump back to the relevant step.
5. **Publish action (`publishSaasProductAction`)**: transaction wraps tier inserts + tier_limits inserts + status flip to `active`; on success, calls `syncProductToStripe(productId)` then `syncTierPricesToStripe(tierId)` for each tier (outside the DB transaction — Stripe round-trips don't belong inside SQLite tx); on Stripe failure, rolls back to `draft` and surfaces error. Writes `activity_log` `saas_product_published`.
6. **Celebration step**: voice-treated copy per spec §10.1 surface 1; sound trigger from the locked 8-sound registry.
7. **New settings keys**: `billing.saas.monthly_setup_fee_cents` (default 0 unless spec §4.5 prescribes — confirm at brief time); seed migration appended.
8. **Tests**: tier-editor validation, publish-action happy + Stripe-failure rollback paths, settings key seeding.

### Out of scope for SB-2b
- Product detail page `/lite/admin/products/[id]` → **SB-2c**.
- Archive / un-archive → SB-2c.
- Subscriber count / MRR analytics → SB-7/SB-8.

### Gates
- G3 file whitelist + G10.5 reviewer gate authored in detail at SB-2a close.
- G12: typecheck, unit tests, manual browser check (publish a draft product, verify Stripe Dashboard test-mode shows the Product + 9 Prices).
- G11.b next brief: `sessions/sb-2c-brief.md` (product detail page + archive flow).

---

## Estimated context

- **SB-2a:** medium-large. New surface + new wizard def + Server Action + 3 test files + handoff + next brief. Should fit comfortably in one Opus session. Watch for context creep on the dimensions step's UX details — house-spring add/remove can swallow time.
- **SB-2b:** large. Stripe round-trips, transaction boundaries, price math, review summary. Plan to be disciplined about scope — tier-editor step alone could justify another split if it spirals.
