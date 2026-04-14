# SW-11 — Third non-critical admin integration wizard — Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0 / §"Pre-compiled session briefs" + G11.b.**
> SW-10 landed meta-ads + the `/api/oauth/meta-ads/callback` skeleton + the second dispatcher branch under `/lite/setup/admin/[key]`.
> SW-11 adds the third wizard under that tree.

---

## 1. Identity

- **Session id:** SW-11
- **Wave:** 4 — Setup Wizards
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet-safe — scaffolded directly from the SW-10 meta-ads pattern, which is itself a copy of graph-api-admin).

## 2. Kickoff protocol

1. Read `sessions/sw-10-handoff.md` + `sessions/sw-9-handoff.md`.
2. Read `docs/specs/setup-wizards.md` §5.1 (admin integration wizard inventory).
3. Read `lib/wizards/defs/meta-ads.ts` + `.../clients/meta-ads-client.tsx` + `actions-meta-ads.ts` — the copy sources.
4. Read `app/lite/setup/admin/[key]/page.tsx` — the dispatcher this session extends to a third branch.

## 3. Scope — Google Ads (recommended)

**Pattern:** copy meta-ads's oauth-consent arc 1:1. Google Ads uses Google's OAuth 2.0 (accounts.google.com/o/oauth2/v2/auth) + a Google-specific userinfo endpoint for identity verification.

**Wizard arc:**
1. `oauth-consent` — Google login + consent URL; callback returns authorization code.
2. `review-and-confirm` — show the connected Google account identity.
3. `celebration` — arc-level only; `registerIntegration` + `wizard_completions` insert.

`completionContract.verify` pings `GET https://www.googleapis.com/oauth2/v3/userinfo` with the bearer token — Google's minimum authenticated identity check.

OAuth scopes: `https://www.googleapis.com/auth/adwords` (Ads API) + `openid email profile` (for the identity ping).

**Alternative scopes to pick from if Google Ads is too heavy:**
- **Twilio** — paste account SID + auth token; verify via `accounts.get()`. Form-step wizard (no oauth); stresses the dispatcher on a different shape than two consecutive oauth branches. Cheaper session.
- **Generic API-key wizard** (§5.1 last row — OpenAI / Anthropic / SerpAPI / Remotion). Parameterised paste + trivial verify. Introduces the "one wizard def per vendor, one shared client" multi-vendor pattern.

Recommended order: **Google Ads first** — second oauth wizard in the admin tree stresses the dispatcher on "two oauth branches, one form branch" before later sessions introduce more shapes. Meta's SW-10-a pattern transfers ~1:1. If context tightens, swap to Twilio per §8.

## 4. File whitelist

- `lib/integrations/vendors/google-ads.ts` — vendor manifest + `GOOGLE_OAUTH_SCOPES` constant.
- `lib/wizards/defs/google-ads.ts` — `WizardDefinition<GoogleAdsPayload>`; verify = `GET /oauth2/v3/userinfo`.
- `lib/wizards/defs/index.ts` — add `./google-ads` import.
- `app/lite/setup/admin/[key]/clients/google-ads-client.tsx` — per-wizard client (copy meta-ads-client with Google labels).
- `app/lite/setup/admin/[key]/page.tsx` — extend dispatcher with a third branch; compute `googleAuthorizeUrl` from env. **Reassess if/else-if vs dispatcher map as noted in SW-10 handoff.**
- `app/lite/setup/admin/[key]/actions-google-ads.ts` — `completeGoogleAdsAction`.
- `app/api/oauth/google-ads/callback/route.ts` — SW-7-a / SW-10-a pattern skeleton.
- `tests/google-ads-wizard.test.ts` — 5 tests mirroring meta-ads-wizard.
- `tests/e2e/admin-google-ads.spec.ts` — optional; `test.skip()` when `GOOGLE_ADS_TEST_TOKEN` unset.
- `.env.example` — `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_TEST_TOKEN`, and note that Google Ads API also requires a developer token (see §9).

## 5. Preconditions (G1)

- [ ] SW-10 closed — `ls sessions/sw-10-handoff.md`
- [ ] Defs barrel imports `meta-ads` — grep in `lib/wizards/defs/index.ts`
- [ ] Admin dispatcher has meta-ads branch — grep in `app/lite/setup/admin/[key]/page.tsx`
- [ ] `meta-ads-client.tsx` + `actions-meta-ads.ts` + `/api/oauth/meta-ads/callback/route.ts` exist (copy sources)

## 6. Rollback strategy (G6)

- Feature-flag-gated via `setup_wizards_enabled`.
- No new schema; no new settings keys.
- OAuth callback ships as SW-7-a / SW-10-a pattern skeleton; full hardening pairs with Google Cloud app registration (log a PATCHES_OWED row like `sw11b_google_ads_oauth_callback_hardening`).

## 7. Definition of done

- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → 356+ green
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean (new `/api/oauth/google-ads/callback` route in manifest)
- [ ] `npm run test:e2e` → 5 skipped (existing 4 + new google-ads)
- [ ] Handoff written; tracker updated; SW-12 brief pre-compiled
- [ ] PATCHES_OWED row opened for google-ads oauth hardening if skeleton-only

## 8. Split-point (if context tight)

If Google Ads feels heavier than Meta Ads (developer-token wrinkle, different scope-consent UX), split is unlikely — the wizard def + client + callback + tests are each ~100 lines of near-exact copy from meta-ads. If context pressure appears anyway:
- **Option A:** drop Google Ads and ship Twilio instead (form-step wizard, new shape for the dispatcher).
- **Option B:** ship the wizard def + client + dispatcher branch; defer the callback route + E2E spec to SW-11-b (matches SW-7-a/b + SW-10-a/b split pattern).

## 9. Notes for the next-session brief writer

- **Google Ads developer token quirk.** Google Ads API calls (not the oauth flow itself, not the `/userinfo` verify) require a `developer-token` HTTP header in addition to the bearer token. That's a feature-session concern — the wizard only exercises `/userinfo`, which needs no developer token — but flag it in the vendor manifest's `humanDescription` so a future ad-campaign-builder session doesn't rediscover it the hard way.
- After Google Ads, **SW-12 picks Twilio or the generic API-key bundle.** Twilio is the cleaner next step — it's a form-step wizard (SID + auth token paste), which stresses the dispatcher on a shape it hasn't seen since Pixieset. Generic API-key is the last of the set and benefits from the dispatcher's final shape already being settled.
- **Dispatcher abstraction revisit.** If Google Ads makes the page.tsx if/else-if chain read awkwardly, factor out to `CLIENT_MAP: Record<WizardKey, (def, env) => ReactNode>` in the same session — three branches is the right pressure point. If it reads fine, leave it alone; don't pre-optimise.
- **`wizard_progress` writer** still unlanded. Google Ads oauth is a single round-trip; no mid-flow persistence needed. First wizard that does (Twilio? generic API-key?) lands the writer.
- **Shared E2E harness.** Three skip-gated oauth specs (graph, meta, google) is the moment to extract `runOAuthWizardE2E({...})`. Do it in SW-11 if time; defer to SW-12 otherwise.
