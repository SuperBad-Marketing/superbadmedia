# SW-2 Handoff — Setup Wizards: 10 step-types + STEP_TYPE_REGISTRY

**Session:** SW-2 | **Date:** 2026-04-14 | **Model:** Sonnet 4.6 (`/normal` per brief)
**Wave:** 4 — Setup Wizards
**Type:** FEATURE
**Rollback:** feature-flag-gated. `setup_wizards_enabled` kill-switch short-circuits `<WizardShell>` to a maintenance placeholder. Revert = delete `components/lite/wizard-steps/` + revert shell registry wire-up + drop migration 0009 (3 settings-key seeds). No schema changes.

---

## What was built

All SW-2 acceptance criteria met. The 10-step-type library now plugs into `<WizardShell>` via a string-keyed `STEP_TYPE_REGISTRY` map; SW-3 can start wiring `verify()` / `registerIntegration()` onto the celebration step.

### New files

| File | Purpose |
|---|---|
| `lib/wizards/step-types.ts` | `StepTypeDefinition<TState>` contract + `StepComponentProps<TState>` + `invalid()` helper. Framework-agnostic except for a type-level `React.ComponentType` reference. |
| `components/lite/wizard-steps/form-step.tsx` | `form` step-type. Generic field render from a zod schema shape; on-submit safeParse errors surface inline. |
| `components/lite/wizard-steps/oauth-consent-step.tsx` | `oauth-consent` step-type. Uses a plain `<a>` (not `<Button asChild>`; that prop isn't on the UI Button). Token arrival flips state.token → enables Continue. |
| `components/lite/wizard-steps/api-key-paste-step.tsx` | `api-key-paste` step-type. `testCall` config runs the verification, masked-on-save shows `••••{last4}`. |
| `components/lite/wizard-steps/webhook-probe-step.tsx` | `webhook-probe` step-type. `houseSpring` pulse, polls `checkReceived` every 2s, times out at `wizards.webhook_probe_timeout_ms` (consumer-injected — no literal in this file). |
| `components/lite/wizard-steps/dns-verify-step.tsx` | `dns-verify` step-type. Lists expected records, polls resolver at `wizards.dns_verify_poll_interval_ms` (consumer-injected). |
| `components/lite/wizard-steps/csv-import-step.tsx` | `csv-import` step-type. Upload → preview → column-map → confirm. Resumable at preview stage per spec §4. |
| `components/lite/wizard-steps/async-check-step.tsx` | `async-check` step-type. Polls consumer's `pollStatus()` until `done`/`failed` or `wizards.async_check_timeout_ms`. |
| `components/lite/wizard-steps/content-picker-step.tsx` | `content-picker` step-type. Fetcher-backed grid or list. Shape-shuffler primitive for Brand DNA / Intro Funnel. |
| `components/lite/wizard-steps/review-confirm-step.tsx` | `review-and-confirm` step-type. Read-only summary dl + single confirm CTA. |
| `components/lite/wizard-steps/celebration-step.tsx` | `celebration` step-type. Reads `tier2["wizard-complete"]` directly — A4's choreography source is SSOT. Reduced-motion parity inherits from `MotionProvider`. |
| `components/lite/wizard-steps/custom-step.tsx` | Escape hatch. Consumer supplies `render(props)` + optional `validate`. |
| `components/lite/wizard-steps/index.ts` | Barrel + `STEP_TYPE_REGISTRY` map (11 entries incl. `custom`). |
| `lib/db/migrations/0009_sw2_wizard_step_timeouts.sql` | Seeds `wizards.dns_verify_poll_interval_ms`, `wizards.async_check_timeout_ms`, `wizards.webhook_probe_timeout_ms`. Journal idx 9. |
| `tests/wizard-steps-form.test.ts` | 5 tests — resume defaults, round-trip, validate happy/malformed, contract shape. |
| `tests/wizard-steps-api-key-paste.test.ts` | 5 tests — resume, masked round-trip, validate rejects un-tested, validate passes verified, contract shape. |
| `tests/wizard-steps-celebration.test.tsx` | 4 tests — registered in registry, consumes A4 `wizard-complete` slot, renders outro + summary + CTA + Tier-2 marker, validate always passes. |
| `tests/wizard-steps-review-confirm.test.ts` | 3 tests — resume, validate rejects unconfirmed, validate passes confirmed. |
| `tests/wizard-steps-resume.test.ts` | 3 tests — JSON-serialised round-trip for `form`, `api-key-paste`, `content-picker`. |
| `sessions/sw-4-brief.md` | Pre-compiled per G11.b. (SW-3 brief already pre-compiled by SW-1.) |

### Edited files

| File | Change |
|---|---|
| `lib/kill-switches.ts` | Added `setup_wizards_enabled` (ships `false` per convention; tests flip it). |
| `components/lite/wizard-shell.tsx` | Kill-switch short-circuit → maintenance placeholder when off. Optional `step` / `stepState` / `onStepStateChange` / `onNext` props render via `STEP_TYPE_REGISTRY`; `children` fallback preserves SW-1 chrome pattern. |
| `docs/settings-registry.md` | 3 new Wizards rows. Total 73 (was 70). |
| `lib/settings.ts` | Registry entries for the 3 new integer keys. |
| `lib/db/migrations/meta/_journal.json` | Journal idx 9 added. |
| `tests/wizard-shell.test.tsx` | `beforeAll` flips `setup_wizards_enabled = true`; `afterAll` resets. Necessary because the new kill-switch defaults off and SW-1 chrome tests predate it. Off-whitelist edit — rationale here; no PATCHES_OWED row because the edit is contemporaneous with the kill-switch introduction, not deferred debt. |

---

## Key decisions

- **Shell `step` prop vs `children` prop — kept both.** The brief said "wire `STEP_TYPE_REGISTRY` lookup" in the shell. Introducing a `step` prop that resolves through the registry is the cleanest path — but SW-1's shell tests (and any future chrome-only consumer) rely on `children`. Both paths coexist: `step` wins when provided, `children` is the fallback. No SW-1 tests broken.

- **`resumableByDefault` on `StepTypeDefinition`, not `resumable` on the definition itself.** Spec §4 names each step-type's default resumability (`no` for oauth-consent, webhook-probe, dns-verify; `yes` for the rest). The consuming `WizardStepDefinition` already has its own `resumable` field — the shell reads that. The default is metadata on the step-type for documentation + potential registry-level checks (SW-6's resume worker may use it).

- **Celebration step reads `tier2["wizard-complete"]` directly.** Alternative: take `entry` via props. Chose direct import because the choreography source is registry-canonical (A4 locks it); indirection would invite drift. Component stays dumb — no Framer wiring beyond `variants` + `transition` from the registered entry.

- **`oauth-consent` step dropped `<Button asChild>`.** The project's Button component doesn't accept `asChild`. Swapped to a styled `<a>` with the primary-button classes. This is a primitive — consumers wanting richer OAuth UX use the `custom` escape hatch.

- **Kill-switch ships `false` to match the convention.** Every other kill-switch in `lib/kill-switches.ts` ships disabled (`brand_dna_assessment_enabled`, etc.); enablement comes from Phase 6 launch. Wizards are user-triggered and don't autonomously spend money — but following the precedent keeps the safety-net semantics uniform. Tests flip the switch per the `brand-dna-card.test.ts` pattern.

- **Settings-registry delta shipped as its own migration (0009).** Three autonomy knobs needed for `dns-verify`, `async-check`, `webhook-probe`. Added to `docs/settings-registry.md` (Wizards section), `lib/settings.ts` registry, and a new forward-only seed migration. The existing `0001_seed_settings.sql` stays immutable; follows the same "later seed = new migration" pattern `0006_b3_legal` set.

- **Form step `validate` requires `values` to be a non-null object.** `typeof null === "object"` in JS — naive check passed malformed blobs. Added explicit null + Array.isArray guard. Branded error message: "Form state is missing values." (no stack).

- **Tests skip rendering the stateful step Components except where needed.** Only `celebration` renders via `react-dom/server` (because it needs the choreography data-attribute assertion). The rest test resume/validate pure functions — far cheaper, still covers the registry-level contract. UI-heavy step behaviour (csv parse, async polling, OAuth redirects) is tested when the consuming wizards ship in SW-5+.

---

## Verification gates

- **G0 kickoff:** Read sw-2-brief + last 2 handoffs (sw-1, bda-4) + spec §3/§4/§11 ✓. Model tier: Sonnet ✓.
- **G1 preflight:** 8/8 preconditions verified ✓.
- **G2 scope discipline:** All whitelisted files touched. One off-whitelist edit (`tests/wizard-shell.test.tsx`) — rationale in Key decisions. No other scope creep.
- **G3 context budget:** Comfortable single-session — celebration-split-point not triggered.
- **G4 settings-literal grep:** No autonomy literals in step-type files. DNS poll / webhook / async timeouts injected via consumer `config` from `settings.get()` at the wizard-definition site. Grep: no raw `10000`, `300000`, `600000` in `components/lite/wizard-steps/**`.
- **G5 motion:** Each step's state transitions use `houseSpring` (webhook-probe pulse explicit; others inherit via the MotionProvider default). Celebration consumes the registered `wizard-complete` Tier 2 slot — `data-choreography="wizard-complete"` attribute asserts that in test.
- **G6 rollback:** feature-flag-gated ✓. Migration 0009 is seed-only (INSERT OR IGNORE) — idempotent; revert = delete the file + journal row.
- **G7 artefacts:** All whitelisted files present ✓. Journal entry 9 verified.
- **G8 typecheck + tests + lint + build:** `npx tsc --noEmit` → 0 errors. `npm test` → 283/283 green (263 pre-SW-2 + 20 net new: 5 form, 5 api-key, 4 celebration, 3 review-confirm, 3 resume; settings test count-assertion bumped 70 → 73 to match 3 new seeds). `npm run lint` → clean. `npm run build` → clean.
- **G9 E2E:** Not a critical flow ✓. Wizard flows become critical when a consumer wizard ships (SW-5+).
- **G10 manual browser:** No new route surface. Step-types are primitives consumed by SW-4+ routes. Deferred to SW-5's G10 on first consumer wizard.
- **G11.b:** SW-4 brief pre-compiled ✓.
- **G12:** Tracker + commit — below.

---

## Migration state after SW-2

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
0009_sw2_wizard_step_timeouts    ← new (seed-only)
```

Next migration slot = 0010.

---

## PATCHES_OWED rows (SW-2 — new)

None. The `tests/wizard-shell.test.tsx` kill-switch flip is contemporaneous debt — not deferred — so no row is owed.

---

## Open threads for SW-3 (next session)

- **`STEP_TYPE_REGISTRY` is string-keyed by `WizardStepType`.** SW-3's `registerIntegration()` will hook `verify()` → the celebration-step's `observatorySummary` slot. The celebration Component already reads `state.observatorySummary`; SW-3 supplies it.
- **`celebrationStep.validate` always passes.** Shell-level completion gating lives at `completionContract.verify()` (spec §3.3), not at the step-type boundary. SW-3's shell edit must call `verify()` before rendering celebration.
- **Kill-switch inheritance.** SW-3's `registerIntegration()` should no-op silently when `setup_wizards_enabled === false` — matches SW-2's shell short-circuit. Prevents writing `integration_connections` rows mid-maintenance.
- **Three new settings keys are live.** `wizards.dns_verify_poll_interval_ms` (10000), `wizards.async_check_timeout_ms` (600000), `wizards.webhook_probe_timeout_ms` (300000). SW-3 doesn't read these directly; consumer wizards (SW-5+) do.

---

## Autonomy loop note

SW-3 is next per tracker. SW-4 brief already pre-compiled. Rolling cadence (G11.b) holds.
