# SW-2 — Setup Wizards: 10 step-types — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** SW-2
- **Wave:** 4 — Setup Wizards
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet) — 10 step-types is volume, not novelty
- **Sonnet-safe:** yes (if context tight, split at the celebration step-type — see §10)
- **Estimated context:** large

## 2. Spec references

- `docs/specs/setup-wizards.md` §4 (step-type library table), §4.1–§4.10 (per-step behaviour), §11 (shell contract)
- `BUILD_PLAN.md` Wave 4 §SW-2
- `sessions/sw-1-handoff.md` — shell contract + `WizardDefinition` shape as actually implemented

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md SW-2)

```
SW-2 — FEATURE, large
Implement 10 step-types as composable primitives that plug into WizardShell:
  1.  form               — schema-validated form step (zod)
  2.  oauth-consent      — OAuth popup + callback capture (opaque to shell)
  3.  api-key-paste      — paste box + test-call button + masked-on-save
  4.  webhook-probe      — show endpoint + wait-for-inbound-POST listener
  5.  dns-verify         — display records + polling verifier with timeout
  6.  csv-import         — file drop + column mapping + preview + confirm
  7.  async-check        — polls a long-running job with status ticker
  8.  content-picker     — grid/list picker backed by a prop-provided fetcher
  9.  review-and-confirm — read-only summary of collected data + final CTA
  10. celebration        — Tier 2 `wizard-complete` choreography slot; fires
                           onComplete → registerIntegration / logActivity
Plus the Custom escape hatch (passthrough render).

- Each step-type exports: { Component, resume(state), validate(state) }
- Shell wires save-and-resume: each step's state is committed to
  wizard_progress.current_step + wizard_progress.state_blob on next()
- celebration step consumes Tier 2 choreography slot 2 (wizard-complete;
  already registered in A4 choreography baseline — verify)
- No OAuth vendor specifics, no API-key crypto (vault lands in B2), no
  Observatory registration (SW-3 wires that)
- Rollback: feature-flag-gated per step-type — kill-switch
  setup_wizards_enabled short-circuits the shell entirely
```

## 4. Skill whitelist

- `framer-motion` — celebration step Tier 2 slot; all other steps use `houseSpring` for state transitions
- `typescript-validation` — zod schemas for form step + validate() contract across step-types
- `drizzle-orm` — reads/writes `wizard_progress.state_blob` (JSON column)
- `tailwind-v4` — step-type component styling
- (No new LLM work. No `nextauth` — step-types don't auth; shell did.)

## 5. File whitelist (G2 scope discipline)

**New (per step-type — 10 components):**
- `components/lite/wizard-steps/form-step.tsx`
- `components/lite/wizard-steps/oauth-consent-step.tsx`
- `components/lite/wizard-steps/api-key-paste-step.tsx`
- `components/lite/wizard-steps/webhook-probe-step.tsx`
- `components/lite/wizard-steps/dns-verify-step.tsx`
- `components/lite/wizard-steps/csv-import-step.tsx`
- `components/lite/wizard-steps/async-check-step.tsx`
- `components/lite/wizard-steps/content-picker-step.tsx`
- `components/lite/wizard-steps/review-confirm-step.tsx`
- `components/lite/wizard-steps/celebration-step.tsx`
- `components/lite/wizard-steps/index.ts` — barrel export + `STEP_TYPE_REGISTRY` map

**New (support):**
- `lib/wizards/step-types.ts` — `StepTypeDefinition<TState>` interface + shared helpers (resume, validate, state-blob marshalling)
- `lib/kill-switches.ts` — add `setup_wizards_enabled` kill-switch (edit)
- `tests/wizard-steps-form.test.ts`
- `tests/wizard-steps-api-key-paste.test.ts`
- `tests/wizard-steps-celebration.test.ts` (Tier 2 choreography wiring)
- `tests/wizard-steps-review-confirm.test.ts`
- `tests/wizard-steps-resume.test.ts` (state-blob round-trip for 3 representative step-types)
- `sessions/sw-4-brief.md` — Wave 4 next-session brief (G11.b — SW-1/SW-3 pre-compiled by earlier sessions)

**Edited:**
- `components/lite/wizard-shell.tsx` (from SW-1) — wire `STEP_TYPE_REGISTRY` lookup
- `lib/wizards/types.ts` (from SW-1) — extend `WizardStepDefinition` with the 10 literal `type` values + typed state-blob inference
- `sessions/sw-2-handoff.md` — write at close

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** (consumed inside specific step-types)
  - `wizards.dns_verify_poll_interval_ms` (dns-verify step)
  - `wizards.async_check_timeout_ms` (async-check step)
  - `wizards.webhook_probe_timeout_ms` (webhook-probe step)
  - If any of these keys don't exist in `docs/settings-registry.md` / `0001_seed_settings.sql`, **stop and patch** `settings-registry.md` + add a seed-migration row — don't inline literals.
- **Seeds:** potentially `wizards.{dns_verify_poll_interval_ms, async_check_timeout_ms, webhook_probe_timeout_ms}` if not already seeded (verify in G1)

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] SW-1 closed cleanly — verify: `ls sessions/sw-1-handoff.md`
- [ ] SW-1 shipped the 3 tables — verify: `ls lib/db/schema/wizard-progress.ts lib/db/schema/wizard-completions.ts lib/db/schema/integration-connections.ts`
- [ ] `WizardShell` exists — verify: `ls components/lite/wizard-shell.tsx`
- [ ] `WizardDefinition` type exists — verify: `grep "export type WizardDefinition" lib/wizards/types.ts`
- [ ] Tier 2 `wizard-complete` choreography registered in A4 — verify: `grep "wizard-complete" lib/motion/choreographies.ts`
- [ ] `houseSpring` available — verify: `grep "houseSpring" lib/design-tokens.ts`
- [ ] Migration 0008 present (SW-1) — verify: `ls lib/db/migrations/0008_*`
- [ ] No existing step-type files — verify: `ls components/lite/wizard-steps/ 2>&1 | grep "No such"`

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated.** `setup_wizards_enabled` kill-switch added to `lib/kill-switches.ts`; `WizardShell` short-circuits to a maintenance placeholder when false. No schema changes (SW-1 owns schema). Revert = delete `components/lite/wizard-steps/` + revert `WizardShell` registry wire-up. Mid-flight wizards safely pause (spec §8).

## 9. Definition of done

- [ ] 10 step-types + custom escape hatch implemented, each conforming to `StepTypeDefinition<TState>`
- [ ] `STEP_TYPE_REGISTRY` exports a string-keyed map the shell uses for lookup
- [ ] `resume(state)` round-trips identically for form, api-key-paste, and content-picker step-types (tested)
- [ ] `validate(state)` rejects malformed state with user-safe branded copy (no raw stack traces)
- [ ] celebration step plays the Tier 2 `wizard-complete` choreography; reduced-motion parity confirmed
- [ ] `setup_wizards_enabled` kill-switch short-circuits the shell to the maintenance placeholder
- [ ] G4 literal-grep: no autonomy literals (poll intervals, timeouts) in the diff — all `settings.get()`
- [ ] G5 motion gate: each step-type's state transitions use `houseSpring`; celebration uses the registered Tier 2 slot
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] G-gates G0–G12 run end-to-end; handoff written; tracker updated; sw-4-brief.md written

## 10. Split-point (if context tight)

If at ~70% context budget the shell wire-up + first 5 step-types are done cleanly, stop and schedule **SW-2b** to ship steps 6–10 + the celebration-step Tier 2 wiring. Write the interim handoff per G11 mid-session checkpoint. Splitting along a step-type boundary is safe because `STEP_TYPE_REGISTRY` is additive — SW-2a's shipped registry keys remain valid while SW-2b adds more.

## 11. Notes for the next-session brief writer (SW-4)

SW-3's brief will be written by SW-1 (pre-compiled at SW-1 close per G11.b). SW-2 therefore owes only SW-4's brief.

- **SW-4 (FEATURE, medium):** Admin critical-flight sequencer — first-login chain Stripe → Resend → Graph API → capstone; replaces the `hasCompletedCriticalFlight()` stub in `lib/auth/has-completed-critical-flight.ts` with a real `wizard_completions` check; integrates with `proxy.ts` gate 2. Depends on SW-3 + A8.
