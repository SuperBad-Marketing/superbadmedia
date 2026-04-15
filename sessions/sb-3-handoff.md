# SB-3 — Public pricing page handoff

**Built:** `/get-started/pricing` — public, unauthenticated, server-rendered pricing comparison grid.

## What landed

- `app/get-started/layout.tsx` — public shell (wordmark header, Privacy/Terms footer, GST footnote).
- `app/get-started/pricing/page.tsx` — server component, `generateMetadata` (title/OG/Twitter/robots:index), `dynamic = "force-dynamic"`, empty-state branch, renders grid + Full Suite.
- `app/get-started/pricing/clients/pricing-grid-client.tsx` — desktop `hidden md:grid` columns, mobile `AnimatePresence` expand/collapse, `TierCard` with `motion.article` hover/tap springs.
- `app/get-started/pricing/clients/full-suite-card-client.tsx` — emphasis block, savings line (`computed` / `fallback`).
- `lib/content/pricing-page.ts` + `docs/content/saas-subscription-billing/pricing-page.md` — Claude-authored voice copy (tier framing, CTA, Full Suite positioning, empty state).
- `lib/saas-products/queries.ts` → added `listActivePricingProducts()` — 4-call single pass, no N+1.
- `lib/saas-products/pricing-page-view-model.ts` — pure `buildPricingPageViewModel`, `formatCentsAud`, `humaniseFlagKey` (preserves api/ai/llm/gst/roi/pdf/csv casing), `tierFrame`.
- `scripts/seed-sb3-pricing.ts` — deterministic fixture (outreach 49/99/199, ads 39/79/149, full-suite 79/149/299, one archived).
- `tests/saas-products/sb3-pricing-query.test.ts` — 9 tests (query + view model, including savings fallback + negative-savings guard).
- `tests/e2e/saas-pricing-page.spec.ts` — 4 tests (desktop grid, CTA href, Full Suite savings `348`/`49`, mobile toggle).

## Silent reconciles (locked without asking Andy per `feedback_technical_decisions_claude_calls`)

- **`.test.tsx` → `.test.ts`**: brief named an RTL page test, but adding `@testing-library/react` violates G7 (zero new packages). Split page's logic into a pure `buildPricingPageViewModel` fn; unit-tested that + query. Playwright covers the DOM.
- **No mailing-list CTA** on empty state — `feedback_primary_action_focus` says no fallback UX in conversion flows.
- **Wordmark routes to `/`** — marketing site location is a Phase 2 Foundations question; `/` is the current landing.
- **`waitUntil: "domcontentloaded"` + explicit `toBeVisible({ timeout: 20_000 })`** in Playwright — `networkidle` hangs under Next 16 `next start`.

## Verification

- `npx tsc --noEmit` → 0 errors (stale `.next/dev/types` needed `rm -rf` once).
- `npm test` → 761 passed / 1 skipped (+9 from SB-2c).
- `npx playwright test tests/e2e/saas-pricing-page.spec.ts` → 4/4 passing.
- Manual browser check: grid renders; mobile toggle animates; empty state reachable by archiving all products.

## G10.5 external-reviewer self-assessment

- **Visual fidelity**: desktop grid follows spec §3.1 — three-tier cards per column, middle-tier framing "the one most people pick", Full Suite below. No mockup HTML cited in brief; copy voice matches `lib/content/saas-products` siblings.
- **Motion**: hover/tap springs on every card; mobile toggle animates height+opacity+chevron rotation. Reduced-motion handled globally via `MotionProvider` — not overridden here.
- **Brand feel**: dry voice ("We're not selling anything yet."), no jargon, `feedback_individual_feel` respected (each product is its own column, not a shared table).
- **Gaps to flag for next wave**: Get started CTAs link to `/get-started/checkout?tier=…&product=…` — dead route until SB-5 lands. See sb-5 brief.

## What next agent should know

- Proxy naturally bypasses `/get-started/*` (only gates `/lite/*`).
- Empty-state render path tested via fixture deletion, not unit test — relies on query returning `[]`.
- `TierCard` is exported from `pricing-grid-client.tsx` and reused inside Full Suite section — changes to the card affect both places.
- Full Suite is identified by `slug === "full-suite"` — not a status flag, not a type column. Rename-safe via `FULL_SUITE_COPY.slug`.
- Dev-DB seeding: `DB_FILE_PATH=./dev.db npx tsx scripts/seed-sb3-pricing.ts`.
