# SW-5b — Stripe webhook receiver + E2E smoke — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** SW-5b
- **Wave:** 4 — Setup Wizards
- **Type:** FEATURE (infra) + E2E
- **Model tier:** `/normal` (Sonnet) — narrow surface (one API route + one Playwright spec).
- **Sonnet-safe:** yes
- **Estimated context:** medium. If Playwright fixture wiring bloats, split the receiver and E2E.

## 2. Spec references

- `docs/specs/setup-wizards.md` §5.1 (Stripe contract: "webhook endpoint registered + test webhook received")
- `sessions/sw-5-handoff.md` — PATCHES_OWED `sw5_stripe_webhook_receiver_owed` + open threads
- `sessions/sw-3-handoff.md` — `external_call_log` emission convention
- `BUILD_PLAN.md` Wave 4 §SW-5

## 3. Acceptance criteria

```
SW-5b — FEATURE + E2E, medium
- Ships /api/stripe/webhook route:
    * Verifies `stripe-signature` header via Stripe SDK constructEvent
      with STRIPE_WEBHOOK_SECRET env var.
    * On valid event, writes external_call_log row:
        job = "stripe.webhook.receive"
        actor_type = "internal"
        units = { event_type: evt.type, event_id: evt.id }
        estimated_cost_aud = 0
    * 400 on bad signature, 200 on success. Never throws.
    * Raw-body read via Request.text() (no JSON middleware).
- Ships Playwright E2E smoke covering the critical-flight arc:
    * sign-in → brand-dna gate already clear (fixture) →
      /lite/first-run → redirect to stripe-admin wizard →
      paste Stripe test key (env: STRIPE_TEST_KEY) →
      simulate webhook POST to /api/stripe/webhook →
      review → celebrate → capstone on /lite/first-run → cockpit.
    * Uses @playwright/test fixtures; hermetic against a seeded sqlite.
- Closes sw5_stripe_webhook_receiver_owed PATCHES_OWED row.
- Rollback: setup_wizards_enabled kill-switch (no new switch). Revert =
  delete new files; no migration.
```

## 4. Skill whitelist

- `stripe` — event signature verification (`stripe.webhooks.constructEvent`)
- `webapp-testing` — Playwright fixtures + assertions
- `drizzle-orm` — `external_call_log` insert
- `nextjs16-breaking-changes` — Route Handler conventions (async params, Request body)

## 5. File whitelist (G2 scope discipline)

**New:**
- `app/api/stripe/webhook/route.ts` — POST handler
- `tests/e2e/critical-flight-stripe.spec.ts` — Playwright E2E
- `tests/stripe-webhook-route.test.ts` — unit: signature verify + log row insert
- `sessions/sw-5b-handoff.md` — at close
- `sessions/sw-6-brief.md` (or `sw-5c-brief.md` if Resend slice is next) — pre-compile per G11.b

**Edited:**
- `.env.example` — add `STRIPE_WEBHOOK_SECRET`
- `playwright.config.ts` — register new spec (if not already globbed)

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** none.
- **Seeds:** none.

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] SW-5 closed cleanly — verify: `ls sessions/sw-5-handoff.md`
- [ ] `stripeAdminWizard` registers on import — verify: `grep "registerWizard(stripeAdminWizard)" lib/wizards/defs/stripe-admin.ts`
- [ ] Critical-flight route present — verify: `ls app/lite/setup/critical-flight/\[key\]/page.tsx`
- [ ] `external_call_log` schema present — verify: `ls lib/db/schema/external-call-log.ts`
- [ ] `checkStripeWebhookReceivedAction` present — verify: `grep "checkStripeWebhookReceivedAction" app/lite/setup/critical-flight/\[key\]/actions.ts`
- [ ] Stripe SDK available — verify: `grep '"stripe"' package.json`
- [ ] Playwright installed — verify: `grep '@playwright/test' package.json`

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated** — inherits `setup_wizards_enabled` from SW-2. Receiver does not write to `wizard_completions` or `integration_connections` directly; only logs to `external_call_log` (benign). Revert = delete new files.

## 9. Definition of done

- [ ] `/api/stripe/webhook` verifies signature + writes `external_call_log` row
- [ ] Bad signature → 400, valid event → 200
- [ ] Stripe CLI `stripe trigger` (manual) writes a visible row in dev
- [ ] Playwright E2E green against a seeded DB
- [ ] `PATCHES_OWED.md` row `sw5_stripe_webhook_receiver_owed` marked closed
- [ ] G4 literal-grep clean (signing secret from env; event type never hardcoded in the wizard path)
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] `npm run test:e2e` (or whatever the Playwright command is) → green for critical-flight-stripe spec
- [ ] Handoff written; tracker updated; follow-on brief pre-compiled

## 10. Split-point (if context tight)

Split receiver from E2E: SW-5b ships the webhook route + unit test; SW-5c ships Playwright E2E. Both still close before moving on — E2E is the critical-flow gate for this arc.

## 11. Notes for the next-session brief writer

- After SW-5b, decide: Resend (next critical wizard, api-key only, no webhook) or Graph API admin (OAuth-based, more complex). Spec ordering favours Resend second per `wizards.critical_flight_wizards`. Default to writing SW-6 = Resend slice unless something blocks it.
- Consider adding `lib/wizards/defs/index.ts` barrel alongside the first additional wizard def — currently tracked as PATCHES_OWED `sw5_wizard_defs_barrel_owed`.
