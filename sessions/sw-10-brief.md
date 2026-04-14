# SW-10 — Second non-critical admin integration wizard — Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0 / §"Pre-compiled session briefs" + G11.b.**
> SW-9 landed pixieset-admin + the `/lite/setup/admin/[key]` route tree.
> SW-10 adds the second wizard under that tree.

---

## 1. Identity

- **Session id:** SW-10
- **Wave:** 4 — Setup Wizards
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet-safe — scaffolded from the graph-api-admin oauth-consent + pixieset-admin route-tree patterns).

## 2. Kickoff protocol

1. Read `sessions/sw-9-handoff.md` + `sessions/sw-8-handoff.md`.
2. Read `docs/specs/setup-wizards.md` §5.1 (admin integration wizard inventory).
3. Read `lib/wizards/defs/graph-api-admin.ts` + `.../clients/graph-api-admin-client.tsx` — the oauth-consent reference pattern.
4. Read `app/lite/setup/admin/[key]/page.tsx` — the dispatcher this session extends.

## 3. Scope — Meta Ads (recommended)

**Pattern:** copy graph-api-admin's oauth-consent arc (oauth-consent → review-and-confirm → celebration). Meta Ads exposes a standard OAuth 2.0 handshake + Graph-style API.

**Wizard arc:**
1. `oauth-consent` — Facebook/Meta login URL; callback returns access token.
2. `review-and-confirm` — show the connected ad account ID.
3. `celebration` — arc-level only; `registerIntegration` + `wizard_completions` insert.

`completionContract.verify` pings `GET https://graph.facebook.com/v20.0/me?fields=id,name` with the bearer token — cheapest authenticated identity check.

**Alternative scopes to pick from if Meta Ads is too heavy for one session:**
- **Generic API-key wizard** (§5.1 last row — covers OpenAI, Anthropic, SerpAPI, Remotion). Paste + trivial verify. Thinner than Meta Ads.
- **Twilio** — paste account SID + auth token; verify via `accounts.get()`.

Recommended order: **Meta Ads first** (oauth-consent is the structural unknown in the non-critical tree; exercising it unblocks Google Ads later). If context tightens, split at §10.

## 4. File whitelist

- `lib/integrations/vendors/meta-ads.ts` — vendor manifest.
- `lib/wizards/defs/meta-ads.ts` — `WizardDefinition<MetaAdsPayload>`; verify = `GET /me`.
- `lib/wizards/defs/index.ts` — add `./meta-ads` import.
- `app/lite/setup/admin/[key]/clients/meta-ads-client.tsx` — per-wizard client (copy graph-api-admin-client with `?testToken=` injection same pattern).
- `app/lite/setup/admin/[key]/page.tsx` — extend dispatcher with a second branch; compute `metaAuthorizeUrl` from env (mirror graph-api-admin).
- `app/lite/setup/admin/[key]/actions-meta-ads.ts` — `completeMetaAdsAction`.
- `app/api/oauth/meta-ads/callback/route.ts` — SW-7-a pattern skeleton (accepts `?code`/`?error`, redirects back to the wizard).
- `tests/meta-ads-wizard.test.ts` — 5 tests mirroring graph-api-admin-wizard.
- `tests/e2e/admin-meta-ads.spec.ts` — optional; `test.skip()` when `META_ADS_TEST_TOKEN` unset.
- `.env.example` — `META_ADS_CLIENT_ID`, `META_ADS_CLIENT_SECRET` (future), `META_ADS_TEST_TOKEN`.

## 5. Preconditions (G1)

- [ ] SW-9 closed — `ls sessions/sw-9-handoff.md`
- [ ] Defs barrel imports `pixieset-admin` — grep in `lib/wizards/defs/index.ts`
- [ ] Admin route tree exists — `ls app/lite/setup/admin/\[key\]/page.tsx`
- [ ] `graph-api-admin-client.tsx` + `actions-graph.ts` exist (copy sources)

## 6. Rollback strategy (G6)

- Feature-flag-gated via `setup_wizards_enabled`.
- No new schema; no new settings keys.
- OAuth callback ships as SW-7-a skeleton; full hardening pairs with Azure-equivalent Meta app registration (log a PATCHES_OWED row like `sw7b_graph_oauth_callback_hardening`).

## 7. Definition of done

- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → 351+ green
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean (new `/api/oauth/meta-ads/callback` route in manifest)
- [ ] `npm run test:e2e` → green (existing skips preserved; meta-ads spec skips without token)
- [ ] Handoff written; tracker updated; SW-11 brief pre-compiled
- [ ] PATCHES_OWED row opened for meta-ads oauth hardening if skeleton-only

## 8. Split-point (if context tight)

If the oauth-callback route + real oauth flow + client + tests together push past 70%:
- **Split 1:** ship wizard def + client (direct-injection testToken path only) + dispatcher branch in SW-10; defer callback route + real oauth to SW-10-b. Matches the SW-7-a/b split pattern.
- **Split 2:** drop Meta Ads entirely and ship a thinner **generic API-key wizard** instead; leaves oauth for SW-11.

## 9. Notes for the next-session brief writer

- After Meta Ads (or the alternative), SW-11 picks the next non-critical wizard. Likely Google Ads (oauth twin of Meta Ads) or the generic API-key bundle.
- **`wizard_progress` writer still unlanded.** If a future admin wizard needs mid-flow persistence (CSV import, async check that takes minutes), that session must land the writer + wire `scheduleWizardNudges()` / `cancelWizardNudges()` into it. Meta Ads probably doesn't need it — oauth-consent is a single round-trip.
- **`WizardDefinition.displayName`** still not added. Fold in when copy starts reading wooden.
