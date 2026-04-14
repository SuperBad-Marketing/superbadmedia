# SW-5b — Stripe webhook receiver — Handoff

**Closed:** 2026-04-14
**Brief:** `sessions/sw-5b-brief.md` (split at §10 — E2E deferred to SW-5c)
**Model:** Sonnet (`/normal`)

## What shipped

- **`app/api/stripe/webhook/route.ts`** — POST Route Handler (nodejs runtime).
  - Reads raw body via `req.text()`.
  - Verifies `stripe-signature` via `stripe.webhooks.constructEvent` against `STRIPE_WEBHOOK_SECRET`.
  - On valid event, inserts one `external_call_log` row: `job="stripe.webhook.receive"`, `actor_type="internal"`, `estimated_cost_aud=0`, `units={event_type, event_id}`.
  - Returns `400` on missing signature, missing secret, or bad signature. Returns `200 { received: true }` on valid event. Insert failures are logged (console.error) but do not flip status — the handler never throws.
  - **Lazy Stripe instance:** uses a local `getStripe()` rather than `@/lib/stripe/client`. The singleton at `lib/stripe/client.ts` eagerly `new Stripe(process.env.STRIPE_SECRET_KEY ?? "")` which throws at build-time page-data collection when the env is unset. The route instantiates per request with `|| "sk_test_placeholder"` so build is clean and production behaviour is unchanged (real key is live via env).
- **`tests/stripe-webhook-route.test.ts`** — 5 tests, hermetic sqlite (migrated from `lib/db/migrations`) mocked in for `@/lib/db`; `stripe` module mocked via class-stub pattern.

## What did NOT ship (deferred to SW-5c)

- Playwright E2E covering the full critical-flight arc. **Root cause of the split:** `@playwright/test` is not a direct dep in `package.json` (only transitive via `@vitest/browser-playwright`), there is no `playwright.config.ts`, and no `tests/e2e/` directory. SW-5b's brief assumed Playwright was already scaffolded; it isn't. Installing, configuring, and writing the first E2E fixture on top of a webhook build would have blown SW-5b's scope and context budget. Cleanly split per brief §10.

## Files touched

| File | Change |
| --- | --- |
| `app/api/stripe/webhook/route.ts` | NEW |
| `tests/stripe-webhook-route.test.ts` | NEW |
| `PATCHES_OWED.md` | `sw5_stripe_webhook_receiver_owed` row marked CLOSED |
| `sessions/sw-5b-handoff.md` | NEW (this file) |
| `sessions/sw-5c-brief.md` | NEW (pre-compiled per G11.b) |
| `SESSION_TRACKER.md` | Next Action → SW-5c |

No migration. No settings keys touched. No schema change. No new env var (`STRIPE_WEBHOOK_SECRET` already in `.env.example` from A7).

## Verification

- `npx tsc --noEmit` — zero errors
- `npm test` — 320/320 green (315 prior + 5 new)
- `npm run lint` — clean
- `npm run build` — clean; `/api/stripe/webhook` visible in route manifest as `ƒ` (dynamic)

## PATCHES_OWED status

- **Closed:** `sw5_stripe_webhook_receiver_owed` (SW-5b).
- **Still open:**
  - `sw5_wizard_defs_barrel_owed` — fold in with SW-6 (Resend slice) when a second def lands.
  - `sw5_integration_rollback_on_insert_failure` — Observatory wave.

## Open thread for next session

- SW-5c first installs Playwright (`@playwright/test` as a direct devDep), lays down `playwright.config.ts` + `tests/e2e/`, then writes the critical-flight-stripe spec. Expect: seeded hermetic DB fixture that pre-clears Brand DNA gate, injects a test user session, and posts to `/api/stripe/webhook` with a real `constructEvent`-generated signature (no mocks at E2E layer). Brief is pre-compiled at `sessions/sw-5c-brief.md`.

## Notes

- The webhook receiver is consumed by `checkStripeWebhookReceivedAction` in `app/lite/setup/critical-flight/[key]/actions.ts`, which polls `external_call_log` for the job row. That action is unchanged — SW-5b just closes the production-path gap.
- `setup_wizards_enabled` kill-switch owns rollback. Receiver itself has no kill-switch; it only writes benign `external_call_log` rows.
