# `sb-3` — Public pricing page `/get-started/pricing` + Full Suite positioning

**Wave:** 8. **Type:** UI. **Spec:** `docs/specs/saas-subscription-billing.md` §3.1 + §10.1 (voice-treated surface) + §14 item 1.
**Predecessor:** `sessions/sb-2c-handoff.md` — `saas_products.status ∈ {draft, active, archived}`; `listActiveSaasProducts()` query exists in `lib/saas-products/queries.ts`; per-tier `saas_tier_limits` + feature flags readable via `loadSaasProductDetail(id)`.

**Model:** `/deep` (Opus). First public-facing SaaS surface. Voice-copy authored in-session (no Andy authoring per `feedback_no_content_authoring`), layout + data plumbing + motion.

## Goal

Ship the public pricing comparison grid at `/get-started/pricing`. Server-rendered, lists every `status="active"` SaaS product as a column (desktop) or stacked card (mobile), three tiers per product as rows, "Get started" buttons routing to SB-5's checkout page (which doesn't exist yet — button `href` stubs to `/get-started/checkout?tier={tierId}` and is verified only as a URL, not a live route). Full Suite section sits below the grid as its own emphasis block. Voice-treated per §10.1.

## Acceptance criteria (G12)

1. **`/get-started/pricing` server page** — public route (no auth gate). `generateMetadata()` sets title + description + OG tags. Reads products via a new `listActivePricingProducts()` returning `{ product, dimensions, tiers: [{ row, limits, featureFlags }] }[]` ordered by `created_at_ms` ascending (stable, admin-ordered by creation). Filters to `status="active"` only.
2. **Comparison grid layout** — desktop: horizontal columns per product, each column a stack of three tier cards (small / medium / large). Mobile: vertically stacked per-product cards, each expanding into its three tiers. Every cell shows tier name, GST-inclusive monthly price (per `feedback_felt_experience_wins` — the price Andy wants them to feel, not ex-GST), per-dimension usage limits with `∞` for `null`, feature-flag bullet list, "Get started" button.
3. **Full Suite section** — renders **only if** a product with `slug="full-suite"` exists in the active set. Distinct section below the per-product grid, its own three tier cards, with an inline price comparison line under the large tier that sums individual product larges and shows the saving ("vs $X/mo across the full range — $Y/mo saved"). If no Full Suite product, section is omitted silently (no placeholder).
4. **Empty state** — zero active products → dry-voice holding page ("we're not selling anything yet. come back soon." — exact copy authored this session). Not a 404, not an error; server-rendered 200.
5. **Voice copy authored in-session + homed per conventions** — the spec calls out this page as one of 12 voice-treated surfaces. Per `project_context_safety_conventions` + `feedback_no_content_authoring`: Claude drafts every line of copy (grid headings, tier framing, Full Suite positioning copy, GST note, empty state, metadata title + description) and commits it to a new `docs/content/saas-subscription-billing/pricing-page.md` file organised by surface region. Page components import from `docs/content/...` (or a `lib/content/pricing-page.ts` barrel — see G3) rather than inlining strings.
6. **Motion** — `houseSpring` on tier-card hover-raise + "Get started" button press; mobile per-product card expand/collapse via `AnimatePresence`. Motion honours `prefers-reduced-motion`.
7. **Link to home** — header logo/wordmark routes `/` (marketing site root — TBD in Phase 2 Foundations; route in this wave even if the target is a placeholder). Footer carries Privacy + Terms links (stub to existing routes if present; if not, surface a PATCHES_OWED row rather than inventing routes).

## Out of scope for SB-3 (defer to later SB waves)

- SB-4: per-product demo landing pages.
- SB-5: checkout page itself + commitment toggle + Payment Element.
- SB-6: subscription creation.
- A/B price-testing, promo codes, coupons.
- Currency switching (AUD only).
- Authenticated "upgrade from current plan" preview (SB-8).

## Gates

- **G0** read: this brief, `sessions/sb-2c-handoff.md`, spec §3.1 + §3.3 (checkout — only to understand what "Get started" hands off to) + §10 (voice) + §14 (content scope); `lib/saas-products/queries.ts` (to extend); `superbad-brand-voice` + `superbad-visual-identity` skills loaded.
- **G1** preconditions verify before code:
  - `saas_products.status` enum + `listActiveSaasProducts()` (from SB-2c) present.
  - `loadSaasProductDetail(id)` shape known.
  - `lib/saas-products/queries.ts` exports barrel usable in a server component.
  - No route already claims `/get-started/pricing` (grep).
  - `houseSpring` motion token + `AnimatePresence` usage pattern in place (established in SW / BI waves).
- **G2** commit message cites `docs/specs/saas-subscription-billing.md §3.1 + §10.1`.
- **G3** file whitelist:
  - `app/get-started/pricing/page.tsx` (NEW — server page + `generateMetadata`)
  - `app/get-started/pricing/clients/pricing-grid-client.tsx` (NEW — motion + mobile expand/collapse)
  - `app/get-started/pricing/clients/full-suite-card-client.tsx` (NEW — Full Suite emphasis block)
  - `app/get-started/layout.tsx` (NEW — public shell: header/wordmark, footer, no auth)
  - `lib/saas-products/queries.ts` (modify — add `listActivePricingProducts()` returning the full shape in one query pass; re-use `loadSaasProductDetail` internals if cheaper, but don't N+1)
  - `lib/content/pricing-page.ts` (NEW — typed barrel re-exporting strings from `docs/content/...`; component imports from here for type safety)
  - `docs/content/saas-subscription-billing/pricing-page.md` (NEW — authored copy homed per `project_context_safety_conventions`)
  - `tests/saas-products/sb3-pricing-query.test.ts` (NEW — active-only filter, empty set, Full Suite detection)
  - `tests/saas-products/sb3-pricing-page.test.tsx` (NEW — renders empty state, renders grid, renders Full Suite conditionally)
  - `tests/e2e/saas-pricing-page.spec.ts` (NEW — Playwright, seeds two active products + Full Suite, asserts grid + Full Suite block + mobile viewport expand/collapse)
  - `sessions/sb-3-handoff.md` + `sessions/sb-4-brief.md` (or `sb-5-brief.md` depending on G11.b call) + `SESSION_TRACKER.md`.
- **G4** literal grep: no hard-coded prices or tier names in components — everything flows from the query. GST rate of 10% referenced via `settings.get("billing.gst.rate")` if that key exists, otherwise derived inline from `monthly_cents` (which already represents GST-inclusive per `feedback_felt_experience_wins`) and commented. Copy strings live in `lib/content/pricing-page.ts`, not inlined.
- **G5** motion: `houseSpring` on card hover + press, `AnimatePresence` on mobile expand. No "click to reveal" without animation per `feedback_motion_is_universal`.
- **G6** rollback: no schema change; git-revertable. Route is public but reads read-only state.
- **G7** npm deps: zero new packages.
- **G10.5** external-reviewer gate: **required.** First public-facing SaaS surface + heavy voice treatment. Reviewer checks: (a) copy holds the dry/observational register (no "synergy", no "leverage", no "solutions"); (b) Full Suite positioning shows the popcorn effect without being a hard sell per spec §3.3; (c) mobile expand/collapse animates on every state change per `feedback_motion_is_universal`; (d) empty state is dry, not apologetic; (e) GST-inclusive pricing is visually unambiguous per `feedback_felt_experience_wins`.
- **G11.b** next brief: compile `sb-5-brief.md` (checkout page). Rationale: pricing page's "Get started" buttons are dead links until SB-5 lands — unblock end-to-end before SB-4 optional demo pages. Confirm with handoff if circumstances change.
- **G12** verification:
  - `npx tsc --noEmit` zero errors.
  - `npm test` green (+ new unit + new RTL tests).
  - Playwright `saas-pricing-page.spec.ts` green under seeded fixture.
  - Manual browser check **mandatory**: seed one active product (monthly $49 / $99 / $199) + one archived product → visit `/get-started/pricing` logged-out → confirm only the active product renders, three tiers visible, "Get started" routes to stub checkout URL, mobile viewport (375px) collapses to stacked cards with working expand.

## Open question for Andy

**None.** Layout, voice register, motion behaviour, empty-state copy all locked by spec + memories + conventions. Voice copy drafted by Claude per `feedback_no_content_authoring`; revisions happen post-ship if Andy wants a different register.

## Memory-alignment to check before starting

- `feedback_no_content_authoring` — Claude drafts every string; Andy reviews post-ship.
- `feedback_felt_experience_wins` — GST-inclusive prices; the number Andy wants felt.
- `feedback_individual_feel` — each product feels distinct even inside a shared grid.
- `feedback_primary_action_focus` — "Get started" is the sole CTA per tier; no secondary actions, no FAQ bloat on the pricing page.
- `feedback_motion_is_universal` — every state change animates.
- `project_saas_popcorn_pricing` — tier pricing shape (small capture / medium default / large small-jump big-revenue); Full Suite comparison makes the popcorn visible.
- `project_context_safety_conventions` — copy homed at `docs/content/saas-subscription-billing/pricing-page.md`; spec references the file.
- `feedback_no_lite_on_client_facing` — public surface reads "SuperBad", never "SuperBad Lite".
- `feedback_earned_ctas_at_transition_moments` — pricing page *is* the transition moment; proportional "Get started" is earned here, unlike mid-arc surfaces.

## Note on content-scope spillover

Spec §14 lists 12 voice-treated surfaces + 9 emails. SB-3 authors **only pricing-page copy** (item 1 of §14). Other surfaces (checkout, usage bar, cap screen, lockout, cancel flow, emails) stay out of scope for SB-3 and will be authored in their own wave sessions or a dedicated content mini-session. Keep this session's copy file scoped strictly to `pricing-page.md` — do not pre-author downstream surfaces "while we're here."
