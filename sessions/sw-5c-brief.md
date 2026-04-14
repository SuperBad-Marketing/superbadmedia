# SW-5c — Playwright scaffolding + critical-flight E2E smoke — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0 / §"Pre-compiled session briefs".**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** SW-5c
- **Wave:** 4 — Setup Wizards
- **Type:** INFRA (Playwright scaffold) + E2E
- **Model tier:** `/normal` (Sonnet), escalate to `/deep` only if fixture wiring sprawls.
- **Sonnet-safe:** yes
- **Estimated context:** medium. If E2E fixture + config + first spec all fit, stay in-session; otherwise split scaffold vs spec at §10.

## 2. Spec references

- `docs/specs/setup-wizards.md` §5.1 (Stripe critical-flight arc)
- `sessions/sw-5-handoff.md` — full critical-flight arc description
- `sessions/sw-5b-handoff.md` — why Playwright wasn't scaffolded in SW-5b
- `AUTONOMY_PROTOCOL.md` §G12 (E2E-mandatory on critical flows)

## 3. Acceptance criteria

```
SW-5c — INFRA + E2E, medium
- Installs @playwright/test as a direct devDep (package.json + lockfile).
- Adds playwright.config.ts (nodejs env, single browser = chromium,
  webServer: npm run dev on a free port, hermetic DATABASE_URL per run).
- Adds `test:e2e` script to package.json.
- Adds tests/e2e/ directory.
- Ships tests/e2e/critical-flight-stripe.spec.ts covering:
    * seed hermetic sqlite (migrations + test user with
      brand_dna_complete=true in JWT) →
    * sign-in → /lite/first-run redirects to stripe-admin wizard →
    * paste Stripe test key (env: STRIPE_TEST_KEY, skipped with
      `test.skip` if unset) → webhook-probe triggers real
      `/api/stripe/webhook` POST (constructEvent signature) →
      external_call_log row appears → review-and-confirm → celebration →
      capstone on /lite/first-run → cockpit.
- All assertions hermetic. No external network (Stripe balance.retrieve
  is stubbed via a feature flag or a Stripe-CLI-style fixture request).
- Rollback: devDep only + feature-flag-gated (setup_wizards_enabled).
```

## 4. Skill whitelist

- `webapp-testing` — Playwright fixtures, hermetic DB seeding, auth state injection
- `stripe` — signature generation for a synthetic webhook POST
- `drizzle-orm` — seeding fixture users + wizard_progress rows
- `nextauth` — injecting a pre-authenticated session in the E2E fixture

## 5. File whitelist (G2 scope discipline)

**New:**
- `playwright.config.ts`
- `tests/e2e/critical-flight-stripe.spec.ts`
- `tests/e2e/fixtures/seed-db.ts` (helper — test-user + JWT injection)
- `tests/e2e/fixtures/stripe-signature.ts` (helper — generate valid signature for a raw body)
- `sessions/sw-5c-handoff.md` — at close
- `sessions/sw-6-brief.md` — pre-compile per G11.b (Resend slice is next per brief)

**Edited:**
- `package.json` — `@playwright/test` devDep + `test:e2e` script
- `.env.example` — add `STRIPE_TEST_KEY` (optional, test-only; doc it as skippable)
- `.gitignore` — add `test-results/`, `playwright-report/`, `tests/e2e/.test-*.db`

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** possibly `wizards.webhook_probe_timeout_ms` (for timing the poll). Verify via `settings.get()` — never a literal.
- **Seeds:** none.

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] SW-5b closed — verify: `ls sessions/sw-5b-handoff.md`
- [ ] Webhook route present — verify: `ls app/api/stripe/webhook/route.ts`
- [ ] Critical-flight route present — verify: `ls app/lite/setup/critical-flight/\[key\]/page.tsx`
- [ ] `stripeAdminWizard` registered — verify: `grep "registerWizard(stripeAdminWizard)" lib/wizards/defs/stripe-admin.ts`
- [ ] No `playwright.config.ts` yet — verify: `ls playwright.config.ts` returns no such file
- [ ] No `tests/e2e/` yet — verify: `ls tests/e2e` returns no such file

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated** (runtime) + **devDep-only** (repo). Revert = delete new files + `npm uninstall @playwright/test`. No migration. No app code changes in production path.

## 9. Definition of done

- [ ] `npm run test:e2e` green against the critical-flight-stripe spec
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → 320+ green (no regressions)
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] `AUTONOMY_PROTOCOL.md` G12 satisfied for the stripe critical flow
- [ ] Handoff written; tracker updated; SW-6 brief pre-compiled

## 10. Split-point (if context tight)

Split at fixture vs spec:
- **SW-5c-a:** install + config + fixtures (seed-db, stripe-signature). No spec yet. Unit-tests the helpers.
- **SW-5c-b:** write the critical-flight-stripe E2E spec against SW-5c-a's fixtures.

Both close before SW-6 starts.

## 11. Notes for the next-session brief writer

- After SW-5c, next is SW-6 — Resend critical wizard (api-key only, no webhook, so no new Playwright fixtures, just reuse stripe pattern minus the webhook leg). Default SW-6 = Resend slice unless something blocks it.
- Consider introducing `lib/wizards/defs/index.ts` barrel alongside Resend (PATCHES_OWED `sw5_wizard_defs_barrel_owed`).
