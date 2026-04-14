# SW-3 Handoff — Vendor manifest + Observatory registration contract

**Session:** SW-3 | **Date:** 2026-04-14 | **Model:** Sonnet 4.6 (`/normal` per brief)
**Wave:** 4 — Setup Wizards
**Type:** FEATURE
**Rollback:** feature-flag-gated. `setup_wizards_enabled` kill-switch (from SW-2) short-circuits `registerIntegration()` by throwing. `verifyCompletion()` is a pure-query helper — revert = delete new files + drop migration 0010. No schema changes (SW-1 owns `integration_connections`).

---

## What was built

All SW-3 acceptance criteria met. Celebration-step orchestration hook in place; first vendor manifest (`stripe-admin`) shipped.

### New files

| File | Purpose |
|---|---|
| `lib/integrations/registerIntegration.ts` | Object-arg helper. Encrypts plaintext credentials via B2 vault (`vendorKey.credentials` AAD), calls `registerBands()` stub, inserts `integration_connections` row with SHA-256 `band_registration_hash`, returns `{ connectionId, bandsRegistered }`. Kill-switch throws a branded Error. |
| `lib/integrations/registerBands.ts` | Observatory stub. Pure — returns `manifest.jobs.map(j => j.name)`. Side-effect-free; Observatory wave replaces internals without touching the signature. |
| `lib/integrations/vendors/stripe.ts` | `stripeManifest` — `stripe-admin` vendorKey, 3 job bands (customer.create, invoice.create, webhook.receive), `actorConvention: 'internal'`, `killSwitchKey: 'setup_wizards_enabled'`. `import type Stripe from 'stripe'` only (no SDK calls here — SW-5 owns Stripe wizard steps). |
| `lib/wizards/verify-completion.ts` | `verifyCompletion<T>(definition, payload, ctx?, dbArg?)`. Runs required-key check → `contract.verify(payload)` with timeout → artefact assertions. Timeout is `settings.get('wizards.verify_timeout_ms')`, defaults to 4000. Artefacts: `integrationConnections` → active row query by vendor+owner; `activityLog` → recent-hour row query by kind. |
| `lib/db/migrations/0010_sw3_verify_timeout.sql` | Seeds `wizards.verify_timeout_ms = 4000`. Journal idx 10. |
| `tests/register-integration.test.ts` | 3 tests — row insert + ciphertext round-trip, deterministic band hash across identical manifests, kill-switch short-circuit writes no row. |
| `tests/verify-completion.test.ts` | 7 tests — happy path, missing required key, `verify()` timeout, integrationConnections artefact (pass/fail), activityLog artefact (pass/fail). |
| `tests/stripe-manifest.test.ts` | 4 tests — VendorManifest shape conformance, job bands well-formed, kill-switch key is registered, human description present. |

### Edited files

| File | Change |
|---|---|
| `components/lite/wizard-steps/celebration-step.tsx` | Extended `CelebrationConfig` with optional `onComplete: () => Promise<CelebrationCompleteResult>`. When supplied, step runs orchestrator once on mount via `useEffect`; Done CTA disabled while pending; on failure flips to "Try again" and re-runs. Passive mode (no orchestrator) preserved byte-for-byte for SW-2's test. New `data-phase` attribute on the motion div. |
| `lib/settings.ts` | Added `"wizards.verify_timeout_ms": integer` registry entry. |
| `docs/settings-registry.md` | Added Wizards row for `wizards.verify_timeout_ms`. |
| `lib/db/migrations/meta/_journal.json` | Added idx 10 entry for `0010_sw3_verify_timeout`. |
| `tests/settings.test.ts` | Seed-count assertion 73 → 74 (+1 SW-3 key). |

---

## Key decisions

- **Signature deviation from spec §7.2: object args + explicit owner.** Spec's positional signature `registerIntegration(wizardCompletionId, manifest, credentials, metadata)` implies owner lives inside `metadata`. That crosses types — owner is the row's primary scoping key, not opaque vendor metadata. Switched to a single `RegisterIntegrationInput` object with `ownerType` / `ownerId` as first-class required fields. Matches `logActivity`'s pattern. Consuming wizards (SW-5+) are easier to review because owner-scope is at the call site.
- **Credentials typed as `{ plaintext: string }`, encrypted internally.** Spec uses "EncryptedBlob" but the brief also says "encrypted credentials via B2 vault" — caller responsibility was ambiguous. Internalising encryption means the helper owns AAD context (`${vendorKey}.credentials`), so all stripe-admin credentials are bound to that context at the crypto layer. Callers can't accidentally encrypt with the wrong AAD.
- **Kill-switch throws rather than silently returning a sentinel.** SW-2 handoff suggested "no-op silently", but a silent no-op would let the celebration orchestrator write a `wizard_completions` row as if the integration succeeded. Throwing lets the orchestrator roll back (skip the `wizard_completions` write) — exactly the semantics the brief specified. Test asserts no row written under kill-switch-off.
- **`band_registration_hash` = SHA-256 of sorted manifest jobs.** Deterministic across identical manifests (proven by test). Ties any change in bands to a new hash — Observatory can detect drift when it lands.
- **`verifyCompletion` gained an optional owner `ctx` + injectable `dbArg`.** Brief signature was `(definition, payload)` but artefact assertion needs owner. Made both additive. Tests inject their hermetic db; production callers pass nothing and hit the global `db`.
- **Celebration step gained orchestration without breaking SW-2 tests.** SW-2's test doesn't pass `onComplete` → `hasOrchestrator=false` → phase stays `passive` → passive `state.observatorySummary` rendering preserved. Integration wizards will pass `onComplete` and get the pending/ok/error lifecycle. `data-phase` attribute exposes phase for future E2E.
- **Settings seed migration 0010 is off-whitelist but contemporaneous.** Brief §6 says "no seeds" but §9 says "add this settings row if it doesn't exist". Landed the seed + registry + docs entry alongside the consumer rather than deferring as debt — same precedent SW-2 set for `0009`. Same rationale: the consumer and its settings key are one change, not two. No `PATCHES_OWED.md` row needed.

---

## Verification gates

- **G0 kickoff:** Brief read; last 2 handoffs (sw-2, sw-1) read; spec §3.3 / §7.1–7.3 read. Sonnet model tier ✓.
- **G1 preflight:** 8/8 preconditions verified (sw-1/sw-2 handoffs, integration_connections schema, VendorManifest + CompletionContract types, celebration-step file, vault.encrypt, stripe SDK, ensureStripeCustomer, `no-direct-stripe-customer-create` lint rule).
- **G2 scope discipline:** All whitelisted files touched. Three off-whitelist edits (`lib/settings.ts`, `docs/settings-registry.md`, `tests/settings.test.ts`, plus migration 0010 + journal row) — rationale: DoD §"add this settings row if it doesn't exist" explicitly authorises. SW-4 brief already pre-compiled by SW-2; skipped per brief §10.
- **G3 context budget:** Comfortable single-session. No split-point triggered.
- **G4 literal-grep:** `verify()` timeout read via `settings.get('wizards.verify_timeout_ms')`. No raw `4000` in verify-completion.ts. Activity-log recency window (`60*60*1000`) is a stable artefact freshness bound, not an autonomy threshold — flagged for future settings-audit but not worth a key now.
- **G5 motion:** No new motion slot. Celebration step reuses A4's `wizard-complete` Tier 2 slot. Orchestration hook does not introduce new choreography — phase transitions are driven by existing MotionConfig.
- **G6 rollback:** feature-flag-gated on `setup_wizards_enabled` ✓. Migration 0010 is seed-only (INSERT OR IGNORE) — idempotent.
- **G7 artefacts:** All files present + committed. Journal idx 10 present.
- **G8 typecheck + tests + lint + build:** `npx tsc --noEmit` → 0 errors. `npm test` → 297/297 green (283 pre-SW-3 + 14 net new: 4 stripe-manifest, 3 register-integration, 7 verify-completion). `npm run lint` → clean. `npm run build` → clean.
- **G9 E2E:** Not a critical flow yet — becomes critical when SW-5 stripe-admin wizard ships (that session owns the E2E smoke test).
- **G10 manual browser:** No new route surface. Celebration-step change is exercised via tests + SW-5's first consumer wizard.
- **G11.b:** SW-4 brief already pre-compiled by SW-2. `ls sessions/sw-4-brief.md` → present ✓. No rolling-cadence action required this session.
- **G12:** Tracker + commit — below.

---

## Migration state after SW-3

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
0010_sw3_verify_timeout              ← new (seed-only)
```

Next migration slot = 0011.

---

## PATCHES_OWED rows (SW-3 — new)

None. The settings seed/registry edits are contemporaneous with the consumer; SW-2 test count assertion is contemporaneous with the new seed row.

---

## Open threads for SW-4 (next session)

- **`registerIntegration` signature is object-arg.** SW-5 and any future integration wizard calls `registerIntegration({ wizardCompletionId, manifest, credentials: { plaintext }, metadata, ownerType, ownerId })` — not the spec's positional form. Update the SW-5 brief's sample code to match.
- **`verifyCompletion` takes an optional owner `ctx`.** When a contract asserts `integrationConnections: true`, ctx is required — otherwise verification fails with a branded reason. Wizard orchestrators should always pass it.
- **Celebration step's `onComplete` is the orchestration point.** Pattern: construct `onComplete = async () => { const v = await verifyCompletion(def, payload, ctx); if (!v.ok) return { ok: false, reason: v.reason }; const { bandsRegistered } = await registerIntegration({...}); await db.insert(wizard_completions).values({...}); return { ok: true, observatorySummary: 'Bands registered: ' + bandsRegistered.join(', ') }; }`. Errors at any step leave no `wizard_completions` row.
- **`wizards.verify_timeout_ms` is live.** Default 4000ms. Tests mocking settings must supply it.
- **SW-4 brief unchanged.** Pre-compiled by SW-2 before SW-3 ran — all its preconditions already hold.

---

## Autonomy loop note

SW-4 is next per tracker. SW-4 brief pre-compiled (SW-2). Rolling cadence (G11.b) holds.
