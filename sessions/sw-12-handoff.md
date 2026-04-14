# SW-12 — Twilio admin wizard — Handoff

**Closed:** 2026-04-14
**Brief:** `sessions/sw-12-brief.md`
**Model:** Opus (`/deep`) — user fired `let's go` on the default tier; brief was Sonnet-safe. Same drift-neutral pattern as SW-9/11. No impact.
**Type:** FEATURE
**Rollback:** feature-flag-gated via `setup_wizards_enabled`. Revert = delete new files + revert barrel + revert dispatcher branch + revert `.env.example` Twilio block. No schema change. No migration. No settings keys touched. No callback route (form-step, no oauth).

## What shipped

- **`lib/integrations/vendors/twilio.ts`** — fourth non-critical vendor manifest. `vendorKey="twilio"`, two bands (`twilio.account.read` p95 600 / p99 1800 ms, `twilio.message.send` p95 900 / p99 2400 ms) sized to meta-ads/google-ads. `actorConvention: "internal"`, `killSwitchKey: "setup_wizards_enabled"`. Exports `TWILIO_API_BASE="https://api.twilio.com/2010-04-01"` as the design-time REST base.
- **`lib/wizards/defs/twilio.ts`** — `WizardDefinition<TwilioPayload>` composing `form → review-and-confirm → celebration`. Structurally mirrors `pixieset-admin` (form-step arc) but the form carries **two fields**: `accountSid` (regex `^AC[a-f0-9]{32}$`) + `authToken` (regex `^[a-f0-9]{32}$`). `completionContract.verify` hits `GET ${TWILIO_API_BASE}/Accounts/<SID>.json` with HTTP Basic auth (`SID:authToken`, Base64-encoded) — Twilio's minimum authenticated check that also confirms the account SID exists + is reachable. Exports `twilioCredentialsSchema`, `maskTwilioSid()`, `maskTwilioToken()` for the client. Artefact gate `integrationConnections: true`. Capstone `undefined` (non-critical). Self-registers.
- **`lib/wizards/defs/index.ts`** — barrel now imports all seven wizards (stripe-admin, resend, graph-api-admin, pixieset-admin, meta-ads, google-ads, twilio).
- **`app/lite/setup/admin/[key]/page.tsx`** — dispatcher extended to a fourth branch. Twilio branch has no `authorizeUrl` / `allowTestTokenInjection` props (mirrors pixieset-admin). Dispatcher now has two distinct props shapes: pixieset + twilio (form-only, 4 props) and meta + google (oauth, 6 props). See Decisions on abstraction deferral — *still* not the right trigger.
- **`app/lite/setup/admin/[key]/clients/twilio-client.tsx`** — per-wizard client. Copied from `pixieset-admin-client.tsx` with two-field form state (`{ accountSid, authToken }`) and a two-row review summary using `maskTwilioSid` / `maskTwilioToken` so plaintext credentials never hit the review step.
- **`app/lite/setup/admin/[key]/actions-twilio.ts`** — single Server Action `completeTwilioAction(payload)`. `registerIntegration → verifyCompletion → wizard_completions insert`. **First wizard storing a multi-field credential** — SID + token JSON-stringified into `credentials.plaintext` (the vault column is typed `string`; see Decisions). `metadata.account_sid` stored in the clear alongside; `authToken` lives inside the encrypted blob only.
- **`tests/twilio-wizard.test.ts`** — 6 unit tests: step composition, manifest wiring, audience/render/capstone shape, barrel registration (asserts all seven wizards present), credential schema accept/reject across four cases plus mask-helper output, live `verify()` bad-credential rejection (hits api.twilio.com with zeroed creds; expects rejection). 15-second timeout on the live-ping case.
- **`tests/e2e/admin-twilio.spec.ts`** — optional Playwright smoke. `test.skip()` when either `TWILIO_TEST_SID` or `TWILIO_TEST_TOKEN` is unset. **First admin E2E with no `?testToken=` injection path** — types real credentials into the form step's two `Input` fields and lets the celebration orchestrator run the live Basic-auth ping.
- **`.env.example`** — new Twilio block between the Google Ads block and `ANTHROPIC_API_KEY`: `TWILIO_TEST_SID`, `TWILIO_TEST_TOKEN` (E2E only). Explicit callout that Twilio has no app-registration step so no CLIENT_ID/SECRET is owed — first non-critical wizard in three to not open a `swNb_*_oauth_callback_hardening` PATCHES_OWED row.

## Decisions

- **Dispatcher abstraction deferred, take four.** The dispatcher now has four branches across two distinct props shapes (form-only × 2, oauth × 2). Brief §4 flagged this as "the last sensible check before generic API-key." Reviewed and deferred: a `CLIENT_MAP: Record<WizardKey, (props) => ReactNode>` would need to either narrow props per-key (same verbosity as the chain) or cast through `unknown` (hides shape mismatches). The current chain is greppable, ~8-14 lines per branch, and stays readable until the first *dynamically selected* wizard lands (generic API-key with a vendor-picker prop — SW-13). **Real trigger: SW-13.** Logging as "reassess when generic API-key lands", not opening a PATCHES_OWED row.
- **Credential blob handoff: JSON.stringify at the action boundary.** `registerIntegration` credentials.plaintext is typed `string`. Rather than widening the vault signature for Twilio's single use-case, the action serialises `{ accountSid, authToken }` into a JSON string before handing off. Consumer feature sessions that send SMS read the row back and `JSON.parse` — documented in the manifest's `humanDescription`. The signature widening (if it ever happens) is a vault-session concern, not a wizard-session concern. Preflight G1 confirmed no change owed.
- **`metadata.account_sid` stored in plaintext.** Non-secret — the SID is visible in Twilio webhook payloads, logs, and API responses everywhere. Storing it in `integration_connections.metadata` (not inside the encrypted blob) makes the row queryable by SID without decryption. Auth Token stays inside the encrypted blob only.
- **Review summary uses masked values.** First admin wizard where the review step's displayed values are **not** the raw credential — `maskTwilioSid('ACaa…aaaa')` + `maskTwilioToken('…bbbb')`. The full creds are in component state; review is UI-only and masks to avoid shoulder-surfing leaks on the confirmation screen. Pixieset didn't need this (URL is public); Twilio is the first secret-paste wizard on the admin tree.
- **Form step handles two fields generically.** `components/lite/wizard-steps/form-step.tsx` already iterates `schema.shape` and renders one `<Input>` per field with `id={field-${key}}`. No form-step changes needed for Twilio; the two-field shape drops in cleanly. Field labels use the Zod key directly (`accountSid`, `authToken`) — matches the existing pixieset rendering (`url`). Humanising the labels is a form-step-wide concern, not a Twilio concern.
- **Live verify in the unit test.** `tests/twilio-wizard.test.ts` hits api.twilio.com with zeroed credentials and asserts rejection. Live network call in a unit test is unusual but matches `meta-ads-wizard.test.ts` and `google-ads-wizard.test.ts` — all three verify that the real vendor rejects bad creds. Failure mode if Twilio's API is down = the one test fails with a network error; acceptable given the pattern's three-session precedent.
- **No hardening PATCHES_OWED row.** Form-step wizards with direct-paste credentials have nothing to harden on a callback (no callback exists). The brief's guidance — "No PATCHES_OWED row opened (form-step wizards have no skeleton-hardening debt)" — stands.
- **Shared OAuth E2E harness still not owed.** Twilio is form-step, not oauth; irrelevant to the three oauth specs (graph / meta / google). Harness extraction pull is still whichever vendor app registers first.

## Files touched

| File | Change |
| --- | --- |
| `lib/integrations/vendors/twilio.ts` | NEW |
| `lib/wizards/defs/twilio.ts` | NEW |
| `lib/wizards/defs/index.ts` | Add `./twilio` import |
| `app/lite/setup/admin/[key]/page.tsx` | Extend dispatcher (twilio branch + import) |
| `app/lite/setup/admin/[key]/clients/twilio-client.tsx` | NEW |
| `app/lite/setup/admin/[key]/actions-twilio.ts` | NEW |
| `tests/twilio-wizard.test.ts` | NEW (6 tests) |
| `tests/e2e/admin-twilio.spec.ts` | NEW (skip-gated) |
| `.env.example` | Twilio block (TWILIO_TEST_SID, TWILIO_TEST_TOKEN + no-app-registration note) |
| `sessions/sw-12-handoff.md` | NEW (this file) |
| `sessions/sw-13-brief.md` | NEW (pre-compiled per G11.b) |
| `SESSION_TRACKER.md` | Next Action → SW-13 |

No migration. No settings keys touched. No schema change. No new route (no callback).

## Verification

- `npx tsc --noEmit` — zero errors
- `npm test` — **362/362 green** (356 prior + 6 new from `twilio-wizard.test.ts`)
- `npm run lint` — clean
- `npm run build` — clean; no new route (form-step wizard, no callback). Dispatcher still the only admin route in the manifest.
- `npm run test:e2e` — 6 skipped (prior 5 + new admin-twilio). Twilio skips on missing `TWILIO_TEST_SID` or `TWILIO_TEST_TOKEN`.

## G0–G12 walkthrough

- **G0 kickoff** — brief read; SW-11 + SW-10 handoffs read; pixieset-admin def + client + actions read as copy sources (form-step pattern); admin-tree page read; Sonnet tier in brief noted (actual model: Opus — drift-neutral).
- **G1 preflight** — 5/5 preconditions verified: SW-11 handoff present, defs barrel imports `google-ads`, admin dispatcher has google-ads branch, pixieset-admin client + actions exist, `registerIntegration` signature confirms `credentials.plaintext: string` — triggers the JSON.stringify decision.
- **G2 scope discipline** — every file in brief §4 whitelist touched; nothing else.
- **G3 context budget** — comfortable single-session.
- **G4 literal-grep** — no autonomy thresholds introduced. Regex constants (`^AC[a-f0-9]{32}$`, `^[a-f0-9]{32}$`) are vendor API format specs, not tunables. Bands `{p95:600,p99:1800}` / `{p95:900,p99:2400}` are manifest nominals, not autonomy-sensitive. `TWILIO_API_BASE` is a vendor URL constant.
- **G5 motion** — no motion changes. Celebration uses existing Tier-2 `wizard-complete` choreography.
- **G6 rollback** — feature-flag-gated via `setup_wizards_enabled`. No migration.
- **G7 artefacts** — every file in the table present.
- **G8 typecheck + tests + lint + build** — all green (numbers above).
- **G9 E2E** — 6 skipped. Twilio skip intentional; runs the instant both env vars are exported.
- **G10 manual browser** — not run this session. The form + review + celebration surfaces are structurally covered by pixieset-admin; Twilio introduces no new step types or shell code. Two-field form rendering is generic in `form-step.tsx` and already exercised by test assertions.
- **G11.b** — SW-13 brief pre-compiled.
- **G12** — tracker updated; commit next.

## PATCHES_OWED status

- **Closed this session:** none.
- **Opened this session:** none (form-step wizards have no callback-skeleton debt).
- **Still open (carried):**
  - `sw5_integration_rollback_on_insert_failure` — Observatory wave.
  - `sw7b_graph_oauth_callback_hardening` — pairs with Azure app registration.
  - `sw10b_meta_ads_oauth_callback_hardening` — pairs with Meta app registration.
  - `sw11b_google_ads_oauth_callback_hardening` — pairs with Google Cloud app registration.

## Open threads for SW-13

- **Generic API-key wizard.** Last non-critical admin wizard on the spec §5.1 inventory. Single parameterised `api-key-paste` WizardDefinition serving OpenAI / Anthropic / SerpAPI / Remotion. First wizard def to serve N vendors from one module — introduces a vendor-picker prop that's the first *dynamically selected* shape on the admin dispatcher. **This is the abstraction trigger.** SW-13 should factor `CLIENT_MAP: Record<WizardKey, (props) => ReactNode>` (or drop the dispatcher's per-branch if-chain entirely in favour of a key-to-client map) as part of the session, not after.
- **`wizard_progress` writer.** Twilio form-step is single-paste; no mid-flow persistence needed. Generic API-key may batch-paste N keys in a single step — if SW-13 adds a batch-import UX, the writer lands there. If it stays single-paste-with-vendor-picker, the writer remains unlanded.
- **Humanised form-step field labels.** Twilio's form renders `accountSid` / `authToken` as-is (Zod keys). Pixieset was fine because `url` is already a word; Twilio's camelCase labels read slightly technical. Form-step-wide concern — add `config.fieldLabels?: Record<string,string>` to `FormStepConfig`. Not owed; fold in when copy starts reading wooden.
- **Credential blob shape documentation.** First wizard storing a JSON blob in `credentials.plaintext`. Consumer feature sessions (SMS sender) need to know the shape. Document in the vendor manifest's `humanDescription`? Already covered; re-check when the SMS feature session consumes.
- **Shared OAuth E2E harness** — still non-owed. First vendor app registration remains the right pull.
- **Four skeleton oauth callbacks in flight** — no change. Graph / Meta / Google callbacks still share the skeleton shape; SW-13 is form-step again so doesn't add to this count.
- **Dispatcher abstraction trigger is SW-13.** See Decisions. Generic API-key's vendor-picker prop is the fourth distinct props shape; `CLIENT_MAP` lands there.

## Notes

- First E2E using real in-field input (not `?testToken=`). Pattern will be reused by generic API-key if it keeps paste-style UX.
- Twilio SID + token regex are fixed vendor format specs — no settings-registry entry appropriate.
- `TWILIO_API_BASE` lives on the vendor module (not the def) per the pattern established in meta-ads and google-ads.
