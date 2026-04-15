# sb-2c — handoff

**Wave 8 SB-2c CLOSED 2026-04-15.** SaaS product detail page + archive / un-archive lifecycle shipped.

## What landed

- **`/lite/admin/products/[id]` detail page** (`app/lite/admin/products/[id]/page.tsx`) — server-rendered header (name + status pill + slug + created date + Stripe Product link in test mode), dimensions grid, per-tier cards showing monthly price / setup fee / per-dimension limits (with "Unlimited" for `limit_value=null` per `project_tier_limits_protect_margin`) / feature flags / the three Stripe Price IDs. Empty/missing data states for every section — no blank screens.
- **`StatusPillClient`** (`app/lite/admin/products/[id]/clients/status-pill-client.tsx`) — keyed on status so the pill mounts fresh on each flip; animates in via `houseSpring` (G5).
- **`ArchiveButtonClient`** (`app/lite/admin/products/[id]/clients/archive-button-client.tsx`) — muted-weight button (not primary, per `feedback_primary_action_focus`) + `AnimatePresence` confirm modal with `houseSpring` entry. Handles both archive + un-archive modes. Inline error surface if the action rejects.
- **`archiveSaasProductAction` + `unarchiveSaasProductAction`** (`app/lite/admin/products/actions-archive.ts`) — admin-gated. Archive: single txn flips `active→archived` + writes `activity_log kind="saas_product_archived"`; outside the txn, loops `archiveTierPrices(tierId)` per tier + `syncProductToStripe(productId)` so the Stripe Product flips to `active=false`. Stripe failure logs `kind:"note" + meta.kind:"saas_product_archive_stripe_failed"` and leaves local status archived (helpers are idempotent; re-running cleans up). Un-archive: pure local `archived→active` flip + `syncProductToStripe` to flip the Stripe Product back; archived Prices stay archived (immutable — the UI copy calls this out).
- **Index archive filter** (`app/lite/admin/products/page.tsx`) — `listSaasProducts({ includeArchived })` via `?archived=1` query; "Show archived / Hide archived" toggle at the top of the list. Default view filters to draft + active (AC5). Rows now `Link` through to the detail page.
- **Query extensions** (`lib/saas-products/queries.ts`) — `listSaasProducts({ includeArchived })` replaces the old signature (non-breaking: default filters to draft+active); new `listActiveSaasProducts()` for SB-6's customer-facing picker; new `loadSaasProductDetail(id)` returns `{ row, dimensions, tiers: Array<{ row, limits: Array<{ dimension, limit|null }> }> }`.

## Silent reconciles (per `feedback_technical_decisions_claude_calls`)

- Brief AC4 said "surface a muted note in the admin UI" — rendered as a dedicated archived-state banner above the tiers section so it's visible whenever the product is archived, not just inside the modal. The modal copy already carries the warning at the action moment.
- Brief mentioned "Stripe Product link in test mode" — chose `https://dashboard.stripe.com/test/products/{id}` (unconditional test path); Andy runs test mode pre-launch. Live-mode swap is a one-line change later.
- `saas_product_unarchived` isn't in `ACTIVITY_LOG_KINDS` — used generic `kind="note"` with `meta.kind="saas_product_unarchived"` to avoid an unrelated enum migration. Matches the `saas_product_publish_stripe_failed` precedent from SB-2b.
- Archive action logs Stripe-sync failure but returns `{ ok: true, stripeSynced: false }` rather than `{ ok: false }` because local state did flip; the UI needs that distinction to tell Andy "archived locally, Stripe is catching up" vs "nothing changed".

## Verification

- `npx tsc --noEmit` → 0 errors.
- `npm test` → **752 passed / 1 skipped (753)** (+12 new: 5 queries + 7 archive-action).
- Playwright N/A this slice.
- **Manual browser check owed** — deferred to Andy; archive + un-archive happy paths are fully unit-covered with a hermetic Stripe fake.

## PATCHES_OWED opened

- `sb2c_manual_browser_verify` — Andy to walk: open a published product → archive → confirm disappears from default index → toggle "Show archived" → confirm reappears → open detail → un-archive → confirm it's back in the default list. Also confirm Stripe test-mode Dashboard shows the Product flipped to `active=false` + the three tier Prices × 3 cadences = 9 Prices also `active=false`.

## Gate notes

- **G4** literal grep: status strings go through the `SaasProductStatus` enum (`"active"` / `"archived"` compared against `product.status`); no autonomy-sensitive literals. Confirmation-copy strings live in the client component (UX, not a routing rule).
- **G10.5** self-assessed: no LLM call, no critical flow, no public surface — external reviewer not required. Memory-alignment self-check: `feedback_individual_feel` (muted destructive action), `feedback_primary_action_focus` (archive = secondary weight + confirm modal), `feedback_motion_is_universal` (status pill + modal both animate).

## Next session

**Judgement call per G11.b.** Two candidates, both valid:

1. **SB-3** — subscription lifecycle admin (paused / cancelled / past_due surfaces). Builds on the new product detail page with per-subscriber drill-down. Ordering fits if Andy wants to keep the SaaS arm's admin complete before exposing customer-facing flows.
2. **SB-6** — customer subscribe flow (the first consumer of `listActiveSaasProducts()`). Externalises the work to the trial users/prospects side. Ordering fits if Andy wants to start collecting real signups.

**Recommendation: SB-3.** Admin side should be complete before the first customer subscribes — otherwise a failure mode in lifecycle handling lands with live data rather than dry-run. Brief for SB-3 not compiled this session (judgement intentionally deferred per G11.b allowance); the next session should pick one + compile fresh.

## What the next agent should know

- `listSaasProducts()` signature changed — now takes optional `{ includeArchived?: boolean }`. All current callers (index page) updated; any future caller that wants the old behaviour just calls it with no args.
- `loadSaasProductDetail(id)` includes missing-limit rows as `{ dimension, limit: null }` so the UI can render "Unlimited" vs "—" differently. Don't assume every (tier, dimension) pair has a `saas_tier_limits` row — SB-2b inserts one per dimension at publish, but tests include the ragged case.
- `archiveTierPrices(tierId)` in `lib/billing/stripe-product-sync.ts` is idempotent (Stripe's `prices.update({active:false})` is), so re-archiving is safe.
- `ACTIVITY_LOG_KINDS` already contained `saas_product_archived` from earlier consolidation — no schema edit was needed.
- Un-archive doesn't resurrect Stripe Prices; they stay billable for existing subscribers only. Any future tier-price edit goes through the supersede path (deferred to SB-4).
