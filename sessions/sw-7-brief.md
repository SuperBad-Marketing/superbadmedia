# SW-7 — graph-api-admin critical wizard — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0 / §"Pre-compiled session briefs".**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** SW-7
- **Wave:** 4 — Setup Wizards
- **Type:** FEATURE (third + final critical-flight wizard)
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes
- **Estimated context:** medium-to-large. Structurally different from
  SW-5/SW-6 — replaces api-key-paste with oauth-consent; adds an oauth
  callback route; may force the per-wizard client split.

## 2. Spec references

- `docs/specs/setup-wizards.md` §5.3 (Graph API critical-flight entry)
  and §4 (oauth-consent step-type contract)
- `sessions/sw-6-handoff.md` — second consumer wizard pattern + the
  client-split decision deferred to this session
- `sessions/sw-2-handoff.md` — oauth-consent step-type implementation
- `lib/integrations/vendors/resend.ts` — reference manifest shape
- `AUTONOMY_PROTOCOL.md` §G12 (E2E-mandatory on critical flows)

## 3. Acceptance criteria

```
SW-7 — FEATURE, medium-to-large
- Ships lib/wizards/defs/graph-api-admin.ts:
  WizardDefinition<GraphAdminPayload> with oauth-consent →
  review-and-confirm → celebration. No api-key-paste, no webhook-probe.
- completionContract.verify performs a live Microsoft Graph identity
  ping (GET /me — the minimum scope every access token can read).
- artefacts.integrationConnections: true. New manifest at
  lib/integrations/vendors/graph-api.ts (vendor_key = "graph-api";
  jobs minimally covering `graph.mail.send` + `graph.calendar.read` —
  confirm exact job set against the spec at session start).
- Adds graph-api-admin to lib/wizards/defs/index.ts barrel.
- Dedicated-route wiring under /lite/setup/critical-flight/[key]:
  - Decide in-session whether to split critical-flight-client.tsx
    into per-wizard files (see §11) or add a third `wizardKey` branch.
  - New Server Actions file: either actions-graph.ts (mirroring the
    SW-6 split) or fold into actions.ts — prefer split.
  - New oauth callback route: app/lite/setup/critical-flight/[key]/
    oauth-callback/route.ts OR a shared /api/oauth/[vendor]/callback
    depending on what SW-2's oauth-consent step expects — read
    components/lite/wizard-steps/oauth-consent-step.tsx to decide.
- Unit tests: graph-api-admin-wizard.test.ts mirrors
  stripe/resend tests (step composition, manifest wiring,
  verify-rejects-bad-token ping).
- E2E: tests/e2e/critical-flight-graph.spec.ts reuses the existing
  Playwright fixtures. Skipped by default behind GRAPH_TEST_TOKEN (or
  similar) — may not be worth wiring the full oauth consent for v1.0;
  discuss at session start and default to skipped with a direct-token
  injection path for the test.
- Rollback: feature-flag-gated via setup_wizards_enabled.
- First-run capstone now fires only after all three critical wizards
  complete (stripe-admin + resend + graph-api-admin). Verify this is
  already handled by hasCompletedCriticalFlight() reading the ordered
  settings list — no change expected but confirm.
```

## 4. Skill whitelist

- `webapp-testing` — Playwright reuse
- `drizzle-orm` — unlikely schema change
- `nextauth` — potential session refresh around oauth callback

## 5. File whitelist (G2 scope discipline)

**New:**
- `lib/wizards/defs/graph-api-admin.ts`
- `lib/integrations/vendors/graph-api.ts`
- `app/lite/setup/critical-flight/[key]/actions-graph.ts` — or folded in;
  prefer split (see SW-6 decision).
- OAuth callback route — location TBD in-session (see §3).
- `tests/graph-api-admin-wizard.test.ts`
- `tests/e2e/critical-flight-graph.spec.ts`
- `sessions/sw-7-handoff.md` — at close
- `sessions/sw-8-brief.md` — pre-compile per G11.b (first Observatory
  wave entry OR next setup wizard if SCOPE shows more before Observatory
  wave; check `SESSION_TRACKER.md` and `BUILD_PLAN.md`)

**Potentially new (decide in-session):**
- Per-wizard client files under
  `app/lite/setup/critical-flight/[key]/clients/` if the split path
  wins. Otherwise a third branch in
  `critical-flight-client.tsx`.

**Edited:**
- `lib/wizards/defs/index.ts` — add `./graph-api-admin` import.
- `app/lite/setup/critical-flight/[key]/critical-flight-client.tsx` —
  third-wizard branch or split refactor.
- `.env.example` — add `GRAPH_TEST_TOKEN` (optional, test-only) +
  any required `MS_GRAPH_CLIENT_ID` / `MS_GRAPH_TENANT_ID` the real
  oauth flow needs (may punt the real oauth to SW-7-b).

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** `wizards.expiry_days`. No webhook-probe timeout needed.
  Possibly `integrations.graph.oauth_scopes` (string list) — if not
  already seeded, add it to `docs/settings-registry.md` in this session.
- **Seeds:** potentially `integrations.graph.oauth_scopes` via
  migration (guard behind G8 literal-grep — any scope list must live in
  settings, never a literal in code).

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] SW-6 closed — verify: `ls sessions/sw-6-handoff.md`
- [ ] Defs barrel present — verify: `ls lib/wizards/defs/index.ts`
- [ ] Resend wizard + manifest present — verify: `ls
      lib/wizards/defs/resend.ts lib/integrations/vendors/resend.ts`
- [ ] oauth-consent step-type shipped — verify: `ls
      components/lite/wizard-steps/oauth-consent-step.tsx`
- [ ] Microsoft Graph SDK decision — verify: grep for
      `@microsoft/microsoft-graph-client` in `package.json`; if absent,
      decide in-session whether to use the SDK (flag the install per
      CLAUDE.md) or call `fetch` against graph.microsoft.com directly
      (likely the right call for one endpoint — no new dep).
- [ ] Critical-flight ordering includes "graph-api-admin" — verify:
      grep `wizards.critical_flight_wizards` in
      `docs/settings-registry.md` / `lib/db/migrations/`

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated** (`setup_wizards_enabled`). Revert = delete new
files + revert barrel + client edits. No schema change unless
`integrations.graph.oauth_scopes` setting is seeded — in which case
revert is a down-migration.

## 9. Definition of done

- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → 325+N green (N = new unit tests)
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] `npm run test:e2e` → green (stripe + resend skipped without keys,
      graph-api-admin skipped without token)
- [ ] `AUTONOMY_PROTOCOL.md` G12 satisfied for the Graph critical flow
- [ ] Handoff written; tracker updated; SW-8 brief pre-compiled
- [ ] First-run capstone now gates on all three wizards (verify — no
      code change expected)

## 10. Split-point (if context tight)

Split at oauth plumbing vs wizard wiring:
- **SW-7-a:** oauth-consent callback route + vendor manifest + defs +
  unit tests. No E2E.
- **SW-7-b:** E2E + per-wizard client split (if taken) + callback
  hardening.

Both close before SW-8 starts.

## 11. Notes for the next-session brief writer

- If SW-7 takes the client-split path, SW-8 inherits per-wizard client
  files as the established pattern — name them accordingly.
- Graph API oauth is a meaningfully bigger lift than SW-5/SW-6 because
  the session needs a registered Microsoft app (client id, tenant,
  redirect URI whitelist). If Andy doesn't have one set up yet,
  SW-7-a can ship the skeleton + tests while SW-7-b pairs with a
  human-in-the-loop moment to register the app.
- SW-7 is the last critical-flight wizard. After it closes, Wave 4
  shifts to non-critical wizards (Observatory / admin onboarding /
  client-facing first-run wizards) — check `BUILD_PLAN.md` for the
  next wave entry.
- Client-split recommendation: if SW-7 adds a third `wizardKey` branch
  to `critical-flight-client.tsx`, the file crosses ~300 LOC and starts
  mixing unrelated step configurations (api-key-paste, webhook-probe,
  oauth-consent). The natural split is one client file per
  `wizardKey`, sharing the state-driver skeleton via a small hook
  (e.g. `useCriticalFlightShell(steps, states, onComplete)`).
