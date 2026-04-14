# SW-7 — graph-api-admin critical wizard — Handoff

**Closed:** 2026-04-14
**Brief:** `sessions/sw-7-brief.md`
**Model:** Sonnet (`/normal`)
**Type:** FEATURE
**Rollback:** feature-flag-gated (`setup_wizards_enabled`). Revert = delete
new files + revert barrel + page.tsx/client dispatcher edits +
.env.example edits. No schema change. No migration.

## What shipped

- **`lib/integrations/vendors/graph-api.ts`** — vendor manifest,
  `vendorKey = "graph-api"`, two job bands (`graph.mail.send` p95 900 /
  p99 2200 ms; `graph.calendar.read` p95 500 / p99 1500 ms). Kill-switch
  shared with the wizard family. `GRAPH_OAUTH_SCOPES` exported as a
  design-time constant (not an autonomy threshold — doesn't enter
  `settings`).
- **`lib/wizards/defs/graph-api-admin.ts`** —
  `WizardDefinition<GraphAdminPayload>` composing `oauth-consent →
  review-and-confirm → celebration`. `completionContract.verify` performs
  a live `GET https://graph.microsoft.com/v1.0/me` Bearer-token ping (the
  minimum scope every access token can read). Returns a branded
  `Microsoft rejected that token: …` reason on failure. No Graph SDK
  dependency — one endpoint is `fetch`'s job. Self-registers via
  `registerWizard()`. No per-wizard capstone (arc-level only).
- **`lib/wizards/defs/index.ts`** — barrel now imports `./graph-api-admin`
  alongside `./stripe-admin` and `./resend`. All three critical-flight
  wizards register from the one entrypoint.
- **Per-wizard client split.** Brief §11 recommended the split at the
  third co-tenant; taken this session.
  - **`.../clients/use-critical-flight-shell.ts`** — shared hook owning
    `index`, `states`, `setStates`, `onStepStateChange`, `advance`,
    `handleCancel`, `onDone`.
  - **`.../clients/stripe-admin-client.tsx`** — stripe arc (api-key-paste
    → webhook-probe → review → celebration).
  - **`.../clients/resend-client.tsx`** — resend arc (paste → review →
    celebration).
  - **`.../clients/graph-api-admin-client.tsx`** — graph arc
    (oauth-consent → review → celebration). Adds test-only `?testToken=`
    injection gated on server-seeded `allowTestTokenInjection`.
  - **`.../critical-flight-client.tsx`** — now a thin dispatcher by
    `wizardKey`; drops all per-wizard logic.
- **`app/lite/setup/critical-flight/[key]/actions-graph.ts`** —
  `completeGraphAdminAction(payload)` (celebration orchestrator: runs
  `registerIntegration` → `verifyCompletion` → `wizard_completions` insert
  → `unstable_update({})`). No test-token Server Action — the token
  arrives via oauth callback, not a paste.
- **`app/api/oauth/graph-api/callback/route.ts`** — SW-7-a skeleton.
  Accepts `?code`/`?state`/`?error` params Microsoft returns, logs on
  error, redirects back to the wizard with `?oauth=pending` (or
  `?oauth=error&reason=…`). SW-7-b swaps the stub for a real
  `code → access_token` exchange + signed-cookie handoff to the client.
- **`app/lite/setup/critical-flight/[key]/page.tsx`** — builds
  `graphAuthorizeUrl` from `MS_GRAPH_CLIENT_ID` / `MS_GRAPH_TENANT_ID` +
  `NEXT_PUBLIC_APP_URL` (falls back to `"#"` when env unset), and passes
  `allowTestTokenInjection = NODE_ENV !== "production"` through to the
  dispatcher. Both props are graph-admin-only; stripe/resend clients
  ignore them.
- **`tests/graph-api-admin-wizard.test.ts`** — 5 unit tests mirroring the
  stripe/resend shape (step composition, manifest wiring, audience +
  render-mode + capstone-undefined, registry membership via the barrel,
  live-ping rejects a bogus token).
- **`tests/e2e/critical-flight-graph.spec.ts`** — Playwright smoke using
  the `?testToken=` direct-injection path (bypasses real oauth for v1.0).
  DB assertions on `wizard_completions` + `integration_connections`.
  `test.skip()` when `GRAPH_TEST_TOKEN` is unset — scaffold stays green
  without a real token.
- **`.env.example`** — `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_TENANT_ID`,
  `GRAPH_TEST_TOKEN` declared. All three are test/dev-only until Andy
  registers an Azure app in SW-7-b.

## Decisions

- **Client-split taken.** Brief §11 flagged the third co-tenant as the
  natural pressure point. oauth-consent has no api-key-paste or
  webhook-probe, and a third branch in the monolithic client file
  would have crossed ~350 LOC while mixing three unrelated step
  configurations. The split keeps per-wizard blast radius tight for
  Wave 4's remaining (non-critical) wizards.
- **No Microsoft Graph SDK install.** The wizard hits one endpoint
  (`GET /me`) — `fetch` is sufficient, every dependency is a liability
  (per CLAUDE.md). Flagged as the right call at precondition check.
- **`integrations.graph.oauth_scopes` stays a constant, not a setting.**
  Brief §6 asked whether to promote. OAuth scopes are design-time
  configuration, not an autonomy threshold Andy would tweak; they don't
  match the G4/G8 "autonomy-sensitive" rubric (review windows, timeouts,
  thresholds, confidence cutoffs, etc.). Kept as `GRAPH_OAUTH_SCOPES` in
  the manifest file.
- **OAuth callback route shipped as a skeleton.** Brief §3 +
  §10 explicitly allowed SW-7-a (skeleton + tests) / SW-7-b (real oauth
  + E2E hardening). Taken the SW-7-a path: a real
  `code → access_token` exchange requires a registered Azure app
  (client secret in the Coolify env, redirect-URI whitelist, etc.) which
  pairs with a human-in-the-loop moment Andy hasn't done yet. The stub
  route documents the SW-7-b plan inline.
- **E2E via `?testToken=` direct injection.** Brief §3 authorised this.
  The graph-api-admin client reads the query param only when the server
  component flags `NODE_ENV !== "production"` — production pages never
  set the flag, so the injection path is closed by construction. Matches
  how stripe/resend E2E avoids needing live vendor fixtures for the
  scaffold to stay green.
- **First-run capstone gating unchanged.**
  `hasCompletedCriticalFlight()` reads the ordered
  `wizards.critical_flight_wizards` setting; graph-api-admin was already
  in the seeded list, so no code change was needed — verified via build +
  spec expectations.

## Files touched

| File | Change |
| --- | --- |
| `lib/integrations/vendors/graph-api.ts` | NEW |
| `lib/wizards/defs/graph-api-admin.ts` | NEW |
| `lib/wizards/defs/index.ts` | Add `./graph-api-admin` import |
| `app/lite/setup/critical-flight/[key]/actions-graph.ts` | NEW |
| `app/lite/setup/critical-flight/[key]/clients/use-critical-flight-shell.ts` | NEW |
| `app/lite/setup/critical-flight/[key]/clients/stripe-admin-client.tsx` | NEW (extracted) |
| `app/lite/setup/critical-flight/[key]/clients/resend-client.tsx` | NEW (extracted) |
| `app/lite/setup/critical-flight/[key]/clients/graph-api-admin-client.tsx` | NEW |
| `app/lite/setup/critical-flight/[key]/critical-flight-client.tsx` | Rewritten as dispatcher |
| `app/lite/setup/critical-flight/[key]/page.tsx` | graphAuthorizeUrl + allowTestTokenInjection props |
| `app/api/oauth/graph-api/callback/route.ts` | NEW (skeleton) |
| `tests/graph-api-admin-wizard.test.ts` | NEW |
| `tests/e2e/critical-flight-graph.spec.ts` | NEW |
| `.env.example` | `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_TENANT_ID`, `GRAPH_TEST_TOKEN` |
| `sessions/sw-7-handoff.md` | NEW (this file) |
| `sessions/sw-8-brief.md` | NEW (pre-compiled per G11.b) |
| `SESSION_TRACKER.md` | Next Action → SW-8 |

No migration. No settings keys touched. No schema change.

## Verification

- `npx tsc --noEmit` — zero errors (cleared 3 stray iCloud `.next/types/`
  duplicates as prep; not committed — pre-existing local noise).
- `npm test` — 330/330 green (325 prior + 5 new from
  `graph-api-admin-wizard.test.ts`).
- `npm run lint` — clean.
- `npm run build` — clean; `/api/oauth/graph-api/callback` and
  `/lite/setup/critical-flight/[key]` both compile.
- `npm run test:e2e` — 3 skipped (all three critical-flight specs opt-in;
  set `STRIPE_TEST_KEY` / `RESEND_TEST_KEY` / `GRAPH_TEST_TOKEN` to
  exercise the live arcs). One environment note: Next 16 refuses to start
  a second `next dev` when another is running on 3001; an orphan
  `next-server` from a prior session had to be terminated before the
  webServer could bind to 3101. Nothing to fix in code.

## G0–G12 walkthrough

- **G0 kickoff** — brief read; last handoff (SW-6) read; Sonnet tier
  matches brief.
- **G1 preflight** — 5/5 preconditions verified: SW-6 handoff, defs
  barrel, resend wizard + manifest, oauth-consent step-type, Graph SDK
  *absence* (confirmed no install; `fetch` is the right call),
  `wizards.critical_flight_wizards` seeded with `graph-api-admin`.
- **G2 scope discipline** — every file in the brief's whitelist (split
  taken as authorised by §11); nothing outside. OAuth callback route
  location decided in-session (brief §3 left it open): dedicated
  `/api/oauth/graph-api/callback` rather than
  `/lite/setup/critical-flight/[key]/oauth-callback` — keeps vendor
  callbacks in a consistent place for future vendors.
- **G3 context budget** — comfortable single-session; no split. Skill
  whitelist (webapp-testing, drizzle-orm, nextauth) used minimally.
- **G4 literal-grep** — no autonomy thresholds introduced. Only reads
  `wizards.expiry_days` (existing). `GRAPH_OAUTH_SCOPES` is design-time
  config, not autonomy-sensitive (see Decisions).
- **G5 motion** — no motion changes.
- **G6 rollback** — feature-flag-gated via `setup_wizards_enabled`;
  barrel import-only; no schema change.
- **G7 artefacts** — every whitelisted file present (verified via
  `git status` + handoff table above).
- **G8 typecheck + tests + lint + build** — all green (numbers above).
- **G9 E2E** — Graph spec opt-in via `GRAPH_TEST_TOKEN`; stripe + resend
  specs continue to skip without their tokens. Scaffold stays green
  without keys.
- **G10 manual browser** — not run this session (E2E is the proxy;
  `next build` compiles both affected routes clean). When
  `GRAPH_TEST_TOKEN` gets set, the Playwright spec covers the direct-
  injection arc end to end.
- **G11.b** — SW-8 brief pre-compiled.
- **G12** — tracker + commit next.

## PATCHES_OWED status

- **Closed this session:** none (no prior row gated on SW-7).
- **Opened this session:**
  - `sw7b_graph_oauth_callback_hardening` — SW-7-b: swap the
    `/api/oauth/graph-api/callback` stub for a real
    `code → access_token` exchange + signed-cookie handoff to the
    client, plus a `claimGraphOAuthTokenAction()` Server Action. Pairs
    with Andy registering an Azure app (client id + tenant + secret +
    redirect whitelist). Raised by SW-7, owner TBD (likely SW-7-b or a
    dedicated oauth-hardening session after Wave 4 closes).
- **Still open (carried):**
  - `sw5_integration_rollback_on_insert_failure` — Observatory wave.

## Open threads for SW-8

- Three critical-flight wizards now complete (stripe + resend +
  graph-api-admin). `hasCompletedCriticalFlight()` fires the arc-level
  capstone at `/lite/first-run` once all three `wizard_completions` rows
  exist. Capstone motion/copy was shipped in SW-4; verify on first live
  run-through (manual check gated on all three TEST keys being present
  simultaneously).
- Wave 4's remaining scope per BUILD_PLAN.md: the SW-5 bundle's
  non-critical admin integration wizards (Pixieset, Meta Ads, Google
  Ads, Twilio, generic API-key + OpenAI + Anthropic + SerpAPI +
  Remotion) and the SW-6 plan entry (`wizard_resume_nudge` /
  `wizard_expiry_warn` / `wizard_auto_expire` crons + voice & delight
  treatment). The SW-IDs in BUILD_PLAN.md predate the three critical-
  flight sessions we've just shipped — SW-8's first task is to read the
  tracker + plan and pick the right next unit of work. Recommendation
  noted in the SW-8 brief.
- Per-wizard client files (`.../clients/<wizardKey>-client.tsx`) are the
  established pattern from SW-7 onwards. Any future admin wizard that
  lands in this route tree should add a new client file + dispatcher
  branch rather than re-branching a shared file.
- SW-7-b oauth hardening is logged in `PATCHES_OWED.md` and should be
  scheduled alongside Andy registering an Azure app.

## Notes

- The dispatcher's `Unknown wizard` fallback is deliberately prose-only
  — an unknown key reaching the route means the `getWizard()` call in
  the server component already short-circuited, so this branch is a
  belt-and-braces safety net rather than a user-facing path.
- `allowTestTokenInjection` is a single boolean passed through to the
  graph-admin client. Per-wizard clients that don't use it (stripe,
  resend) simply ignore the prop — no per-wizard prop gymnastics in the
  dispatcher.
- The oauth callback route's stub intentionally keeps the logged error
  on `console.warn` rather than going through the observability layer —
  the stub is short-lived (SW-7-b replaces it), and routing it through
  the structured logger would just create another file to change.
