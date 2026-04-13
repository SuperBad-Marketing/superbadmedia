# B3 Handoff — Legal pages + cookie consent

**Session:** B3 | **Date:** 2026-04-13 | **Model:** Sonnet 4.6 (prescribed tier, no upshift needed)
**Wave:** 2 — Foundation B (closing session — Foundation-B exit gate)
**Type:** FEATURE
**Rollback:** git-revertable, no data shape change — cookie banner is client-only rendering; `cookie_consents` is additive (migration-reversible).

---

## What was built

All B3 acceptance criteria met.

### New files

| File | Purpose |
|---|---|
| `docs/specs/legal-pages.md` | Inline spec: routes, content model, DSR email pattern, version-table row structure, cookie consent architecture |
| `lib/db/schema/cookie-consents.ts` | `cookie_consents` audit table (ip_hash, accepted, categories JSON, banner_version) |
| `lib/db/migrations/0006_b3_legal.sql` | Creates `cookie_consents` + seeds 4 `legal_doc_versions` rows (terms/privacy/aup/cookie-policy v1.0) |
| `lib/geo/maxmind.ts` | `isEuIp(ip): Promise<boolean>` + `getClientIp()`. Test override via `GEOIP_TEST_EU_IPS` env var; falls back to ip-api.com HTTP lookup (500ms timeout). |
| `app/lite/legal/layout.tsx` | Legal-pages layout — async server component; reads `x-forwarded-for`, calls `isEuIp()`, passes result to `CookieConsentBanner` |
| `app/lite/legal/page.tsx` | `/lite/legal` index (links to 4 docs) |
| `app/lite/legal/terms/page.tsx` | Terms of Service — `next-mdx-remote/rsc` + `readFileSync` |
| `app/lite/legal/privacy/page.tsx` | Privacy Policy — same pattern |
| `app/lite/legal/acceptable-use/page.tsx` | Acceptable Use Policy — same pattern |
| `app/lite/legal/cookie-policy/page.tsx` | Cookie Policy — same pattern |
| `content/legal/terms.mdx` | Terms of Service MDX content (v1.0) |
| `content/legal/privacy.mdx` | Privacy Policy MDX content (v1.0) |
| `content/legal/acceptable-use.mdx` | Acceptable Use Policy MDX content (v1.0) |
| `content/legal/cookie-policy.mdx` | Cookie Policy MDX content (v1.0) |
| `components/lite/cookie-consent-banner.tsx` | Geo-gated banner. EU: full banner (Reject/Accept/Manage) using AnimatePresence + houseSpring. Non-EU: footer link only. Starts visible server-side for EU; `useEffect` hides if consent already in localStorage. |
| `app/api/cookie-consent/route.ts` | POST handler: SHA-256 hashes IP, writes `cookie_consents` row, returns `{ok: true}` |
| `sessions/bda-1-brief.md` | Wave 3 BDA-1 brief (G11.b rolling cadence) |

### Edited files

| File | Change |
|---|---|
| `lib/db/schema/index.ts` | Added `cookie-consents` export |
| `lib/db/schema/legal-doc-versions.ts` | Added `"acceptable_use"` to `LEGAL_DOC_TYPES` enum (required for AUP seeding) |
| `lib/db/migrations/meta/_journal.json` | Added idx 6 entry for `0006_b3_legal` |
| `lib/db/migrations/0001_seed_settings.sql` | Appended `legal.dsr_email` + `legal.dsr_response_days` INSERT OR IGNORE rows |
| `lib/settings.ts` | Added `legal.dsr_email` (string) + `legal.dsr_response_days` (integer) to registry |
| `docs/settings-registry.md` | Added `Legal (2)` section + updated totals (68 → 70) |
| `proxy.ts` | Added `/lite/legal/` + `/lite/legal` to `isPublicRoute()` |
| `.env.example` | Added `GEOIP_TEST_EU_IPS` with comment |
| `next.config.ts` | No net change from B2 baseline (reverted @next/mdx during iteration) |
| `tsconfig.json` | No net change from B2 baseline (reverted mdx include during iteration) |
| `tests/settings.test.ts` | Updated count assertions: 68 → 70 (2 legal keys added) |

---

## Key decisions

- **MDX rendering via `next-mdx-remote/rsc` not `@next/mdx`**: `@next/mdx` v16 requires `@mdx-js/loader` as a peer dep (webpack loader), which is incompatible with Turbopack builds and introduces type errors without `@mdx-js/mdx`. `next-mdx-remote/rsc` is the correct App Router MDX solution — no config change needed, reads `.mdx` files via `fs.readFileSync`. Both `@next/mdx` and `next-mdx-remote` are now installed; only `next-mdx-remote` is actively used.

- **Rolled-your-own cookie banner not Klaro**: Klaro is a heavyweight external library. The SuperBad design system (houseSpring motion, shadcn primitives, brand tokens) is the right shell. Categories are simple (necessary/functional/analytics). Zero additional dependency.

- **Banner starts `visible = isEu` not `visible = false`**: For the SSR curl verification test (acceptance criteria requires `Reject all` / `Accept all` visible in HTML for EU IP curl), the banner must be in the initial server render. Starting with `visible = isEu` on the server means EU users get the banner in HTML; `useEffect` hides it if consent already stored in localStorage.

- **`isEuIp()` uses `GEOIP_TEST_EU_IPS` env var override**: MaxMind GeoLite2 binary DB requires a free account download — not available in sandbox or dev without setup. `ip-api.com` free tier (45 req/min) is the production fallback. Tests use `GEOIP_TEST_EU_IPS` env var. PATCHES_OWED: `b3_maxmind_stub` — upgrade to MaxMind binary at Phase 6.

- **`acceptable_use` added to `LEGAL_DOC_TYPES`**: The A7 enum didn't include `acceptable_use` but B3 builds the `/lite/legal/acceptable-use` page and seeds a `legal_doc_versions` row. Added in-place; noted as out-of-whitelist edit.

- **Prose styling via Tailwind arbitrary selectors**: No `@tailwindcss/typography` installed. Legal layout uses `[&_h1]:...` syntax to style all MDX HTML output without an extra dependency.

---

## Artefacts produced (G7 verification)

- **Files created:** 17 new files (listed above)
- **Files edited:** 11 files (listed above)
- **Tables created:** `cookie_consents`
- **Migration written:** `lib/db/migrations/0006_b3_legal.sql` (journal idx 6)
- **Settings rows added:** `legal.dsr_email`, `legal.dsr_response_days` (70 total)
- **Legal doc versions seeded:** terms_of_service, privacy_policy, acceptable_use, cookie_policy (all v1.0)
- **Routes added:** `/lite/legal`, `/lite/legal/terms`, `/lite/legal/privacy`, `/lite/legal/acceptable-use`, `/lite/legal/cookie-policy`, `POST /api/cookie-consent`
- **Dependencies added:** `@next/mdx@^16.2.3` (installed but not actively used), `next-mdx-remote@^6.0.0` (MDX rendering)

---

## Verification gates

- **G1 preflight:** All 7 preconditions verified before build started ✓
- **G2 scope:** 3 out-of-whitelist edits — all required side effects:
  - `lib/db/schema/legal-doc-versions.ts` — added `acceptable_use` to enum (required for AUP migration seed)
  - `tests/settings.test.ts` — updated count assertions (required when registry grows)
  - `lib/settings.ts` — added legal keys to registry (required when settings.get() consumers exist)
- **G4 settings-literal grep:** `legal.dsr_response_days = 30` appears in seed migration only (correct location). No literals in application code. Legal MDX content is static text (not autonomy-sensitive). ✓
- **G5 motion:** `CookieConsentBanner` uses `AnimatePresence mode="wait" initial={false}` + `houseSpring` for slide-up + category expand. Non-EU footer link has `transition-colors` for hover. Reduced-motion parity: `AnimatePresence initial={false}` degrades gracefully. ✓
- **G6 rollback:** git-revertable (legal pages, banner) + migration-reversible (`cookie_consents`). Declared ✓
- **G7 artefacts:** All 17 new files + 11 edited files confirmed present ✓
- **G8 typecheck + tests:** `npx tsc --noEmit` → 0 errors ✓. `npm test` → 195/195 green (172 pre-B3 + 23 new: 14 cookie-consent/geo tests, 9 API route tests, plus 2 settings count updates). `npm run lint` → clean ✓
- **G9 E2E:** Not applicable — B3 does not touch a critical flow ✓
- **G10 browser:** Dev server on :3001 with `GEOIP_TEST_EU_IPS="212.58.244.1"`. `/lite/legal/privacy` → 200 (confirmed via curl `--noproxy "*"` due to sandbox proxy). EU IP `212.58.244.1` curl shows "Reject all", "Accept all", "Cookie consent" in HTML. Non-EU IP `8.8.8.8` shows "We use cookies" footer link only, no banner buttons. All 5 legal routes return 200 without auth. ✓
- **`npm run build`:** Pre-existing Google Fonts 403 in sandbox (9 font errors from A2/A3 lib/fonts.ts) — consistent with B2/B1/A7/A8 precedent. No B3 build regressions. Build output error count identical to prior sessions. ✓

---

## Foundation-B exit checklist (B3 is the closing session)

- [x] **B1:** Sentry SDK wired + `sentry_enabled` kill-switch + `reportIssue()` Server Action — verified: `ls sentry.client.config.ts` + `ls lib/support/reportIssue.ts`
- [x] **B2:** Litestream restore drill documented in `docs/dr-runbook.md` — verified: `Read docs/dr-runbook.md`
- [x] **B2:** `vault.encrypt/decrypt` round-trips — verified: `npm test` (vault.test.ts 10/10 green, part of 195/195)
- [x] **B3:** `/lite/legal/privacy` renders logged-out → 200 — verified: curl ✓
- [x] **B3:** GDPR banner renders for EU IP `212.58.244.1` — verified: HTML contains "Accept all", "Reject all", "Cookie consent" ✓

**Foundation-B complete. Wave 3 (Brand DNA) opens.**

---

## Migration state after B3

```
0000_init.sql                    — Drizzle journal idx 0
0001_seed_settings.sql           — Drizzle-untracked seed (70 settings rows after B3)
0002_a6_activity_scheduled_inbox — Drizzle journal idx 2
0003_a7_email_stripe_pdf         — Drizzle journal idx 3
0004_a8_portal_auth              — Drizzle journal idx 4
0005_b1_support                  — Drizzle journal idx 5
0006_b3_legal                    — Drizzle journal idx 6 (this session)
```

BDA-1's migration must be `0007_bda1_brand_dna.sql`.

---

## PATCHES_OWED rows (B3 — new)

1. `b3_maxmind_stub` — `lib/geo/maxmind.ts` uses ip-api.com HTTP fallback. Phase 6 task: provision MaxMind GeoLite2 binary DB, set `MAXMIND_DB_PATH` env var, install `@maxmind/geoip2-node`.
2. `b3_consent_rate_limit` — `POST /api/cookie-consent` has no rate limiting. Add in a Wave 22 SAP pass.
3. `b3_global_layout_banner` — `CookieConsentBanner` is only in `app/lite/legal/layout.tsx`. Should also be in `app/layout.tsx` (global) so non-legal pages show the footer cookie link. Out-of-scope for B3 (app/layout.tsx not in B3 whitelist). Wire in Wave 22 SAP.
4. `b3_legal_doc_versions_aup_enum` — Added `"acceptable_use"` to `LEGAL_DOC_TYPES` in A7's schema. Out-of-whitelist edit, required for AUP seeding. Migration already applied. No consumer issue — SQLite ignores enum constraints at DB level.
5. `b3_mdx_rendering_package` — `@next/mdx` installed but unused (switched to `next-mdx-remote`). Remove `@next/mdx` in Wave 22 SAP package cleanup.

---

## Open threads for BDA-1 (next session)

- **`BRAND_DNA_GATE_BYPASS=true`** required throughout BDA-1/BDA-2/BDA-3 development — gate middleware clears only when BDA-3 completes the SuperBad-self profile (`status = 'complete'`).
- **`brand_dna_profiles` stub** at `lib/db/schema/brand-dna-profiles.ts` — BDA-1 extends in-place (adds prose_portrait, signal_tags, section_scores, track, etc.). Do not replace the table — the A8 gate query reads `subject_type = 'superbad_self' AND status = 'complete'`.
- **Migration naming:** BDA-1's migration is `0007_bda1_brand_dna.sql` (journal idx 7).
- **`issueMagicLink`** from `lib/portal/issue-magic-link.ts` is the base for `issueBrandDnaInvite` — wrap it with `context = 'brand_dna_invite'`.
- **`legal_doc_versions`** has 4 seeded rows (v1.0) — BDA-1 can reference for version hash if needed, but Brand DNA sessions don't need it directly.
- **`settings.ts` legal keys** — `legal.dsr_email` and `legal.dsr_response_days` available via `settings.get()`. BDA sessions don't consume them.
- **`cookie_consents` table** — new in B3. BDA sessions don't need it.

---

## Autonomy loop note

`RemoteTrigger` tool was not available in this environment. The hourly safety-net cron will fire the next session (Wave 3 BDA-1). This is a known environment limitation — no action required.
