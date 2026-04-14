# SW-4 — Admin critical-flight sequencer — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** SW-4
- **Wave:** 4 — Setup Wizards
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet) — no novel patterns; stitches the step-type registry, registerIntegration, and proxy gate
- **Sonnet-safe:** yes
- **Estimated context:** medium

## 2. Spec references

- `docs/specs/setup-wizards.md` §8 (first-run admin onboarding — critical flight)
- `BUILD_PLAN.md` Wave 4 §SW-4
- `sessions/sw-3-handoff.md` — `registerIntegration()` signature + completion-contract enforcement
- `sessions/sw-2-handoff.md` — `STEP_TYPE_REGISTRY` + `<WizardShell>` registry wire-up
- `sessions/a8-handoff.md` — NextAuth proxy gate 2 (`hasCompletedCriticalFlight()` stub)

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md SW-4)

```
SW-4 — FEATURE, medium
- Ships `lib/wizards/critical-flight.ts`:
    * getCriticalFlightStatus(userId) reads settings.wizards.critical_flight_wizards
      and wizard_completions, returns the ordered not-yet-complete list.
    * nextCriticalWizardKey(userId) returns the first incomplete wizard key,
      or null when all are complete.
- Replaces the stub in `lib/auth/has-completed-critical-flight.ts`:
    * Real check against `wizard_completions` for every key in
      settings.wizards.critical_flight_wizards.
- Renders `/lite/first-run` route that:
    * Redirects to the next incomplete critical-flight wizard.
    * Renders a "you're all wired up" capstone screen when complete
      (consumes §8.3 capstone config on the admin-first-run WizardDefinition).
- Proxy.ts gate 2 routes admins with incomplete flight to /lite/first-run.
- Rollback: feature-flag-gated on setup_wizards_enabled (inherits SW-2's
  kill-switch). Revert = restore the stub + delete new files.
```

## 4. Skill whitelist

- `nextauth` — proxy gate integration
- `drizzle-orm` — wizard_completions query
- `tailwind-v4` — capstone screen styling
- (No LLM work. No new motion slots — capstone uses an existing Tier 1 or reserved slot per spec §8.3.)

## 5. File whitelist (G2 scope discipline)

**New:**
- `lib/wizards/critical-flight.ts` — `getCriticalFlightStatus()`, `nextCriticalWizardKey()`
- `app/lite/first-run/page.tsx` — redirect-or-capstone route
- `app/lite/first-run/capstone.tsx` — capstone render (consumes §8.3 config)
- `tests/critical-flight.test.ts` — ordered-completion semantics, all-complete sentinel
- `tests/has-completed-critical-flight.test.ts` — replaces the stub-era fixture; hits the real DB path
- `sessions/sw-5-brief.md` — pre-compile per G11.b

**Edited:**
- `lib/auth/has-completed-critical-flight.ts` — swap stub for real check
- `proxy.ts` (or middleware file per A8) — gate 2 redirect wiring (verify path in G1 — don't guess)
- `sessions/sw-4-handoff.md` — write at close

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:**
  - `wizards.critical_flight_wizards` (ordered list; already seeded)
- **Seeds:** none

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] SW-2 closed cleanly — verify: `ls sessions/sw-2-handoff.md`
- [ ] SW-3 closed cleanly — verify: `ls sessions/sw-3-handoff.md`
- [ ] `STEP_TYPE_REGISTRY` + step-type library present — verify: `ls components/lite/wizard-steps/index.ts`
- [ ] `hasCompletedCriticalFlight` stub exists — verify: `grep "hasCompletedCriticalFlight" lib/auth/has-completed-critical-flight.ts`
- [ ] `wizard_completions` table live — verify: `grep "wizard_completions" lib/db/schema/wizard-completions.ts`
- [ ] `settings.wizards.critical_flight_wizards` seeded — verify: `grep "critical_flight_wizards" lib/db/migrations/0001_seed_settings.sql`
- [ ] `registerIntegration` shipped by SW-3 — verify: `ls lib/integrations/registerIntegration.ts`

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated** — inherits `setup_wizards_enabled` from SW-2. Proxy gate 2 no-ops when the switch is off. Revert = restore the stub + delete new files; no migration shipped.

## 9. Definition of done

- [ ] Critical-flight helpers ship typed + unit-tested
- [ ] Stub replaced; `has-completed-critical-flight` test green against real DB
- [ ] `/lite/first-run` redirects correctly on incomplete flight; renders capstone on complete
- [ ] Proxy gate 2 routes incomplete admins to `/lite/first-run`
- [ ] G4 literal-grep: no critical-flight ordering literal in code — all `settings.get('wizards.critical_flight_wizards')`
- [ ] G5 motion: capstone uses the registered slot per spec §8.3 (confirm the slot in G1 — don't freestyle)
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] G-gates G0–G12 end-to-end; handoff written; tracker updated; sw-5-brief.md written

## 10. Split-point (if context tight)

If at ~70% context the helpers + stub replacement + tests are landed, split: SW-4b ships `/lite/first-run` + proxy wiring. Helpers are pure — they're safe to ship standalone.

## 11. Notes for the next-session brief writer (SW-5)

SW-5 is the first consumer wizard (Stripe admin or Resend per BUILD_PLAN). Its brief writer reads SW-3's `registerIntegration` signature and SW-4's critical-flight ordering before compiling.
