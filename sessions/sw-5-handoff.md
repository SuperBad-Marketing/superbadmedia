# SW-5 Handoff — First consumer wizard: `stripe-admin` slice

**Session:** SW-5 | **Date:** 2026-04-14 | **Model:** Sonnet 4.6 (`/normal` per brief)
**Wave:** 4 — Setup Wizards
**Type:** FEATURE
**Rollback:** feature-flag-gated. `setup_wizards_enabled` (SW-2's kill-switch) —
when off, `registerIntegration()` throws (SW-3 contract), WizardShell renders
the maintenance state, and `hasCompletedCriticalFlight` short-circuits to true
(SW-4). Revert = delete new files; `registerWizard()` is idempotent because the
module only loads when its route renders. No schema, no migration.

---

## What was built

All SW-5 (stripe-admin slice) acceptance criteria met **except mandatory E2E**,
which split to SW-5b per brief §10. Wizard definition + dedicated route + server
action orchestrator ship in this session.

### New files

| File | Purpose |
|---|---|
| `lib/wizards/defs/stripe-admin.ts` | `stripeAdminWizard: WizardDefinition<StripeAdminPayload>` composing SW-2 step-types (api-key-paste → webhook-probe → review-and-confirm → celebration). `completionContract.verify` = live `Stripe.balance.retrieve` ping. `artefacts.integrationConnections: true`. `vendorManifest = stripeManifest` (SW-3). `voiceTreatment.capstone = undefined` (critical-flight capstone lives at `/lite/first-run` per SW-4, not per-wizard). Registers on module import. |
| `app/lite/setup/critical-flight/[key]/page.tsx` | Server Component. `auth()` guard → `redirect("/lite/login")`. `getWizard(key)` lookup → `notFound()` on unknown. Reads `wizards.expiry_days` + `wizards.webhook_probe_timeout_ms` from settings. Side-effect imports `stripe-admin` to guarantee registration. |
| `app/lite/setup/critical-flight/[key]/critical-flight-client.tsx` | Client driver. Tracks step index + accumulates per-step state. Branches by step.type to wire Server-Action step configs (testCall for api-key-paste, checkReceived for webhook-probe, onComplete for celebration). Review summary synced via useEffect on step change. |
| `app/lite/setup/critical-flight/[key]/actions.ts` | Three Server Actions. `testStripeKeyAction(key)` delegates to definition's `contract.verify`. `checkStripeWebhookReceivedAction(sinceMs)` polls `external_call_log` for `job = stripe.webhook.receive` since step start (emitter is SW-5b debt). `completeStripeAdminAction(payload)` runs `registerIntegration → verifyCompletion → wizard_completions insert → unstable_update()` with rollback on any failure. |
| `tests/stripe-admin-wizard.test.ts` | 5 tests — step composition, vendor manifest wiring + contract artefact, dedicated-route + no per-wizard capstone, registry membership, verify-rejects-bad-key (real Stripe network ping). |
| `tests/critical-flight-route.test.tsx` | 2 tests — getWizard resolves after def module loads, returns undefined for unknown keys (route maps → `notFound()`). |
| `sessions/sw-5-handoff.md` | This file. |
| `sessions/sw-5b-brief.md` | Pre-compiled per G11.b. Ships webhook receiver + E2E smoke + second wizard. |

### Edited files

| File | Change |
|---|---|
| `lib/auth/auth.ts` | Destructure `unstable_update` from `NextAuth({...})` so the completion Server Action can trigger a JWT refresh → flips `session.user.critical_flight_complete`. Off-whitelist but directly required by the brief's §3 acceptance criterion "flips session.user.critical_flight_complete on completion"; same rationale as SW-4's auth-triplet edits. |

---

## Key decisions

- **Capstone is omitted from the stripe-admin WizardDefinition.** The brief flagged this as an SW-5-scope decision. SW-4 already renders the critical-flight capstone at `/lite/first-run` *after* `hasCompletedCriticalFlight` clears — that's the arc-level capstone and it belongs at the route that knows the whole flight is over, not at the last wizard. If we instead hung the capstone off graph-api-admin (the final wizard), every re-run of graph-api-admin would trigger a "flight complete" ceremony that isn't. `capstone = undefined` on all three critical wizards; the capstone stays on the `/lite/first-run` route.

- **Route imports `stripe-admin` for the side-effect.** `registerWizard()` is module-scoped; if nothing ever imports the def, the registry stays empty and every critical-flight request 404s. SW-5 adds one import; SW-5b / SW-6 extend as they land. Clean long-term fix is a `lib/wizards/defs/index.ts` barrel that eagerly imports every def — flagged for the next session's brief writer but not worth doing speculatively for one def.

- **`webhook-probe.checkReceived` queries `external_call_log`, not a new activity kind.** The spec §5.1 names "webhook endpoint registered + test webhook received" for the stripe-admin contract. No stripe webhook receiver exists yet, so `checkReceived` currently polls `external_call_log` for `job = "stripe.webhook.receive"` (one of stripeManifest's declared jobs). SW-5b owns the receiver and the `logExternalCall` emission that actually unblocks the step. Until then, a real admin can't complete the wizard — documented below under Open threads / PATCHES_OWED. Using `external_call_log` (rather than adding a new `ActivityLogKind`) keeps this session schema-neutral.

- **`webhook-probe` does not wire a kill-switch fallback.** SW-2's step types already respect `setup_wizards_enabled` via the WizardShell short-circuit. No additional gating needed.

- **Completion orchestrator order: registerIntegration → verifyCompletion → wizard_completions insert → unstable_update.** SW-3's `onComplete` pattern hint was `verify → register → insert`. Swapped `register` to run *before* verify because `contract.artefacts.integrationConnections = true` requires the row to already exist — running verify first would always fail the artefact check. Failure anywhere in the chain means no `wizard_completions` row is written, which is the rollback contract SW-3 specified (partial rows are forbidden). Registration then strands an `integration_connections` row on failure — the row is `status = "active"`, and SW-3's `registerIntegration` has no rollback API. This is a known gap; retake idempotency is tracked as an existing PATCHES_OWED item (`connected_via_wizard_completion_id` is not FK-constrained precisely to allow rewrites).

- **Split before E2E (brief §10 split-point).** Definition + route + actions + unit tests land clean; Playwright E2E smoke requires a working webhook receiver to exercise the full arc realistically, and the receiver isn't in this session's whitelist. Shipping the happy-path infrastructure now and running E2E in SW-5b is the cleaner line — the kill-switch makes this safe (the route is reachable but harmless if disabled).

- **Module-load registration in tests.** `tests/stripe-admin-wizard.test.ts` and `tests/critical-flight-route.test.tsx` both dynamically `await import("@/lib/wizards/defs/stripe-admin")` after setting `CREDENTIAL_VAULT_KEY`, following the register-integration test pattern.

- **Dropped `server-only` import.** The initial definition file declared `import "server-only"` but the package isn't installed in this project. Removed rather than adding a new dependency; the file is still effectively server-only because it imports the Stripe SDK (which would fail in a browser bundle). WizardDefinition modules import via the Server Component route; the client driver only imports the `StripeAdminPayload` type + action handles.

---

## Verification gates

- **G0 kickoff:** Brief read; last 2 handoffs (sw-4, sw-3) read; spec §5.1 + §8.1 read ✓. Sonnet model tier ✓.
- **G1 preflight:** 8/8 preconditions verified (sw-4 handoff, nextCriticalWizardKey, /lite/first-run route, STEP_TYPE_REGISTRY, registerIntegration, stripeManifest, verifyCompletion, stripe SDK).
- **G2 scope discipline:** All 6 whitelisted files touched. One off-whitelist edit (`lib/auth/auth.ts` — one-line destructure addition) — rationale above. No other scope creep.
- **G3 context budget:** Comfortable single-session. Split at §10 boundary is architectural (E2E needs receiver), not context pressure.
- **G4 literal-grep:** No Stripe price / balance threshold literals. `apiVersion: "2026-03-25.dahlia"` mirrors `lib/stripe/client.ts`'s pinned version — Stripe SDK contract string, not an autonomy threshold. Webhook probe timeout read via `settings.get("wizards.webhook_probe_timeout_ms")`. `contractVersion()` digests the required-key array — no hardcoded version. No hardcoded wizard ordering (critical flight order stays in `settings`).
- **G5 motion:** Celebration step reuses A4's Tier-2 `wizard-complete` slot (inherited from SW-2). No new motion slots.
- **G6 rollback:** feature-flag-gated on `setup_wizards_enabled` ✓. No schema, no migration, no seed.
- **G7 artefacts:** All whitelisted + off-whitelist files present ✓. `npm run build` shows `/lite/setup/critical-flight/[key]` in the route manifest ✓.
- **G8 typecheck + tests + lint + build:** `npx tsc --noEmit` → 0 errors. `npm test` → 315/315 green (308 pre-SW-5 + 7 net new: 5 stripe-admin-wizard, 2 critical-flight-route). `npm run lint` → clean. `npm run build` → clean.
- **G9 E2E:** Split to SW-5b per brief §10 split-point. Requires Stripe webhook receiver (not in SW-5 whitelist) to exercise realistically.
- **G10 manual browser:** Build shows the route resolves. End-to-end behaviour (sign-in → wizard → capstone) deferred to SW-5b once webhook receiver lands.
- **G11.b:** SW-5b brief pre-compiled ✓.
- **G12:** Tracker + commit — below.

---

## Migration state after SW-5

Unchanged from SW-4 — SW-5 is code-only.

```
0000_init.sql
0001_seed_settings.sql
0002_a6_activity_scheduled_inbox
0003_a7_email_stripe_pdf
0004_a8_portal_auth
0005_b1_support
0006_b3_legal
0007_bda1_brand_dna
0008_sw1_wizards
0009_sw2_wizard_step_timeouts
0010_sw3_verify_timeout
```

Next migration slot = 0011.

---

## PATCHES_OWED rows (SW-5 — new)

- **`sw5_stripe_webhook_receiver_owed`** — `/api/stripe/webhook` endpoint + signing-secret verify + `logExternalCall({ job: "stripe.webhook.receive", ... })` emission. Currently the wizard's webhook-probe step cannot complete because nothing writes the expected `external_call_log` row. Target: SW-5b. Raised: SW-5. Raised when: 2026-04-14.
- **`sw5_wizard_defs_barrel_owed`** — `lib/wizards/defs/index.ts` barrel so routes + tests can trigger every registration via one import rather than per-file side-effect imports. Low priority; worth a single line at the start of SW-5b or SW-6. Raised: SW-5.
- **`sw5_integration_rollback_on_insert_failure`** — if `registerIntegration` succeeds but `wizard_completions` insert fails, the orphan `integration_connections` row stays `active`. Retake flow should detect and update in place rather than insert a second active row; decide during Observatory-facing work. Raised: SW-5.

---

## Open threads for SW-5b (next session)

- **Stripe webhook receiver.** `/api/stripe/webhook` route — verifies signing secret from env, `logExternalCall({ job: "stripe.webhook.receive", estimated_cost_aud: 0, ... })`, returns 200. This unblocks the webhook-probe step. Include a "send test webhook" affordance in the step if Stripe CLI is expected.
- **Playwright E2E smoke (mandatory for the critical-flight flow).** sign-in → brand-dna-gate-clear → /lite/first-run → redirect → stripe wizard → paste test key → trigger webhook → review → celebrate → capstone on /lite/first-run → cockpit. Uses Stripe test key + fixture webhook. This is the G9 gate for the arc.
- **Next consumer wizard: Resend.** Same shape, different vendor (api-key-paste + review-and-confirm + celebration; no webhook-probe since Resend status is email-delivery-receipt, not inbound). Scope decision in SW-5b vs SW-6 — brief writer decides.
- **Wizard defs barrel** per PATCHES_OWED above.

---

## Autonomy loop note

SW-5b is next per tracker. SW-5b brief pre-compiled. Rolling cadence (G11.b) holds.
