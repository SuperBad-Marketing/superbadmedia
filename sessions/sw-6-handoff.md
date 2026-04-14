# SW-6 — Resend critical wizard — Handoff

**Closed:** 2026-04-14
**Brief:** `sessions/sw-6-brief.md`
**Model:** Sonnet (`/normal`)
**Type:** FEATURE + INFRA
**Rollback:** feature-flag-gated (`setup_wizards_enabled`). Revert = delete
new files + revert `page.tsx` + `critical-flight-client.tsx` edits. No
schema change. No migration.

## What shipped

- **`lib/integrations/vendors/resend.ts`** — vendor manifest, `vendorKey =
  "resend"`, one job band (`resend.email.send`, p95 600 / p99 1500 ms).
  Kill-switch shared with the rest of the wizard family
  (`setup_wizards_enabled`). Resend has no provisioning-time handshake,
  so the wizard does not register a webhook-receive band; first real
  transactional send is the eventual proof.
- **`lib/wizards/defs/resend.ts`** — `WizardDefinition<ResendAdminPayload>`
  composing `api-key-paste → review-and-confirm → celebration` (three
  steps, one shorter than stripe-admin). `completionContract.verify`
  instantiates `new Resend(key).apiKeys.list()` as the cheapest
  authenticated identity ping; returns a branded `Resend rejected …`
  reason on failure. `artefacts.integrationConnections: true`. Voice
  treatment, tab-title pool, no per-wizard capstone (arc-level only per
  spec §8.3). Self-registers via `registerWizard()` on import.
- **`lib/wizards/defs/index.ts`** — barrel; eagerly imports
  `./stripe-admin` + `./resend`. Closes
  `sw5_wizard_defs_barrel_owed`. Route code now imports
  `@/lib/wizards/defs` instead of per-def side-effect imports.
- **`app/lite/setup/critical-flight/[key]/actions-resend.ts`** —
  `testResendKeyAction(key)` (used by the api-key-paste step) +
  `completeResendAction(payload)` (celebration orchestrator: runs
  `registerIntegration` → `verifyCompletion` → `wizard_completions`
  insert → `unstable_update({})`). Mirrors the stripe-admin actions
  shape minus the webhook-received polling action. Kept in a separate
  file (not folded into `actions.ts`) because the combined file would
  cross the ~200 LOC split-point named in the brief; separate files
  also keep the per-wizard blast radius tight for SW-7.
- **`app/lite/setup/critical-flight/[key]/page.tsx`** — swapped the
  per-def side-effect import for the barrel (`import
  "@/lib/wizards/defs"`).
- **`app/lite/setup/critical-flight/[key]/critical-flight-client.tsx`** —
  branches by `wizardKey` between `stripe-admin` and `resend`:
  - Per-wizard initial states (the `webhook-probe` entry is only seeded
    for `stripe-admin`).
  - Per-wizard `onComplete` payload builder + Server Action dispatch.
  - Per-wizard `buildReviewSummary()` — stripe shows the masked key +
    webhook status; resend shows the masked key only.
  - `testCall` for the api-key-paste step picks the right Server Action
    by `wizardKey`.
- **`tests/resend-wizard.test.ts`** — 5 unit tests mirroring
  `stripe-admin-wizard.test.ts`. Imports via the defs barrel to also
  assert the barrel registers both wizards.
- **`tests/e2e/critical-flight-resend.spec.ts`** — Playwright smoke
  covering paste → review → celebration + DB assertions on
  `wizard_completions` + `integration_connections`. Navigates directly
  to `/lite/setup/critical-flight/resend` (see "Decisions" below).
  `test.skip()` when `RESEND_TEST_KEY` is unset — scaffold stays green
  in CI without a real key.
- **`.env.example`** — `RESEND_TEST_KEY` declared (test-only; mirrors
  the `STRIPE_TEST_KEY` pattern from SW-5c).

## Decisions

- **Actions file split vs fold-in.** Brief §5 allowed either. Split into
  `actions-resend.ts` because the combined file would have crossed the
  ~200 LOC threshold and separate files keep a per-wizard blast radius
  when SW-7 (graph-api-admin) lands — oauth-consent will be
  structurally different and a third co-tenant in one actions module
  starts reading as a dumping ground.
- **Single-file client with `wizardKey` branches.** Brief §11 invited a
  split consideration at the second wizard; stayed single-file because
  the shared scaffolding (step index, states object, shell wiring,
  `onStepStateChange`) still reads cleanly with two branches.
  Recommended (noted in the SW-7 brief) to revisit at the third wizard:
  oauth-consent's lack of api-key-paste will be the natural pressure
  point for a per-wizard client split.
- **Verify ping = `apiKeys.list()`.** Brief named two candidates
  (`GET /api-keys` or `GET /domains`); `apiKeys.list()` is the minimal
  scope — every valid Resend key can read its own api-keys; not all
  keys have Domains scope. Cheapest authenticated call that reliably
  fails with an invalid key.
- **E2E navigates directly to `/lite/setup/critical-flight/resend`.**
  The seeded session has `critical_flight_complete=false` and the
  ordering in `wizards.critical_flight_wizards` puts stripe-admin
  first; a bounce through `/lite/first-run` would redirect there, not
  to resend. Direct navigation is the right way to isolate this spec's
  coverage. Noted in the spec file's module comment for future
  auditors.

## Files touched

| File | Change |
| --- | --- |
| `lib/integrations/vendors/resend.ts` | NEW |
| `lib/wizards/defs/resend.ts` | NEW |
| `lib/wizards/defs/index.ts` | NEW (barrel — closes `sw5_wizard_defs_barrel_owed`) |
| `app/lite/setup/critical-flight/[key]/actions-resend.ts` | NEW |
| `app/lite/setup/critical-flight/[key]/page.tsx` | Swap per-def import for barrel |
| `app/lite/setup/critical-flight/[key]/critical-flight-client.tsx` | Branch by `wizardKey` |
| `tests/resend-wizard.test.ts` | NEW |
| `tests/e2e/critical-flight-resend.spec.ts` | NEW |
| `.env.example` | `RESEND_TEST_KEY` declared |
| `PATCHES_OWED.md` | Close `sw5_wizard_defs_barrel_owed` |
| `sessions/sw-6-handoff.md` | NEW (this file) |
| `sessions/sw-7-brief.md` | NEW (pre-compiled per G11.b) |
| `SESSION_TRACKER.md` | Next Action → SW-7 |

No migration. No settings keys touched. No schema change.

## Verification

- `npx tsc --noEmit` — zero errors
- `npm test` — 325/325 green (320 prior + 5 new from `resend-wizard.test.ts`)
- `npm run lint` — clean
- `npm run build` — clean (all routes compile including
  `/lite/setup/critical-flight/[key]`)
- `npm run test:e2e` — 2 skipped (both critical-flight specs opt-in; set
  `STRIPE_TEST_KEY` / `RESEND_TEST_KEY` to exercise the live arcs)

## G0–G12 walkthrough

- **G0 kickoff** — brief read; last handoffs (SW-5c, SW-5b) read; Sonnet
  tier matches brief.
- **G1 preflight** — 6/6 preconditions verified: SW-5c handoff,
  Playwright scaffold, stripe-admin wizard + route + actions, Resend SDK
  in `package.json`, `wizards.critical_flight_wizards` seeded with
  "resend", no existing `lib/wizards/defs/index.ts`.
- **G2 scope discipline** — every file in the whitelist, nothing outside.
- **G3 context budget** — comfortable single-session; no split.
- **G4 literal-grep** — no autonomy thresholds introduced. The
  wizard reads `wizards.expiry_days` + `wizards.webhook_probe_timeout_ms`
  (latter already seeded; resend never triggers the webhook branch).
- **G5 motion** — no motion changes.
- **G6 rollback** — feature-flag-gated via `setup_wizards_enabled`;
  barrel is import-only; no schema change.
- **G7 artefacts** — every whitelisted file present post-commit
  (verified in the handoff table above).
- **G8 typecheck + tests + lint + build** — all green (numbers above).
- **G9 E2E** — Resend spec opt-in via `RESEND_TEST_KEY`; scaffold green
  without a key. Stripe spec continues to skip without `STRIPE_TEST_KEY`.
- **G10 manual browser** — not run this session (E2E is the proxy;
  scaffold compiles clean via `next build`). When `RESEND_TEST_KEY`
  gets set, the Playwright spec covers the flow end to end.
- **G11.b** — SW-7 brief pre-compiled.
- **G12** — tracker + commit next.

## PATCHES_OWED status

- **Closed this session:**
  - ~~`sw5_wizard_defs_barrel_owed`~~ — barrel ships at
    `lib/wizards/defs/index.ts`.
- **Still open:**
  - `sw5_integration_rollback_on_insert_failure` — Observatory wave.
- No new rows opened by SW-6.

## Open threads for SW-7

- `wizards.critical_flight_wizards` still orders
  `['stripe-admin','resend','graph-api-admin']` — SW-7 is the last
  critical-flight wizard.
- Graph API uses **oauth-consent** (not api-key-paste) — SW-2 already
  shipped the step-type; SW-7 wires it. Structurally different from
  SW-5/SW-6: the consent redirect + callback returns an opaque
  token bundle rather than a user-pasted string.
- The third co-tenant is the right moment to reconsider splitting
  `critical-flight-client.tsx` into per-wizard client files under a
  shared shell. Noted in SW-7 brief §11.
- Playwright E2E for graph-api-admin will need a Microsoft test tenant;
  opt-in via `GRAPH_TEST_*` env like the other two. May not be worth
  wiring for v1.0 — brief defers the call to SW-7.
- No new PATCHES_OWED rows opened.

## Notes

- `lib/wizards/defs/index.ts` is the canonical registration entrypoint
  from now on. Any future wizard module must add itself to the barrel;
  the route page is wired once and left alone.
- The Resend wizard's `verify` function does not consume scopes: a
  read-only key will still pass `apiKeys.list()` against itself. If
  Resend later changes that shape, the test's "rejects a bogus key"
  assertion catches the regression.
