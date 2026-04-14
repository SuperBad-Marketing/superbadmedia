# SW-6 — Resend critical wizard — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0 / §"Pre-compiled session briefs".**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** SW-6
- **Wave:** 4 — Setup Wizards
- **Type:** FEATURE (second consumer wizard) + INFRA (defs barrel)
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes
- **Estimated context:** medium. Wizard shape mirrors SW-5 minus the
  webhook-probe leg; no new step-types; no migration.

## 2. Spec references

- `docs/specs/setup-wizards.md` §5.2 (Resend critical-flight entry)
- `sessions/sw-5-handoff.md` — first consumer wizard pattern
- `sessions/sw-5c-handoff.md` — E2E fixtures + kill-switch env wiring
- `lib/integrations/vendors/stripe.ts` — reference manifest shape
- `AUTONOMY_PROTOCOL.md` §G12 (E2E-mandatory on critical flows)

## 3. Acceptance criteria

```
SW-6 — FEATURE + INFRA, medium
- Ships lib/wizards/defs/resend.ts: WizardDefinition<ResendAdminPayload>
  with api-key-paste → review-and-confirm → celebration (no
  webhook-probe — Resend does not expose a handshake probe at
  provisioning time; the first real outbound send is the later proof).
- `completionContract.verify` performs a live Resend identity ping (the
  cheapest authenticated call; GET /api-keys or GET /domains — pick the
  least-scope-required endpoint).
- `artefacts.integrationConnections: true`. New manifest at
  lib/integrations/vendors/resend.ts (vendor_key = "resend"; job bands
  minimally covering `resend.email.send`; reuse stripe.ts shape).
- Ships lib/wizards/defs/index.ts barrel that eagerly imports every
  WizardDefinition module so side-effect registration happens in one
  place. /lite/setup/critical-flight/[key]/page.tsx imports the barrel
  rather than a per-def side-effect import.
- Dedicated-route wiring under /lite/setup/critical-flight/[key]:
  new branch in critical-flight-client.tsx (or a per-wizard client split
  if this session decides single-client is bloating), plus resend-only
  Server Actions (testResendKey, completeResend — no webhook action).
- Unit tests: resend-wizard.test.ts mirrors stripe-admin-wizard.test.ts
  (step composition, manifest wiring, verify-rejects-bad-key ping).
- E2E: tests/e2e/critical-flight-resend.spec.ts reuses fixtures/seed-db
  and fixtures (no stripe-signature needed). test.skip when
  RESEND_TEST_KEY is unset. Arc is one step shorter than SW-5c (no
  webhook POST).
- Rollback: feature-flag-gated via setup_wizards_enabled; barrel is
  import-only.
- Close PATCHES_OWED sw5_wizard_defs_barrel_owed with the barrel landing.
```

## 4. Skill whitelist

- `webapp-testing` — Playwright reuse, no new fixtures
- `drizzle-orm` — no schema change expected; only if the session decides
  to seed/store anything new (prefer not to)
- `nextauth` — no change
- `email-nodejs` — Resend API surface + SDK shape

## 5. File whitelist (G2 scope discipline)

**New:**
- `lib/wizards/defs/resend.ts`
- `lib/wizards/defs/index.ts` — barrel (closes `sw5_wizard_defs_barrel_owed`)
- `lib/integrations/vendors/resend.ts`
- `app/lite/setup/critical-flight/[key]/actions-resend.ts` — or fold into
  the existing `actions.ts` (decide in-session; prefer separate file if
  the single-file actions module crosses ~200 LOC)
- `tests/resend-wizard.test.ts`
- `tests/e2e/critical-flight-resend.spec.ts`
- `sessions/sw-6-handoff.md` — at close
- `sessions/sw-7-brief.md` — pre-compile per G11.b (graph-api-admin next;
  OR the first Observatory wave entry if graph-api-admin is deferred)

**Edited:**
- `app/lite/setup/critical-flight/[key]/page.tsx` — swap
  `import "@/lib/wizards/defs/stripe-admin"` for
  `import "@/lib/wizards/defs"` (the barrel).
- `app/lite/setup/critical-flight/[key]/critical-flight-client.tsx` —
  branch by `wizardKey` to wire resend actions (or split into
  per-wizard clients if this cleans the code up).
- `.env.example` — add `RESEND_TEST_KEY` (optional, test-only; matches
  `STRIPE_TEST_KEY` pattern from SW-5c).
- `PATCHES_OWED.md` — close `sw5_wizard_defs_barrel_owed`.

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** same keys SW-5 consumes (`wizards.expiry_days`). No
  webhook-probe timeout because Resend has no probe.
- **Seeds:** none.

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] SW-5c closed — verify: `ls sessions/sw-5c-handoff.md`
- [ ] Playwright scaffold present — verify: `ls playwright.config.ts
      tests/e2e/fixtures/seed-db.ts`
- [ ] Stripe wizard def + route + actions present — verify: `ls
      lib/wizards/defs/stripe-admin.ts
      app/lite/setup/critical-flight/\[key\]/actions.ts`
- [ ] Resend SDK installed — verify: `grep '"resend"' package.json`
- [ ] Critical-flight ordering includes "resend" — verify: grep
      `wizards.critical_flight_wizards` seed or `docs/settings-registry.md`
- [ ] No `lib/wizards/defs/index.ts` barrel yet — verify: `ls
      lib/wizards/defs/index.ts` returns no such file

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated** (`setup_wizards_enabled` off = entire wizard short-
circuits via `hasCompletedCriticalFlight` + `WizardShell` maintenance
state). Revert = delete new files + revert the page.tsx + client.tsx
edits. No schema change. No migration.

## 9. Definition of done

- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → 320+N green (N = new unit tests)
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] `npm run test:e2e` → green (stripe skipped without key, resend
      skipped without key — both scaffold-green)
- [ ] `AUTONOMY_PROTOCOL.md` G12 satisfied for the Resend critical flow
- [ ] `sw5_wizard_defs_barrel_owed` closed in `PATCHES_OWED.md`
- [ ] Handoff written; tracker updated; SW-7 brief pre-compiled

## 10. Split-point (if context tight)

Split at barrel vs Resend wizard:
- **SW-6-a:** barrel + page.tsx / client.tsx edits + closing the
  PATCHES_OWED row. No new wizard. Unit tests for the barrel (at minimum,
  one test asserting `getWizard("stripe-admin")` still works after the
  barrel import).
- **SW-6-b:** Resend wizard def + actions + tests + E2E.

Both close before SW-7 starts.

## 11. Notes for the next-session brief writer

- After SW-6, next is either **SW-7 (graph-api-admin)** if that's the
  third critical-flight wizard per
  `wizards.critical_flight_wizards`, **or** the first Observatory wave
  entry if SW-7 is bundled into a later wave. Check
  `docs/settings-registry.md` + SCOPE.md before deciding.
- If SW-7 is graph-api-admin, it introduces an **oauth-consent** step
  flow (no api-key-paste) — structurally different from SW-5/SW-6. That
  brief will need to lean on the `oauth-consent` step-type shipped in
  SW-2 and likely needs a Microsoft Graph test tenant for E2E (which may
  not be worth wiring in v1.0; opt-in like the other two).
- Consider whether the single-file `critical-flight-client.tsx` with
  wizardKey branches is still the cleanest pattern once three wizards
  share it — the third may be the right moment to split into per-wizard
  client files under a shared shell.
