# SW-12 — Fourth non-critical admin integration wizard — Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0 / §"Pre-compiled session briefs" + G11.b.**
> SW-11 landed google-ads + the `/api/oauth/google-ads/callback` skeleton + the third dispatcher branch under `/lite/setup/admin/[key]`.
> SW-12 adds the fourth wizard under that tree.

---

## 1. Identity

- **Session id:** SW-12
- **Wave:** 4 — Setup Wizards
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet-safe — scaffolded from the pixieset-admin form-step pattern + the SW-9 admin shell).

## 2. Kickoff protocol

1. Read `sessions/sw-11-handoff.md` + `sessions/sw-10-handoff.md`.
2. Read `docs/specs/setup-wizards.md` §5.1 (admin integration wizard inventory).
3. Read `lib/wizards/defs/pixieset-admin.ts` + `.../clients/pixieset-admin-client.tsx` + `actions-pixieset.ts` — the copy sources (Twilio is a form-step wizard like Pixieset, not oauth like meta/google).
4. Read `app/lite/setup/admin/[key]/page.tsx` — the dispatcher this session extends to a fourth branch.

## 3. Scope — Twilio (recommended)

**Pattern:** copy pixieset-admin's form-step arc 1:1. Twilio does not use OAuth; admins paste an **Account SID** (`AC...` starting with `AC`, 34 chars hex) + an **Auth Token** (32 char hex) into a form step. `completionContract.verify` pings `GET https://api.twilio.com/2010-04-01/Accounts/<SID>.json` with HTTP Basic auth (`SID:auth_token`) — Twilio's minimum authenticated check that also confirms the account exists + is accessible.

**Wizard arc:**
1. `form` — two fields (`accountSid`, `authToken`) with Zod validation (SID regex `^AC[a-f0-9]{32}$`, auth token regex `^[a-f0-9]{32}$`).
2. `review-and-confirm` — show masked SID + token suffix.
3. `celebration` — arc-level; `registerIntegration` + `wizard_completions` insert.

**Credentials shape.** Unlike the oauth wizards (single bearer token) and Pixieset (single URL-as-capability), Twilio needs both SID + token stored together. Store as a JSON blob in `integration_connections.credentials` via the vault — e.g. `{"accountSid":"AC...", "authToken":"..."}`. Verify the blob shape in the vendor manifest consumer.

**Alternative scopes if Twilio feels heavy:**
- **Generic API-key wizard** (§5.1 last row — OpenAI / Anthropic / SerpAPI / Remotion). One parameterised def serving N vendors; bigger abstraction step. Skip unless Twilio is blocked.

Recommended order: **Twilio first** — first form-step wizard since Pixieset; first wizard storing a multi-field credential blob; dispatcher stress-test for "two oauth branches + two form branches" before generic API-key's multi-vendor shape. If context tightens, swap to the generic API-key (§8).

## 4. File whitelist

- `lib/integrations/vendors/twilio.ts` — vendor manifest + `TWILIO_API_BASE` constant.
- `lib/wizards/defs/twilio.ts` — `WizardDefinition<TwilioPayload>`; verify = Twilio Account GET with Basic auth; exports Zod schema for the form step (SID + token regex validators).
- `lib/wizards/defs/index.ts` — add `./twilio` import.
- `app/lite/setup/admin/[key]/clients/twilio-client.tsx` — per-wizard client (copy pixieset-admin-client with Twilio labels + two-field form state).
- `app/lite/setup/admin/[key]/page.tsx` — extend dispatcher with a fourth branch. **Dispatcher abstraction final reassess** — four branches with two distinct props shapes (form-only × 2, oauth × 2) is the last sensible check before generic API-key lands and ups the complexity. Per SW-11 handoff, current instinct is still "leave it" — revisit with evidence only.
- `app/lite/setup/admin/[key]/actions-twilio.ts` — `completeTwilioAction`. Stores SID+token as a JSON blob credential.
- `tests/twilio-wizard.test.ts` — 5-6 tests mirroring pixieset: step composition, manifest wiring, audience/render/capstone, barrel registration (asserts all seven wizards present), Zod SID+token accept/reject, verify() bad-credential rejection (stubbed or live if `TWILIO_TEST_SID`+`TWILIO_TEST_TOKEN` set).
- `tests/e2e/admin-twilio.spec.ts` — optional; `test.skip()` when `TWILIO_TEST_SID` + `TWILIO_TEST_TOKEN` unset. No direct-injection path needed — the form-step wizard just pastes the creds.
- `.env.example` — `TWILIO_TEST_SID`, `TWILIO_TEST_TOKEN` for the E2E. Note that Twilio has no app-registration step (no CLIENT_ID/SECRET); admins just paste their account credentials.

## 5. Preconditions (G1)

- [ ] SW-11 closed — `ls sessions/sw-11-handoff.md`
- [ ] Defs barrel imports `google-ads` — grep in `lib/wizards/defs/index.ts`
- [ ] Admin dispatcher has google-ads branch — grep in `app/lite/setup/admin/[key]/page.tsx`
- [ ] `pixieset-admin-client.tsx` + `actions-pixieset.ts` exist (form-step copy sources)
- [ ] Confirm `integration_connections.credentials` accepts JSON-blob payloads (check `registerIntegration` signature — payload.plaintext is likely string; if so, JSON.stringify the blob before handing off)

## 6. Rollback strategy (G6)

- Feature-flag-gated via `setup_wizards_enabled`.
- No new schema; no new settings keys.
- No callback route (form-step wizard, no oauth); no skeleton-hardening pair to own.

## 7. Definition of done

- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → 361+ green (356 prior + 5-6 new)
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean (no new route beyond the extended admin dispatcher)
- [ ] `npm run test:e2e` → 6 skipped (existing 5 + new twilio)
- [ ] Handoff written; tracker updated; SW-13 brief pre-compiled
- [ ] No PATCHES_OWED row opened (form-step wizards have no skeleton-hardening debt)

## 8. Split-point (if context tight)

Twilio is roughly Pixieset-sized with an extra form field + a live API ping. Unlikely to split. If context pressure appears:
- **Option A:** drop Twilio and ship the generic API-key wizard instead — but that session is larger, not smaller, so not a relief valve.
- **Option B:** ship the form + verify-call but defer E2E to SW-12-b. E2E is already optional per AUTONOMY §G12 for non-critical wizards.

## 9. Notes for the next-session brief writer

- **After Twilio, SW-13 is the generic API-key wizard.** Single `api-key-paste` wizard def parameterised by vendor (OpenAI / Anthropic / SerpAPI / Remotion). First wizard def to serve N vendors from one module; introduces a vendor-picker prop that's the first *new* shape on the admin dispatcher in three sessions. **This is the moment to factor `CLIENT_MAP`** — per SW-11 handoff "reassess at SW-13 or SW-14".
- **Shared OAuth E2E harness** remains not-owed but pickable. When the first vendor app registers (likely graph / Azure, since it's the least painful of the three), that's also the moment to extract `runOAuthWizardE2E({...})` and retrofit graph + meta + google.
- **`wizard_progress` writer** still unlanded. Twilio form step is a single paste; no mid-flow persistence. Generic API-key might batch-paste multiple keys — if SW-13 does that, it lands the writer.
- **Credential blob shape**. Twilio is the first wizard storing a multi-field credential. If `registerIntegration` requires `credentials.plaintext: string`, JSON.stringify the blob before handing off and document the shape in the manifest so consumer feature sessions can parse it consistently. If that forces a `registerIntegration` signature change, split the session: SW-12-a for the vendor + def + action signature extension, SW-12-b for the client + tests. Check in preflight (G1).
- **No authorize URL + no callback route**. First wizard since Pixieset with neither — no `.env.example` CLIENT_ID/SECRET block, just the two test vars. Keeps SW-12 small.
