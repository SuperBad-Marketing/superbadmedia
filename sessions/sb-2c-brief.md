# `sb-2c` — SaaS product detail page + archive / un-archive flow

**Wave:** 8. **Type:** FEATURE. **Spec:** `docs/specs/saas-subscription-billing.md` §8.3, §8.4.
**Predecessor:** `sessions/sb-2b-handoff.md` — full publish wizard ships; `saas_products.status ∈ {draft, active, archived}`.

**Model:** `/deep` (Opus). Lifecycle state machine + Stripe archive side-effects + admin surface polish.

## Goal

Ship the product detail page at `/lite/admin/products/[id]` + the archive / un-archive lifecycle. After SB-2c, Andy can open a published product, see its full shape, archive it (hides from customer picker + flips Stripe Prices to `active=false`, preserves historical subscriber billing per spec §4.1), and un-archive if he changes his mind.

## Acceptance criteria (G12)

1. **`/lite/admin/products/[id]` server page** — summary card (name / slug / status pill / created-at / Stripe Product link in test mode) + dimensions list + tiers with per-tier monthly + setup-fee + per-dimension limits + feature flags + Stripe price IDs (read-only). Empty/missing data states — no blank screens.
2. **Status pill** — draft (muted) / active (brand green) / archived (muted-warning). `houseSpring` on status flips.
3. **Archive action** — admin button on active products. `archiveSaasProductAction(productId)`:
   - Single txn: flip `saas_products.status active→archived` + bump `updated_at_ms` + write `activity_log kind="saas_product_archived"` (add to `ACTIVITY_LOG_KINDS` if not present — verify first).
   - Outside txn: call `archiveTierPrices(tierId)` per tier (already exists in `lib/billing/stripe-product-sync.ts`) + `syncProductToStripe(productId)` (which picks up `active=false` now that status is archived).
   - On Stripe failure: log `kind:"note" + meta.kind="saas_product_archive_stripe_failed"`, leave local status archived (Stripe is catch-up — re-running the action is idempotent via existing helpers).
4. **Un-archive action** — admin button on archived products. `unarchiveSaasProductAction(productId)`:
   - Flip `archived→active`. Existing Stripe Prices stay archived (immutable); the product's customer-facing picker will surface it again but any new tier-price changes follow the usual supersede path (deferred to SB-4 or similar).
   - **Gotcha:** the spec notes that un-archiving doesn't resurrect Stripe Prices. Surface a muted note in the admin UI: "New customers will subscribe to the current active Prices. Archived Prices stay billable for existing subscribers."
5. **Index page hides archived by default** — `/lite/admin/products` gets a "Show archived" toggle; default filter = `status IN ("draft", "active")`.
6. **Customer-facing picker query** — confirm `lib/saas-products/queries.ts` has (or add) a `listActiveSaasProducts()` that filters to `status = "active"` for wherever the customer-side subscribe flow eventually reads (SB-6). Pure query now; no consumer this slice.

## Out of scope for SB-2c (defer to later SB waves)

- Tier editing on a published product (supersede-and-replace — SB-4).
- Deleting a product entirely (not in spec — archive is the soft-delete).
- Bulk actions on the index.
- MRR / subscriber analytics (SB-7/SB-8).
- Stripe webhook handlers for product archival cascade (no handler exists; archival is admin-initiated).

## Gates

- **G0** read this brief + `sessions/sb-2b-handoff.md` + spec §8.3 + §8.4 + `lib/billing/stripe-product-sync.ts` (`archiveTierPrices` contract).
- **G1** preconditions verify before code:
  - `saas_products.status` enum includes `archived`.
  - `archiveTierPrices(tierId)` exists and is idempotent.
  - `saas_product_archived` either exists in `ACTIVITY_LOG_KINDS` or is safely addable (grep first).
  - `/lite/admin/products` index page exists (landed in SB-2a).
- **G2** cite `docs/specs/saas-subscription-billing.md §8.3, §8.4` in commit message.
- **G3** file whitelist:
  - `app/lite/admin/products/[id]/page.tsx` (NEW — server page)
  - `app/lite/admin/products/[id]/clients/archive-button-client.tsx` (NEW — button + confirm modal)
  - `app/lite/admin/products/actions-archive.ts` (NEW — `archiveSaasProductAction` + `unarchiveSaasProductAction`)
  - `app/lite/admin/products/page.tsx` (modify — add Show archived toggle + filter)
  - `lib/saas-products/queries.ts` (modify — add `loadSaasProductDetail(id)` + `listActiveSaasProducts()`)
  - `lib/db/schema/activity-log.ts` (modify if `saas_product_archived` missing)
  - `tests/saas-products/sb2c-archive-action.test.ts` (NEW — happy + Stripe-failure-leaves-local-archived + un-archive)
  - `tests/saas-products/sb2c-queries.test.ts` (NEW — detail shape + archived-hidden-by-default)
  - `sessions/sb-2c-handoff.md` + `sessions/sb-2d-brief.md` (if needed) + `SESSION_TRACKER.md`.
- **G4** literal grep: no literal "archived" in autonomy-sensitive paths — gate via `saas_products.status` enum values. Confirmation copy for archive lives in the client component (UX copy, not a routing rule).
- **G5** motion: `houseSpring` on status pill flips + archive-confirm modal `AnimatePresence`.
- **G6** rollback: archive is reversible via un-archive; Stripe Price archival is one-way (documented in UI copy per AC4).
- **G7** npm deps: zero new packages.
- **G10.5** external-reviewer gate: **not required** (incremental admin CRUD; no new LLM call, no new critical flow, no public surface). Self-review against `feedback_individual_feel` + `feedback_primary_action_focus` + `feedback_motion_is_universal`.
- **G11.b** next brief: judgement call — if the product page lands cleanly, next could be SB-3 (subscription lifecycle admin) or SB-6 (customer subscribe flow). Compile whichever the spec sequences next; the handoff can defer the call.
- **G12** verification:
  - `npx tsc --noEmit` zero errors.
  - `npm test` green.
  - Manual browser check **mandatory**: archive a product, confirm it disappears from the default index view, un-archive, confirm it reappears.

## Open question for Andy

**None expected.** Archive is spec-locked as status flip + Stripe Price `active=false`. Un-archive is a pure local status flip per spec §8.4.

## Memory-alignment to check before starting

- `feedback_individual_feel` — product detail chrome consistent with `/lite/admin/invoices/[id]` family.
- `feedback_primary_action_focus` — archive button is a destructive-ish action; muted visual weight + confirm modal, not a primary CTA.
- `feedback_motion_is_universal` — every state change animates.
- `project_tier_limits_protect_margin` — read-only limit display on the detail page should make it obvious which tier unlocks what.
