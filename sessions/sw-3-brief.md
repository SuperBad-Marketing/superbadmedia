# SW-3 — Vendor manifest + Observatory registration contract — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** SW-3
- **Wave:** 4 — Setup Wizards
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet) — shared helper + contract enforcement, no LLM, no motion novelty
- **Sonnet-safe:** yes
- **Estimated context:** small

## 2. Spec references

- `docs/specs/setup-wizards.md` §7.1 (vendor manifest shape), §7.2 (`registerIntegration()`), §7.3 (celebration-step summary), §3.3 (completion contract verify())
- `docs/specs/cost-usage-observatory.md` §4 (band registration contract — read-only; Observatory ships later)
- `BUILD_PLAN.md` Wave 4 §SW-3
- `sessions/sw-2-handoff.md` — step-type registry + celebration step contract (drives how `verify()` is hooked)
- `sessions/sw-1-handoff.md` — `VendorManifest` shape + `integration_connections` schema

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md SW-3)

```
SW-3 — FEATURE, small
- Ships `lib/integrations/registerIntegration.ts`:
    registerIntegration(
      wizardCompletionId,
      manifest: VendorManifest,
      credentials: EncryptedBlob,
      metadata: object,
    ): Promise<{ connectionId: string; bandsRegistered: BandName[] }>
  - Writes `integration_connections` row (vendor_key, owner, encrypted
    credentials via B2 vault, metadata, band_registration_hash, status='active').
  - Calls a stub `registerBands(manifest.jobs)` that returns the band names;
    Observatory's real implementation arrives in its own wave — stub is
    additive, not replaced.
  - Returns the registered band names to the caller (the celebration step
    renders them in the post-completion summary).
- Ships `lib/wizards/verify-completion.ts`:
    verifyCompletion<T>(
      definition: WizardDefinition<T>,
      payload: T,
    ): Promise<{ ok: true } | { ok: false, reason: string }>
  - Runs `definition.completionContract.verify(payload)` with timeout.
  - If artefact `integrationConnections: true`, asserts an
    `integration_connections` row exists for the vendor+owner.
  - If artefact `activityLog` is named, asserts the activity row was logged.
  - Caller (celebration step onComplete) rolls back if verification fails.
- Integration point: celebration step's `onComplete()` (SW-2) calls
  `verifyCompletion()` → then (if integration wizard) `registerIntegration()`
  → then writes `wizard_completions` row.
- Ships seed vendor manifest for ONE representative vendor: `stripe-admin`
  (the first critical-flight wizard). Other vendors' manifests ship in
  SW-5+. Stripe manifest lives at `lib/integrations/vendors/stripe.ts`.
- Rollback: feature-flag-gated (inherits `setup_wizards_enabled` from SW-2).
  No schema changes (SW-1 owns schema).
- Depends on: SW-1 (tables + types), SW-2 (step-types + celebration hook),
  B2 (vault for credentials encryption).
```

## 4. Skill whitelist

- `drizzle-orm` — writing `integration_connections`, reading `activity_log`
- `typescript-validation` — runtime check of `manifest.jobs` shape before registration
- (No `framer-motion`, no `nextauth`, no LLM skills.)

## 5. File whitelist (G2 scope discipline)

**New:**
- `lib/integrations/registerIntegration.ts` — the registration helper
- `lib/integrations/registerBands.ts` — Observatory stub; returns band names, no side effects beyond logging
- `lib/wizards/verify-completion.ts` — completion contract enforcement
- `lib/integrations/vendors/stripe.ts` — Stripe vendor manifest + SDK import (no SDK calls here — SW-5 owns Stripe wizard steps)
- `tests/register-integration.test.ts` — insert row, encrypt credentials, band hash, kill-switch short-circuit
- `tests/verify-completion.test.ts` — happy path, missing required key, artefact missing, verify() timeout
- `tests/stripe-manifest.test.ts` — shape + kill-switch key validity
- `sessions/sw-4-brief.md` — Wave 4 next-session brief (G11.b rolling cadence) — unless SW-2 already wrote it; if so, skip

**Edited:**
- `components/lite/wizard-steps/celebration-step.tsx` (from SW-2) — wire in `verifyCompletion()` + `registerIntegration()` call sequence inside onComplete
- `sessions/sw-3-handoff.md` — write at close

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** none new (inherits `wizards.*` from SW-1/SW-2)
- **Seeds:** none

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] SW-1 closed cleanly — verify: `ls sessions/sw-1-handoff.md`
- [ ] SW-2 closed cleanly — verify: `ls sessions/sw-2-handoff.md`
- [ ] `integration_connections` table exists — verify: `grep "export const integration_connections" lib/db/schema/integration-connections.ts`
- [ ] `VendorManifest` + `CompletionContract<T>` types exist — verify: `grep "VendorManifest\|CompletionContract" lib/wizards/types.ts`
- [ ] Celebration step exists — verify: `ls components/lite/wizard-steps/celebration-step.tsx`
- [ ] Vault exists (B2) — verify: `grep "vault.encrypt" lib/crypto/vault.ts`
- [ ] Stripe SDK installed — verify: `grep '"stripe"' package.json`
- [ ] `ensureStripeCustomer()` exists (A7) — verify: `grep "ensureStripeCustomer" lib/stripe/ensure-customer.ts` (or wherever A7 placed it)
- [ ] `no-direct-stripe-customer-create` ESLint rule in place — verify: `grep "no-direct-stripe-customer-create" eslint.config.mjs`

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated.** `setup_wizards_enabled` (from SW-2) continues to short-circuit the shell. Absent any wizard completions, `registerIntegration()` is unreachable. Additionally, `registerBands()` stub is side-effect-free, so the Observatory-registration half is git-revertable. `integration_connections` rows written during a session can be hard-deleted without cascade (no consuming spec reads them until their owning wizard ships).

## 9. Definition of done

- [ ] `registerIntegration()` inserts an `integration_connections` row with encrypted credentials
- [ ] `verifyCompletion()` enforces `required[]` presence + runs `verify()` with timeout (4s default, configurable via `wizards.verify_timeout_ms` — **add this settings row if it doesn't exist**)
- [ ] Stripe vendor manifest type-checks against `VendorManifest`
- [ ] Celebration step's onComplete integrates `verifyCompletion → registerIntegration → wizard_completions insert` in that order; failure at any step leaves no `wizard_completions` row
- [ ] Kill-switch respected: `setup_wizards_enabled=false` short-circuits without writing
- [ ] G4 literal-grep: timeouts / retries read via `settings.get()`
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] G-gates G0–G12 run end-to-end; handoff written; tracker updated

## 10. Notes for the next-session brief writer (SW-4 / SW-5)

SW-2 wrote SW-4's brief at close. If SW-4's brief is still owed when SW-3 starts (check `ls sessions/sw-4-brief.md`), write it here. Otherwise, SW-3's sole brief obligation is satisfied by SW-2 having handled it.

- **SW-4 (FEATURE, medium):** Admin critical-flight sequencer — `hasCompletedCriticalFlight(user)` helper + `proxy.ts` gate 2 wiring. Chains stripe-admin → resend → graph-api-admin. Depends on SW-3.
- **SW-5 (FEATURE, medium):** First real integration wizard — `stripe-admin` WizardDefinition assembled from SW-2 step-types + SW-3's Stripe manifest. Sets the template every later integration wizard follows.
