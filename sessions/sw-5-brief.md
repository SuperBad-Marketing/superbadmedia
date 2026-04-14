# SW-5 — First consumer wizard: `stripe-admin` — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** SW-5
- **Wave:** 4 — Setup Wizards
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet) — composes existing step-types + SW-3 primitives; Stripe SDK surface is narrow (key verify + webhook upsert).
- **Sonnet-safe:** yes
- **Estimated context:** medium-large. If the Stripe wizard + route + E2E push past 70% context, split into SW-5a (wizard definition + route) and SW-5b (E2E smoke + session.update wiring).

## 2. Spec references

- `docs/specs/setup-wizards.md` §5.1 (Stripe admin wizard), §7 (vendor manifest + registerIntegration), §8.2 (critical flight ordering)
- `BUILD_PLAN.md` Wave 4 §SW-5
- `sessions/sw-4-handoff.md` — critical-flight routing + `session.update()` requirement
- `sessions/sw-3-handoff.md` — `registerIntegration()` object-arg signature, celebration `onComplete` pattern
- `sessions/sw-2-handoff.md` — step-type library + `STEP_TYPE_REGISTRY`

## 3. Acceptance criteria (scope: just `stripe-admin`)

SW-5 as a whole covers many admin integration wizards. This first session ships **only `stripe-admin`** so the critical-flight arc is observable end-to-end. Follow-on wizards (Resend, Graph API, etc.) go into SW-5b / SW-5c briefs written at SW-5's close.

```
SW-5 (stripe-admin slice) — FEATURE, medium
- Ships lib/wizards/defs/stripe-admin.ts exporting a WizardDefinition<StripePayload>.
    * Steps compose api-key-paste + webhook-probe + review-and-confirm + celebration
      via STEP_TYPE_REGISTRY.
    * completionContract.verify = live Stripe balance.retrieve ping with the
      pasted key.
    * completionContract.artefacts.integrationConnections = true.
    * vendorManifest = stripeManifest (SW-3).
    * voiceTreatment with tab-title pool + capstone = undefined (capstone
      lives on graph-api-admin or a dedicated admin-first-run wizard — decide
      in SW-5 scope, document in handoff).
    * Registers via registerWizard() on module import.
- Ships app/lite/setup/critical-flight/[key]/page.tsx:
    * auth() guard + getWizard(key) lookup + render <WizardShell step={...}>.
    * On celebration onComplete success, calls unstable_update() (server
      action) to refresh the JWT's critical_flight_complete claim.
- Stripe key-paste uses SW-2's api-key-paste step; testCall = balance.retrieve.
- Rollback: setup_wizards_enabled kill-switch (no new switch). Revert =
  delete new files.
```

## 4. Skill whitelist

- `stripe` — key validation via `balance.retrieve`; Stripe SDK already in stack
- `nextauth` — `unstable_update()` for session refresh
- `drizzle-orm` — `wizard_completions` insert (inside celebration orchestrator)
- `tailwind-v4` — wizard chrome
- `framer-motion` — motion slots already registered; no new ones

## 5. File whitelist (G2 scope discipline)

**New:**
- `lib/wizards/defs/stripe-admin.ts` — WizardDefinition + module-side `registerWizard()`
- `app/lite/setup/critical-flight/[key]/page.tsx` — render-by-key route
- `app/lite/setup/critical-flight/[key]/actions.ts` — Server Action: verify + registerIntegration + wizard_completions insert + `unstable_update()` on success
- `tests/stripe-admin-wizard.test.ts` — definition shape, contract roundtrip, registry membership
- `tests/critical-flight-route.test.tsx` — route resolution by key + 404 on unknown key
- `sessions/sw-5-handoff.md` — at close
- `sessions/sw-5b-brief.md` (or sw-6-brief.md if this session closes the stripe slice and the next session is Resend) — pre-compile per G11.b

**Edited:**
- `lib/wizards/registry.ts` — no edits expected; `registerWizard()` call sites live in definition modules
- If `admin-first-run` wizard decision requires a dedicated motion slot: `lib/motion/choreographies.ts` (off-whitelist — call this out if hit)

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** none directly. Consumer step-types read the SW-2-seeded timeout keys internally.
- **Seeds:** none.

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] SW-4 closed cleanly — verify: `ls sessions/sw-4-handoff.md`
- [ ] `nextCriticalWizardKey` helper present — verify: `grep "nextCriticalWizardKey" lib/wizards/critical-flight.ts`
- [ ] `/lite/first-run` route present — verify: `ls app/lite/first-run/page.tsx`
- [ ] `STEP_TYPE_REGISTRY` barrel present — verify: `ls components/lite/wizard-steps/index.ts`
- [ ] `registerIntegration` helper present — verify: `ls lib/integrations/registerIntegration.ts`
- [ ] `stripeManifest` exported — verify: `grep "export const stripeManifest" lib/integrations/vendors/stripe.ts`
- [ ] `verifyCompletion` helper present — verify: `ls lib/wizards/verify-completion.ts`
- [ ] Stripe SDK in stack — verify: `grep '"stripe"' package.json`

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated** — inherits `setup_wizards_enabled` from SW-2. No new kill-switch; no migration. Revert = delete new files; `registerWizard()` is idempotent because the module only loads when its route renders.

## 9. Definition of done

- [ ] `stripe-admin` WizardDefinition registered at module load
- [ ] `balance.retrieve` ping succeeds with a real key (or fails with a branded reason)
- [ ] Celebration orchestrator runs `verifyCompletion → registerIntegration → wizard_completions insert → unstable_update()` in order, with rollback on any failure
- [ ] `/lite/setup/critical-flight/stripe-admin` resolves + renders the wizard
- [ ] Completing the wizard flips `session.user.critical_flight_complete` (manually verified via a second nav → cockpit)
- [ ] G4 literal-grep: no Stripe price / balance threshold literals; no hard-coded wizard ordering
- [ ] G5 motion: wizard chrome uses existing A4 slots; no new slots
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] **G9 E2E smoke (mandatory for critical flow):** Playwright test covering sign-in → brand-dna-gate-clear → `/lite/first-run` → Stripe wizard → capstone → cockpit
- [ ] Handoff written; tracker updated; follow-on SW-5 brief (Resend or SW-5b) pre-compiled

## 10. Split-point (if context tight)

If at ~70% the wizard definition + route + Server Action are landed but E2E is not yet green, split: SW-5b ships the Playwright E2E smoke + any session.update() refinements. The happy path is safe to ship standalone (rolled back by the kill-switch) as long as unit tests pass.

## 11. Notes for the next-session brief writer (SW-6 or SW-5b)

- SW-5's close must decide: does Resend become SW-5b (same session shape, different vendor) or does SW-6 (the post-wizards scheduled-task + voice layer per BUILD_PLAN) get pulled in? Writer reads SW-5 handoff before compiling.
- Capstone motion slot: if SW-5 registers `motion:critical_flight_capstone` (Tier-1) as part of graph-api-admin's celebration config, update both `app/lite/first-run/capstone.tsx` and `components/lite/wizard-steps/celebration-step.tsx` in the same session that registers it. Leaving them out of sync is a drift hazard.
