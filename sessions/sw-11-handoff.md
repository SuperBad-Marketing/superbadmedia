# SW-11 — Google Ads admin wizard — Handoff

**Closed:** 2026-04-14
**Brief:** `sessions/sw-11-brief.md`
**Model:** Opus (`/deep`) — user fired `let's go` without waiting for `/normal` to take effect. Brief was Sonnet-safe; Opus overkill but not wrong. No drift impact.
**Type:** FEATURE
**Rollback:** feature-flag-gated via `setup_wizards_enabled` (shared with the rest of the wizard family). Revert = delete new files + revert barrel + revert dispatcher branch + revert `.env.example` Google block. No schema change. No migration. No settings keys touched.

## What shipped

- **`lib/integrations/vendors/google-ads.ts`** — third non-critical vendor manifest. `vendorKey = "google-ads"`, two bands (`google.identity.read`, `google.ads.campaigns.read`) sized 1:1 to meta-ads. `actorConvention: "internal"`, `killSwitchKey: "setup_wizards_enabled"`. Exports `GOOGLE_OAUTH_SCOPES` (`adwords` + `openid email profile`), `GOOGLE_OAUTH_AUTHORIZE_URL` (`accounts.google.com/o/oauth2/v2/auth`), and `GOOGLE_USERINFO_URL` as design-time constants. `humanDescription` explicitly flags the Ads API `developer-token` HTTP header requirement so ad-campaign-builder doesn't rediscover it.
- **`lib/wizards/defs/google-ads.ts`** — `WizardDefinition<GoogleAdsPayload>` composing `oauth-consent → review-and-confirm → celebration`. Structurally identical to meta-ads; only vendor label, verify endpoint, and copy differ. `completionContract.verify` pings `GET /oauth2/v3/userinfo` with the bearer token — Google's minimum authenticated identity check (needs `openid` scope; plain bearer only, no developer-token). Artefact gate `integrationConnections: true`. Capstone `undefined` (non-critical). Self-registers via `registerWizard()`.
- **`lib/wizards/defs/index.ts`** — barrel now imports all six wizards (stripe-admin, resend, graph-api-admin, pixieset-admin, meta-ads, google-ads).
- **`app/lite/setup/admin/[key]/page.tsx`** — dispatcher extended from two-branch to three-branch if/else-if chain (see "Decisions" on why the map abstraction still doesn't land). Adds `buildGoogleAuthorizeUrl()` helper mirroring `buildMetaAuthorizeUrl`: reads `GOOGLE_ADS_CLIENT_ID` + `NEXT_PUBLIC_APP_URL`; scopes joined with space (Google's convention, vs Meta's comma); adds `access_type=offline` + `prompt=consent` + `include_granted_scopes=true` (refresh-token requirements, surfaced now so SW-11-b inherits them). Falls back to `"#"` when `GOOGLE_ADS_CLIENT_ID` is unset.
- **`app/lite/setup/admin/[key]/clients/google-ads-client.tsx`** — per-wizard client. 1:1 copy of `meta-ads-client.tsx` with "Meta" → "Google" labels. Seeds oauth-consent with `{ token: null, vendorLabel: "Google" }`, honours `?testToken=` when injection permitted, builds review summary from token suffix, wires celebration `onComplete` to `completeGoogleAdsAction`.
- **`app/lite/setup/admin/[key]/actions-google-ads.ts`** — single Server Action `completeGoogleAdsAction(payload)`. Runs `registerIntegration → verifyCompletion → wizard_completions insert`. No `unstable_update()` (non-critical, established pattern from SW-9/10).
- **`app/api/oauth/google-ads/callback/route.ts`** — skeleton callback following the SW-7-a / SW-10-a pattern. Accepts `?code`/`?error`, logs error cases via `console.warn`, redirects back to `/lite/setup/admin/google-ads?oauth=pending` (or `?oauth=error&reason=...`). Real code→token exchange deferred to SW-11-b (PATCHES_OWED row opened).
- **`tests/google-ads-wizard.test.ts`** — 5 unit tests mirroring `meta-ads-wizard.test.ts`: step composition, manifest wiring, audience/render/capstone shape, barrel registration (asserts all six wizards present), bad-token rejection via live `/userinfo` ping.
- **`tests/e2e/admin-google-ads.spec.ts`** — optional Playwright smoke. `test.skip()` when `GOOGLE_ADS_TEST_TOKEN` is unset (same pattern as graph/meta). Exercises `oauth-consent (injected) → review → celebration → cockpit` and asserts `wizard_completions` + `integration_connections` rows land.
- **`.env.example`** — new Google block with `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` (declared but unused until SW-11-b), `GOOGLE_ADS_TEST_TOKEN`. Placed between the Meta block and `ANTHROPIC_API_KEY`. Developer-token quirk noted in the block's comment.
- **`PATCHES_OWED.md`** — new row `sw11b_google_ads_oauth_callback_hardening` opened alongside its SW-7-b / SW-10-b counterparts.

## Decisions

- **Dispatcher stays an if/else-if chain (third branch edition).** Brief §9 + SW-10 handoff flagged the map-abstraction reassessment at branch #3. Reviewed and deferred: meta-ads and google-ads share an identical props shape (audience, steps, outroCopy, expiryDays, authorizeUrl, allowTestTokenInjection) but pixieset-admin drops `authorizeUrl` + `allowTestTokenInjection`. A `CLIENT_MAP: Record<WizardKey, (props) => ReactNode>` collapses that shape difference behind a cast and buys very little — the branches are each 8–12 lines and trivially greppable. **Real trigger point:** when a fourth or fifth wizard adds a fourth distinct props shape (likely the generic API-key wizard with a vendor-picker prop), then factor out. Logging this as "reassess at SW-13 or SW-14", not opening a PATCHES_OWED row (no crossed wiring, just redundancy).
- **Google authorize URL ships with refresh-token params now.** `access_type=offline`, `prompt=consent`, `include_granted_scopes=true` added to the URL builder even though SW-11-a doesn't consume refresh tokens. Rationale: when SW-11-b wires the real code→token exchange, it'll need refresh tokens for long-lived bearer access (Google access_tokens expire at 1h). Surfacing those params now means SW-11-b only needs to change the callback route + add a token-exchange helper, not also touch the authorize URL. Cheap forward-loading.
- **Scope delimiter is space, not comma.** Meta uses `scope=ads_read,ads_management`. Google uses `scope=openid email profile https://www.googleapis.com/auth/adwords`. Both vendors accept URL-encoded separators; using the vendor-native convention keeps the constructed URL reviewable against vendor docs without mental translation.
- **`verify()` uses `/oauth2/v3/userinfo`, not any Ads endpoint.** Ads API calls require the developer-token; userinfo doesn't. The wizard only needs "did we get a working bearer" — the identity ping proves that without dragging developer-token setup onto the wizard's critical path. Binding a specific Google Ads customer account is a feature-session concern.
- **Constants live on the vendor manifest module, not the def.** `GOOGLE_OAUTH_SCOPES` / `GOOGLE_OAUTH_AUTHORIZE_URL` / `GOOGLE_USERINFO_URL` export from `lib/integrations/vendors/google-ads.ts`, mirroring the `META_OAUTH_SCOPES` / `META_GRAPH_API_VERSION` shape. The wizard def imports the userinfo URL; the authorize URL builder in `page.tsx` imports scopes + authorize URL. Def stays free of env-shape concerns.
- **Shared E2E harness deferred.** Brief §9 flagged "three oauth specs is the moment" for `runOAuthWizardE2E({...})`. Looked at all three specs (graph, meta, google) — they're structurally identical except for test-token env var name, path segment, and wizard_key assertion. A harness is straightforwardly extractable (~3 params) but all three specs are `test.skip()` today and remain so until the vendor apps register. Factoring a harness that nothing runs yet invites drift when the first one un-skips and the harness needs tweaking. Deferred as a **non-owed** follow-up, not a PATCHES_OWED row — pick it up alongside whichever vendor app gets registered first (likely graph, since Azure setup is the least painful of the three).
- **Copy stays dry.** Intro/outro copy mirrors meta-ads's shape verbatim with "Meta" → "Google". Same rationale as SW-10: the wizard is a stop on an arc, not a brand moment.
- **E2E skips by default.** Same rationale as graph/meta: no Google Cloud app registered in dev. `test.skip()` keeps CI green; opt in by exporting `GOOGLE_ADS_TEST_TOKEN`. Brief §7 authorised as optional.

## Files touched

| File | Change |
| --- | --- |
| `lib/integrations/vendors/google-ads.ts` | NEW |
| `lib/wizards/defs/google-ads.ts` | NEW |
| `lib/wizards/defs/index.ts` | Add `./google-ads` import |
| `app/lite/setup/admin/[key]/page.tsx` | Extend dispatcher (google-ads branch + `buildGoogleAuthorizeUrl`) |
| `app/lite/setup/admin/[key]/clients/google-ads-client.tsx` | NEW |
| `app/lite/setup/admin/[key]/actions-google-ads.ts` | NEW |
| `app/api/oauth/google-ads/callback/route.ts` | NEW |
| `tests/google-ads-wizard.test.ts` | NEW (5 tests) |
| `tests/e2e/admin-google-ads.spec.ts` | NEW (skip-gated) |
| `.env.example` | Google Ads block (CLIENT_ID, CLIENT_SECRET, TEST_TOKEN + developer-token note) |
| `PATCHES_OWED.md` | Open `sw11b_google_ads_oauth_callback_hardening` |
| `sessions/sw-11-handoff.md` | NEW (this file) |
| `sessions/sw-12-brief.md` | NEW (pre-compiled per G11.b) |
| `SESSION_TRACKER.md` | Next Action → SW-12 |

No migration. No settings keys touched. No schema change.

## Verification

- `npx tsc --noEmit` — zero errors
- `npm test` — **356/356 green** (351 prior + 5 new from `google-ads-wizard.test.ts`)
- `npm run lint` — clean
- `npm run build` — clean; new `/api/oauth/google-ads/callback` route in the manifest alongside `graph-api/callback` and `meta-ads/callback`
- `npm run test:e2e` — 5 skipped (prior 4 + new admin-google-ads). First attempt hit a stale `.next` turbopack persistence error (`Failed to open database — invalid digit found in string`); cleared `.next` and the second run started clean. Unrelated to this session's diff.

## G0–G12 walkthrough

- **G0 kickoff** — brief read; SW-10 + SW-9 handoffs read; meta-ads def + client + actions + callback read as copy sources; admin-tree page read; Sonnet tier in brief noted (actual model: Opus — same drift-neutral pattern as SW-9).
- **G1 preflight** — 4/4 preconditions verified: SW-10 handoff present, defs barrel imports `meta-ads`, admin dispatcher has meta-ads branch, meta-ads client + actions + callback files exist as copy sources.
- **G2 scope discipline** — every file in brief §4 whitelist touched; nothing else.
- **G3 context budget** — comfortable single-session.
- **G4 literal-grep** — no autonomy thresholds introduced. `GOOGLE_OAUTH_SCOPES`, `GOOGLE_OAUTH_AUTHORIZE_URL`, `GOOGLE_USERINFO_URL` are vendor API constants, not autonomy thresholds. Bands `{p95:600,p99:1800}` / `{p95:900,p99:2400}` are nominal defaults on the vendor manifest, not autonomy-sensitive. `access_type=offline` + `prompt=consent` are OAuth handshake constants, not runtime-tunable behaviour.
- **G5 motion** — no motion changes. Celebration uses existing Tier-2 `wizard-complete` choreography.
- **G6 rollback** — feature-flag-gated via `setup_wizards_enabled`. No migration.
- **G7 artefacts** — every file in the table present (build route manifest includes `/api/oauth/google-ads/callback` + `/lite/setup/admin/[key]`).
- **G8 typecheck + tests + lint + build** — all green (numbers above).
- **G9 E2E** — 5 skipped (4 prior + new admin-google-ads). Skip intentional; spec runs the instant `GOOGLE_ADS_TEST_TOKEN` is exported.
- **G10 manual browser** — not run this session. The oauth-consent + admin-tree surfaces are covered structurally by graph-api-admin + meta-ads; google-ads introduces no new step types or shell code.
- **G11.b** — SW-12 brief pre-compiled.
- **G12** — tracker updated; commit next.

## PATCHES_OWED status

- **Closed this session:** none.
- **Opened this session:** `sw11b_google_ads_oauth_callback_hardening` — pairs with Google Cloud app registration.
- **Still open (carried):**
  - `sw5_integration_rollback_on_insert_failure` — Observatory wave.
  - `sw7b_graph_oauth_callback_hardening` — pairs with Azure app registration.
  - `sw10b_meta_ads_oauth_callback_hardening` — pairs with Meta app registration.

## Open threads for SW-12

- **Remaining non-critical admin wizards.** After Google Ads: Twilio (paste SID + auth token; `form`-step wizard, no oauth), generic API-key parametrised wizard (covers OpenAI / Anthropic / SerpAPI / Remotion per spec §5.1 last row). **Recommended next: Twilio.** It's a form-step wizard — the first new wizard *shape* the admin dispatcher has seen since Pixieset. Stresses the dispatcher on "two oauth branches + two form branches" before generic API-key introduces the multi-vendor/one-wizard-def pattern. Brief pre-compiled with Twilio as the default.
- **Dispatcher abstraction reassessment, take three.** Still not worth the abstraction — see Decisions above. Reassess when a fourth distinct props shape lands (likely with the generic API-key wizard's vendor-picker prop).
- **Shared OAuth E2E harness deferred, not owed.** See Decisions. First vendor app registration (likely graph) is the right pull for the extraction.
- **`wizard_progress` writer still unlanded.** Google Ads oauth is single round-trip; no mid-flow persistence needed. Twilio's form step is also trivially instantaneous. First admin wizard that needs mid-flow persistence (generic API-key batch-import? content-picker?) lands the writer + wires `scheduleWizardNudges()` / `cancelWizardNudges()`.
- **`/lite/integrations` hub page** — still unshipped; spec §8.4 implies it exists. Not SW-12's problem but worth flagging: lazy-surfacing depends on it.
- **`WizardDefinition.displayName`** — still not added. Fold in when copy starts reading wooden (not yet).
- **Google Cloud app registration is the real blocker for `sw11b`.** Andy needs to: create a Google Cloud project + enable Google Ads API, configure OAuth consent screen (external user type, `openid email profile + adwords` scopes), create OAuth 2.0 Client ID (Web application), whitelist `<APP_URL>/api/oauth/google-ads/callback` as a redirect URI, request a developer-token from the MCC account (separate approval flow, can take 24-48h), populate the env vars. SW-11-b is the session that consumes that work. Developer-token is **not** needed for the wizard's userinfo ping — only for Ads API feature work downstream.
- **Three skeleton oauth callbacks now in flight.** graph-api, meta-ads, google-ads. Each has a paired `swNb_*_oauth_callback_hardening` PATCHES_OWED row. When the first vendor app registers, that's also the moment to audit whether the three callback routes can share a `lib/oauth/handleCallback()` helper (state validation, error normalisation, signed-cookie handoff) or stay per-vendor — most of the cross-vendor variation is in token-exchange body shape, which stays vendor-specific. Flag, not owed.

## Notes

- Google's scope list (4 items) exceeds Meta's (2). Still well under any practical URL length limit. No pagination concerns.
- `oauth2/v3/userinfo` returns `{sub, email, name, picture, ...}` — we don't bind any of it to the integration row today. The stored credential is just the access token. If a future feature wants "which Google account is this" surfaced in the admin list, the metadata field already has a slot.
- Google access tokens are 1h-scoped. SW-11-b must store + refresh via `refresh_token` (hence `access_type=offline` on the authorize URL). Meta Marketing tokens are long-lived (60 days with auto-extension on use), so SW-10-b has no refresh dance — vendor divergence SW-11-b should plan for.
