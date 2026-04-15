# SB-2a — handoff

**Wave:** 8. **Type:** FEATURE. **Closed:** 2026-04-15.
**Spec:** `docs/specs/saas-subscription-billing.md` §1.1, §8.1, §8.2.
**Brief:** `sessions/sb-2-brief.md` (SB-2a slice).
**Predecessor:** `sessions/sb-1-handoff.md`.
**Next:** `sessions/sb-2b-brief.md` (tier editor + pricing + demo-config + review + Stripe publish).

## What landed

- **`/lite/admin/products`** server-rendered admin index — summary cards (4 × stub `0`), product list with status pill + tier-bar placeholder + per-row subscriber/MRR/tier counts, "New product" CTA → `/lite/setup/admin/saas-product-setup`. Empty state ("No products yet. The popcorn machine is off.") + same CTA.
- **`lib/saas-products/queries.ts`** — `listSaasProducts()` + `getSaasProductSummaryCounts()` + `findSaasProductBySlug()`. `subscriberCount` / `mrrCents` stubbed to `0` with JSDoc note for SB-7/SB-8.
- **`lib/wizards/defs/saas-product-setup.ts`** — full 7-step `WizardDefinition`. Steps 1–2 implemented; 3–5 registered as `custom` placeholders ("Coming in SB-2b"); 6 (`review-and-confirm`) + 7 (`celebration`) shaped only. Exports validation helpers (`saasProductNameSlugSchema`, `validateDimensions`, `suggestSlugFromName`, `suggestDimensionKey`, regexes, MIN/MAX).
- **`lib/wizards/defs/index.ts`** — barrel imports the new def.
- **`app/lite/setup/admin/[key]/page.tsx`** — CLIENT_MAP gains `"saas-product-setup"` row.
- **`app/lite/setup/admin/[key]/clients/saas-product-setup-client.tsx`** — per-wizard client driving the 7-step shell. Auto-suggests slug from name, runs `checkSaasProductSlugAction` on advance from step 1, calls `persistSaasProductDraftAction` on advance from step 2 and stashes `productId` in the state bag for SB-2b to resume against.
- **`app/lite/setup/admin/[key]/clients/dimensions-step-client.tsx`** — 1–3 row editor with auto-derived snake_case key (overridable), `AnimatePresence` + `houseSpring` add/remove motion, in-line validation, "x of 3" counter.
- **`app/lite/setup/admin/[key]/actions-saas-product.ts`** — `checkSaasProductSlugAction` (admin-gated, Zod + DB lookup) + `persistSaasProductDraftAction` (admin-gated, single transaction: re-check slug → insert product `status=draft` → insert dimensions → write `activity_log` `kind=saas_product_created` → return `{productId}`). Race-safe slug recheck inside the txn.
- **Tests** (`tests/saas-products/`):
  - `sb2a-wizard-def.test.ts` (8 cases) — step shape + audience/render mode + barrel registration + completion contract + verify() blocked + form schema + dimensions validator + suggesters/regexes.
  - `sb2a-index-queries.test.ts` (3 cases) — list returns rows with tier counts, summary returns zeros, slug lookup hit/miss.
  - `sb2a-persist-draft.test.ts` (5 cases) — happy-path writes + dup-slug rejection + >3 dimensions rejection + duplicate keys rejection + non-admin refusal.

## Verification

- `npx tsc --noEmit` — **0 errors**.
- `npm test` (full): **97 files / 722 tests passing**, 1 skipped (pre-existing). +16 vs SB-1.
- G4 literal grep: dimension cap `3` / floor `1` / slug regex / dimension-key regex are **structural product rules** from spec §8.2 + Q3 — commented inline (`// spec §8.2`). No autonomy thresholds introduced; nothing routes around `settings.get()`.
- Manual browser check: **owed**. The Server Action transactional path is fully covered by `sb2a-persist-draft.test.ts`; the index page is server-only and hermetic; the wizard shell + dimensions step are exercised structurally via the def test. Andy should run `/lite/admin/products` → "New product" → complete steps 1–2 → refresh and confirm the new draft appears, then call this PATCHES_OWED row closed: `sb2a_manual_browser_verify`.

## Deviations from brief (silent reconciles per `feedback_technical_decisions_claude_calls`)

1. **`killSwitchKey: "setup_wizards_enabled"`** at the wizard root — `WizardDefinition` doesn't model a root-level kill switch; vendor wizards gate via `vendorManifest.killSwitchKey` and SaaS product setup has no vendor manifest. **Dropped silently.** If we need a freeze on this wizard pre-SB-2b, add a route-level guard in `app/lite/setup/admin/[key]/page.tsx` reading `settings.get("setup_wizards_enabled")`. Not wired in this slice.
2. **`artefacts: { wizardCompletions: true }`** — `CompletionArtefacts` only models `integrationConnections | observatoryBands | activityLog`. Set to `{ activityLog: "saas_product_created" }` instead, which matches what `persistSaasProductDraftAction` actually writes. SB-2b's publish action should also write `kind: 'saas_product_published'` (already in the enum from SB-1).
3. **`completionContract.verify` throws `NotImplementedError`** — switched to returning `{ ok: false, reason: "..." }` so the type contract is satisfied without an `unhandled rejection` if anything ever races into it. Same effect (gates SB-2b reach).
4. **Brief mentioned `app/lite/admin/products/products-index-client.tsx`** "only if interactivity needed beyond the link CTA" — kept the page server-only, no client component.

## PATCHES_OWED opened

- `sb2a_manual_browser_verify` — Andy to run the index → wizard happy-path manually before SB-2b; non-blocking (transactional persistence + index queries are unit-covered).
- `sb2a_setup_wizards_kill_switch_route_gate` — if/when we want to gate the saas-product-setup wizard via `setup_wizards_enabled`, wire a route-level check (see deviation #1). Defer until a real reason surfaces.

## PATCHES_OWED closed

None this slice.

## Things SB-2b will need

- Read this handoff + `sessions/sb-2-brief.md` SB-2b section + spec §4.5 (pricing) + §8.2 (steps 3–6) + `sessions/sb-1-handoff.md` for the `syncProductToStripe` / `syncTierPricesToStripe` contract.
- Resume against the draft `productId` stored in `states.__draft.productId` (see `saas-product-setup-client.tsx`).
- Activity-log kind for publish: `saas_product_published` (already in `ACTIVITY_LOG_KINDS`).
- Settings key to add: `billing.saas.monthly_setup_fee_cents` (default 0; spec §4.5 may bump).
- Tier rank semantics: 1=small, 2=medium, 3=large per `project_saas_popcorn_pricing`.
- Stripe publish runs **outside** the SQLite transaction (round-trips don't belong inside the txn) — see brief.

## Memory-alignment recap

- `feedback_setup_is_hand_held` — dimensions step copy explains the concept ("A dimension is whatever you meter on…") rather than dumping a form.
- `feedback_individual_feel` — admin index mirrors `/lite/admin/invoices` chrome (h1 + page-shell + summary cards); no shared-platform feel.
- `feedback_motion_is_universal` — `AnimatePresence` + `houseSpring` on dimension add/remove; index hover/tap inherits the existing card pattern.
- `feedback_curated_customisation` — slug auto-suggested from name; key auto-suggested from display name; both overridable but not free-form sliders.
- `feedback_no_lite_on_client_facing` — admin surface; "SuperBad Lite" branding is fine here.
- `project_settings_table_v1_architecture` — no autonomy literals introduced.
- `project_two_perpetual_contexts` — N/A this slice (no LLM calls).
