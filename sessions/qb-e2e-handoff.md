# QB-E2E handoff — 2026-04-14

## What landed

- `scripts/seed-qb-e2e.ts` — idempotent seed for company (manual billing) + primary contact + deal (stage=quoted) + project-structure quote (status=sent) + quote_sent activity + current-effective terms_of_service + privacy_policy legal doc versions. Exports `QB_E2E` constants + `seedQbE2e(db)` for in-process call from `beforeAll`; CLI entry for ad-hoc local runs.
- `tests/e2e/qb-e2e.spec.ts` — three-test Playwright suite:
  1. Precondition: `killSwitches.invoicing_manual_cycle_enqueue_enabled === false` (guards against BI-1 flipping before BI-E2E lands).
  2. `sent → viewed` via `markQuoteViewed` on first public fetch; asserts `quotes.status`, `viewed_at_ms`, and the `quote_viewed` activity_log row.
  3. ToS/privacy tick → Accept → confirmation screen → asserts `status="accepted"`, all `accepted_*` stamps land with the seeded legal version IDs, deal flips to `won` with `won_outcome="project"` + `subscription_state=null`, `quote_accepted` activity row exists, and zero `manual_invoice_generate` scheduled_tasks rows (kill-switch gate holds).
- `lib/stripe/client.ts` — lazy `getStripe()` replacing eager module-top `new Stripe()` (closes `qb4c_stripe_client_eager_build_break`). `lib/stripe/customer.ts`, `app/api/quotes/[token]/payment-intent/route.ts`, `lib/stripe/webhook-handlers/payment-intent-succeeded.ts`, and `tests/stripe-customer.test.ts` all updated to the new pattern.
- `next.config.ts` — added `serverExternalPackages: ["better-sqlite3"]`.
- `playwright.config.ts` — webServer now runs `next build && next start` with `NODE_ENV=production`, `AUTH_TRUST_HOST=true`, timeout 360s. Hermetic DB relocated to `$TMPDIR/sblite-e2e/.test-critical-flight.db` (out of iCloud-synced Desktop as a precaution).

## Key decision — production-mode E2E

Original plan was to run Playwright against `next dev`. Next 16's Turbopack dev-server **silently drops better-sqlite3 writes from RSC** — drizzle `.returning()` + raw `prepared.run()` both report `changes: 1`, but a second handle in the same process (and the on-disk file post-request) sees the pre-update row. Reproduced outside a test harness. Andy chose option 2: switch webServer to `next build && next start`. Writes now persist normally, suite goes 3/3 green. Root cause (Turbopack RSC sandbox vs better-sqlite3 native addon) not investigated further — production-mode E2E is the correct shape anyway.

## Patches owed opened / closed

- **Closed:** `qb4c_stripe_client_eager_build_break` (lazy Stripe client applied).
- **Closed:** `qbe2e_dev_server_write_persistence` (production-mode webServer).
- **Opened:** `qbe2e_manual_quote_settled_missing` — manual-billed accept path doesn't log `quote_settled` activity row; spec §5.1 says both modes should. Targeted fix in `lib/quote-builder/accept.ts`, or narrow the spec. Not urgent; BI-1 or a polish wave is the right carrier.

## Gates

- `npx tsc --noEmit` — 0 errors.
- `npm test` — 636 passed / 1 skipped / 85 files.
- `npx playwright test qb-e2e.spec.ts` — 3/3 passed.
- Manual browser verification not applicable (E2E drives the browser).

## Next session should know

- Playwright runs now take **~2 min per suite** (build cost). Acceptable — it's once per full suite, not per test.
- Seed uses `now` (not `now - 24h`) for legal doc `effective_from_ms` so the test seed's ToS/Privacy rows beat the migration's `ldv_terms_v1` / `ldv_privacy_v1` rows in `desc(effective_from_ms)` ordering. Any future E2E needing current-effective legal versions should follow the same pattern.
- The QB-E2E spec covers manual-billed only. Stripe-billed path (with Payment Element + webhook simulation) is intentionally deferred to a future BI-E2E or QB-E2E-Stripe session — spec §7 calls that out.
