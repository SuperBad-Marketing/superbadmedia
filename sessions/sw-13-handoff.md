# SW-13 — Generic API-key wizard + dispatcher refactor — Handoff

**Closed:** 2026-04-14
**Brief:** `sessions/sw-13-brief.md`
**Model:** Opus (`/deep`) — per brief §1. First N-vendors-from-one-def pattern + dispatcher abstraction refactor warranted the tier.
**Type:** FEATURE
**Rollback:** feature-flag-gated via `setup_wizards_enabled`. Revert = delete new files + revert barrel + revert dispatcher to prior if-chain (kept in git for easy restore) + revert `.env.example` block. No schema change. No migration. No settings keys touched. No new callback route (none of the four vendors use OAuth).

## What shipped

- **Four vendor manifests** — `lib/integrations/vendors/openai.ts`, `anthropic.ts`, `serpapi.ts`, `remotion.ts`. Each exports a `VendorManifest` with its own `vendorKey`, one-or-two Observatory bands sized by vendor semantics (LLM p95s larger than OAuth identity pings; Remotion renders p95 30s), `actorConvention: "internal"`, `killSwitchKey: "setup_wizards_enabled"`. OpenAI/Anthropic/SerpAPI also export their API base URL (design-time constant). Anthropic additionally exports `ANTHROPIC_VERSION_HEADER="2023-06-01"`.
- **`lib/wizards/defs/api-key.ts`** — single `WizardDefinition<ApiKeyPayload>` composing `api-key-paste → review-and-confirm → celebration`. First wizard def with **N-vendors-from-one-module** pattern. Exports:
  - `ApiKeyVendor` union (`"openai" | "anthropic" | "serpapi" | "remotion"`).
  - `API_KEY_VENDOR_PROFILES: Record<ApiKeyVendor, ApiKeyVendorProfile>` — each profile carries `label`, `manifest`, and `verify(key)`.
  - `isApiKeyVendor(v)` type guard + `getApiKeyVendorProfile(v)` helper.
  - `apiKeyWizard` with `vendorManifest: undefined` (per-vendor manifest selected at completion time from `payload.vendor`; see Decisions).
  - `completionContract.required = ["vendor", "apiKey", "verifiedAt", "confirmedAt"]`; `verify` dispatches on `payload.vendor` → profile.verify.
- **Live verify-pings** — OpenAI `GET /v1/models` bearer; Anthropic `GET /v1/models` with `x-api-key` + `anthropic-version`; SerpAPI `GET /account?api_key=…`; **Remotion format-only check** (length ≥ 20 — no hosted endpoint exists for Remotion commercial licence keys). Remotion's lack of live verify is documented in its manifest `humanDescription` + in the def module.
- **`lib/wizards/defs/index.ts`** — barrel imports `./api-key`. Registry now carries **eight** wizards (stripe-admin, resend, graph-api-admin, pixieset-admin, meta-ads, google-ads, twilio, api-key).
- **`app/lite/setup/admin/[key]/page.tsx`** — **dispatcher refactor (Option A, per brief §4)**. Replaced the if/else-if chain (4 branches) with `CLIENT_MAP: Record<string, ClientRenderer>`. Each renderer is a function `(args: { common, allowTestTokenInjection, searchParams }) => ReactNode`; per-wizard extras (authorize URLs, vendor profiles) land inside the renderer. Adding a new wizard = add one row. Kept `buildMetaAuthorizeUrl()` / `buildGoogleAuthorizeUrl()` as local helpers (unchanged). Page now accepts `searchParams: Promise<...>` (Next.js 15/16 convention) — awaited once up front.
- **`app/lite/setup/admin/[key]/clients/api-key-client.tsx`** — per-wizard client. Vendor-agnostic — receives `vendor` + `vendorLabel` as props (resolved server-side from `?vendor=`). Configures the `api-key-paste` step's `testCall` to route through `testApiKeyAction(vendor, key)`; review summary shows vendor label + masked key suffix; `onComplete` constructs an `ApiKeyPayload` with `vendor` baked in. Uses `useAdminShell` (no new hook).
- **`app/lite/setup/admin/[key]/actions-api-key.ts`** — two Server Actions:
  - `testApiKeyAction(vendor, key)` — validates vendor, dispatches to the profile's live verify.
  - `completeApiKeyAction(payload)` — validates `payload.vendor`, resolves the per-vendor manifest, then the standard `registerIntegration → verifyCompletion → wizard_completions insert` flow. **Each vendor writes its own `integration_connections` row keyed on its own `vendor_key`** (not a shared "api-key"). `metadata.vendor` + `metadata.verified_at_ms` stored in plaintext alongside the vault-encrypted credential.
- **`tests/api-key-wizard.test.ts`** — 9 unit tests: step composition, completion contract shape with `vendor` as required key, vendorManifest intentionally undefined, audience/render/capstone shape, **barrel registration asserts 8 wizards**, per-vendor profile/manifest wiring, `isApiKeyVendor` type guard coverage, Remotion format-only verify (rejects short, accepts long), unknown-vendor rejection on the wizard's verify dispatch, live OpenAI rejection with a bogus key.
- **`tests/e2e/admin-api-key-openai.spec.ts`** — optional Playwright smoke. `test.skip()` when `OPENAI_TEST_KEY` unset. Walks `/lite/setup/admin/api-key?vendor=openai` → paste → test-key (live ping) → masked-suffix → continue → review → celebration → asserts `wizard_completions.wizard_key = "api-key"` **and** `integration_connections.vendor_key = "openai"`. First E2E to assert the wizard-key / vendor-key divergence.
- **`.env.example`** — new block before the existing `ANTHROPIC_API_KEY` line documenting the four new `*_TEST_KEY` vars (OPENAI / ANTHROPIC / SERPAPI / REMOTION). Explicit callout that app code never reads these — they're scoped to the E2E harness. `ANTHROPIC_API_KEY` left alone (it's the direct-SDK key used by `lib/ai/models.ts` and the kill-switch layer; the wizard-stored Anthropic credential is vault-encrypted in `integration_connections`).

## Decisions

- **Option A (CLIENT_MAP) picked over Option B.** Brief §4 guidance: pick A unless B is obviously less code. B would have required collapsing every per-wizard client's prop surface through a shared `AdminWizardClientProps` contract and pushing authorize-URL computation into each client. That's more surgery (4 clients touched) for the same readability win. Option A is ~10 lines per map row, exactly matches the old if-chain in complexity, but is extensible — new wizards add one row, no chain growth. Dispatcher no longer has a per-wizard if-chain ✓ (DoD).
- **`apiKeyWizard.vendorManifest = undefined`.** The existing wizard shape binds one manifest to one def. For N-vendors-from-one-def, the runtime selects the manifest from `payload.vendor` at completion time (in `actions-api-key.ts`). Tried the alternative — "pick a 'primary' vendor manifest and swap at call time" — but that muddies the completion path (verifyCompletion reads `wizard.vendorManifest` conceptually; keeping it undefined forces every code path that needs a vendor manifest to resolve it explicitly from `payload.vendor`, which is the correct semantics here).
- **Separate `integration_connections` rows per vendor; single `wizard_completions` row per completion.** `wizard_key` stays `"api-key"` (one wizard, one completion record); `vendor_key` on the connection row carries `"openai"` / `"anthropic"` / `"serpapi"` / `"remotion"`. Consumer feature sessions (the ones that actually send OpenAI requests) look up credentials by `vendor_key`, which is the natural key for "give me the OpenAI token", not by wizard_key. Brief §3 explicitly called this divergence out; implemented as specified.
- **Registry stays single-entry `"api-key"`.** Considered registering 4 per-vendor keys (`"api-key:openai"` etc.) but that would either (a) require URL `[key]` to equal `api-key:openai` (colon-in-URL friction) or (b) need a parallel `(vendorKey) => wizardKey` lookup the dispatcher threads through. Single entry + URL `?vendor=` is simpler and matches brief §3 verbatim. Barrel test asserts 8 wizards (not 11).
- **Vendor validation at the dispatcher AND the action.** `/lite/setup/admin/api-key` without a valid `?vendor=` param → `notFound()` (spec §3 requirement). Action also re-validates defensively (never trust the client). Redundant but correct.
- **Anthropic verify ping uses `/v1/models`, not `/v1/messages`.** `/v1/messages` would require a valid completion request body (token cost + more surface area). Anthropic's `/v1/models` is a plain list behind the same `x-api-key` auth. Proves the key works for identity without burning tokens.
- **Remotion verify is format-only.** No hosted API; licence keys are local-validation only per Remotion's commercial terms. Format check = non-empty + length ≥ 20 chars (covers their UUID-ish key shape). Documented in the manifest `humanDescription` and in `api-key.ts`'s `checkRemotion` comment. **Not** owed as a PATCHES_OWED row — there is nothing to harden later; the spec §5.1 last row specifies "API key paste → test call → band registered" with no live-verify requirement, and for Remotion the "test call" is format validation.
- **`ANTHROPIC_TEST_KEY` ≠ `ANTHROPIC_API_KEY`.** The existing `ANTHROPIC_API_KEY` env var is read directly by `lib/ai/models.ts` + kill-switches for server-side LLM feature calls. The wizard path stores credentials vault-encrypted in `integration_connections`; the `_TEST_KEY` vars are E2E-only. Same pattern as `RESEND_API_KEY` vs `RESEND_TEST_KEY`. No collision.
- **PATCHES_OWED: none opened.** No callback route (no oauth). No settings keys introduced. No cross-spec flag raised. Dispatcher refactor closes the four-session deferral from SW-9/10/11/12; no residual owed.

## Files touched

| File | Change |
| --- | --- |
| `lib/integrations/vendors/openai.ts` | NEW |
| `lib/integrations/vendors/anthropic.ts` | NEW |
| `lib/integrations/vendors/serpapi.ts` | NEW |
| `lib/integrations/vendors/remotion.ts` | NEW |
| `lib/wizards/defs/api-key.ts` | NEW |
| `lib/wizards/defs/index.ts` | Add `./api-key` import |
| `app/lite/setup/admin/[key]/page.tsx` | **Dispatcher refactor to CLIENT_MAP** + api-key row + `searchParams` awaited |
| `app/lite/setup/admin/[key]/clients/api-key-client.tsx` | NEW |
| `app/lite/setup/admin/[key]/actions-api-key.ts` | NEW |
| `tests/api-key-wizard.test.ts` | NEW (9 tests) |
| `tests/e2e/admin-api-key-openai.spec.ts` | NEW (skip-gated) |
| `.env.example` | New block (OPENAI_TEST_KEY, ANTHROPIC_TEST_KEY, SERPAPI_TEST_KEY, REMOTION_TEST_KEY) |
| `sessions/sw-13-handoff.md` | NEW (this file) |
| `SESSION_TRACKER.md` | Next Action → Wave 5 kickoff (SP-1) |

No migration. No settings keys touched. No schema change. No new callback route.

## Verification

- `npx tsc --noEmit` — zero errors
- `npm test` — **371/371 green** (362 prior + 9 new from `api-key-wizard.test.ts`)
- `npm run lint` — clean
- `npm run build` — clean; no new route in the manifest (api-key lives under the shared `/lite/setup/admin/[key]`; no oauth callback).
- `npm run test:e2e` — **7 skipped** (prior 6 + new admin-api-key-openai). Skip intentional; spec runs the instant `OPENAI_TEST_KEY` is exported.

## G0–G12 walkthrough

- **G0 kickoff** — brief read; SW-12 + SW-11 handoffs read; twilio + resend defs + admin page read as primary sources; api-key-paste step read; `registerIntegration` shape confirmed; Opus tier per brief.
- **G1 preflight** — 4/4 preconditions verified: SW-12 handoff present, defs barrel imports `twilio`, admin dispatcher has twilio branch, `api-key-paste` step-type exists in `components/lite/wizard-steps/`. Plus: `WizardVoiceTreatment.outroCopy` accepts `string | (ctx) => string` (used generic string form).
- **G2 scope discipline** — every file in brief §5 whitelist touched; nothing else.
- **G3 context budget** — comfortable single-session. No split required.
- **G4 literal-grep** — no autonomy thresholds introduced. Band nominals (`{p95, p99}` per vendor) are manifest defaults, not runtime-tunable autonomy rules. API base URLs + `ANTHROPIC_VERSION_HEADER="2023-06-01"` are vendor protocol constants. Remotion's length-≥-20 is a format check, not a tunable threshold.
- **G5 motion** — no motion changes. Celebration uses the existing Tier-2 `wizard-complete` choreography; the dispatcher refactor touches routing only.
- **G6 rollback** — feature-flag-gated via `setup_wizards_enabled`. Dispatcher rollback documented: prior if-chain is one `git revert` away.
- **G7 artefacts** — every file in the table present.
- **G8 typecheck + tests + lint + build** — all green (numbers above).
- **G9 E2E** — 7 skipped (6 prior + new api-key-openai).
- **G10 manual browser** — not run this session. api-key shares shell + step-types with resend (api-key-paste) and twilio (review/celebration); no new step types or shell code introduced. Dispatcher refactor is a pure routing change covered by the build + route manifest inspection.
- **G11.b** — Wave 4 closes with SW-13. Next session kickoff is **Wave 5 SP-1** (Sales Pipeline CRM spine). Brief pre-compilation deferred to kickoff — wave transitions benefit from a fresh scope read of BUILD_PLAN.md §Wave 5 rather than a cross-wave pre-write. Tracker points at "SP-1 — compile brief at session start from BUILD_PLAN.md SP-1 row + relevant specs".
- **G12** — tracker updated; commit next.

## PATCHES_OWED status

- **Closed this session:** none directly. Dispatcher abstraction deferral from SW-9/10/11/12 closed (not a PATCHES_OWED row — was logged as "reassess when generic API-key lands").
- **Opened this session:** none.
- **Still open (carried):**
  - `sw5_integration_rollback_on_insert_failure` — Observatory wave.
  - `sw7b_graph_oauth_callback_hardening` — pairs with Azure app registration.
  - `sw10b_meta_ads_oauth_callback_hardening` — pairs with Meta app registration.
  - `sw11b_google_ads_oauth_callback_hardening` — pairs with Google Cloud app registration.

## Open threads for Wave 5 kickoff / Wave-4 residue

- **Wave 4 is closed by SW-13.** Full §5.1 admin-wizard inventory shipped: Stripe / Resend / Graph-API (critical trio, SW-4–SW-6), plus Pixieset / Meta-Ads / Google-Ads / Twilio / generic-api-key (non-critical admin, SW-9–SW-13). Remaining §5 inventory is §5.2 (domain-verify deferred per memory; saas-product-setup owned by SaaS Billing spec; finance-tax-rates belongs inside admin-onboarding chain) and §5.3 (client-facing wizards, each owned by their feature wave).
- **OAuth callback hardening trio (SW-7-b / SW-10-b / SW-11-b)** — still owed, gated on Andy registering the three vendor apps (Azure / Meta / Google Cloud). Best batched into a single session after all three registrations land. Flag before Wave 5 only if timing is pressing.
- **Shared OAuth E2E harness** — still non-owed. First vendor app registration is the extraction pull. Three structurally-identical E2E specs (`admin-graph-api.spec.ts` / `admin-meta-ads.spec.ts` / `admin-google-ads.spec.ts`) will collapse to `runOAuthWizardE2E({...})` when the first one un-skips.
- **`/lite/integrations` hub page** — still unshipped; spec §8.4 implies it exists (lazy-surfacing of non-critical admin wizards needs a landing surface). Not a Wave 4 blocker but needed before any subscriber-facing feature routes users into these wizards. Flag as a Wave-4-closure gap for BUILD_PLAN review.
- **`wizard_progress` writer** — unlanded through all of Wave 4. No wizard yet needs mid-flow persistence (all admin wizards are single-round-trip or single-paste). First feature session that wants resumable mid-flow state (likely CSV import or content-picker) lands the writer + wires `scheduleWizardNudges()` / `cancelWizardNudges()`.
- **LLM model registry contact point.** OpenAI + Anthropic credentials now flow into `integration_connections`. The model registry at `lib/ai/models.ts` still owns model-ID selection and reads `process.env.*_API_KEY` directly for now. The migration from env-var keys to vault-decrypted credential lookup is a feature-session concern (first LLM feature that rotates keys via the wizard). Not owed; flagged for future.
- **Next session: SP-1 (Wave 5 kickoff).** Sales Pipeline CRM spine — schema for `companies` / `contacts` / `deals`, `createDealFromLead()` with contact dedupe, 166-value `activity_log.kind` enum final state. Compile brief at kickoff from `BUILD_PLAN.md` §Wave 5 row SP-1 + `docs/specs/sales-pipeline.md`. Model tier: Opus (INFRA session, foundational; schema + helper ownership warrants `/deep`).

## Notes

- **First wizard def with N-vendors-from-one-module.** Pattern is cheap to extend — adding a fifth vendor profile is a new manifest + a new row in `API_KEY_VENDOR_PROFILES`. The client + action + dispatcher branch all stay untouched.
- **Dispatcher CLIENT_MAP shape is extensible to future non-api-key wizards too.** The renderer args (`common`, `allowTestTokenInjection`, `searchParams`) cover every current admin wizard's needs. Wizards that want custom shape just read from `searchParams` or ignore the extras they don't need.
- **No humanised form-step labels concern on this wizard** — api-key-paste renders its own masked suffix and a single Input; no Zod-shape fields like Twilio's `accountSid`/`authToken`.
- **Remotion is the only non-live-verify vendor in the generic wizard.** Worth a note in any future Observatory alerting work: Remotion's `remotion.render` band won't see a live sample until the first actual render ships. Can't be "stuck on stale bands" — there are no bands to stale until render traffic lands.
