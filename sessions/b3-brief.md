# B3 — Legal pages + cookie consent — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.

---

## 1. Identity

- **Session id:** B3
- **Wave:** 2 — Foundation B (closing session — Foundation-B exit gate)
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes (prescribed tier)
- **Estimated context:** large — split via G3 70% checkpoint if needed.

## 2. Spec references

- `BUILD_PLAN.md` Wave 2 §B3 — owner block.
- `PATCHES_OWED.md` Phase 3.5 Batch C step 13 rows L1 (legal pages owner → standalone spec) + L3 (cookie consent banner + MaxMind geo-gate) + Stop 14 resolutions L1–L4.
- `docs/settings-registry.md` — `legal.dsr_email` + `legal.dsr_response_days` (new keys B3 seeds).
- `docs/specs/quote-builder.md` §Q14 — quote PDF "terms link" target (once L1 lands: `/lite/legal/terms#retainer-and-project-work`). B3 creates the anchor; QB-4 wires the link.
- `docs/specs/saas-subscription-billing.md` signup schema — `tos_accepted_at` + `privacy_accepted_at` note. B3 creates the legal pages; SB-5 adds the signup tickbox.

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md B3)

```
B3 — Legal pages + cookie consent
- Builds: drafts the owed `docs/specs/legal-pages.md` spec inline (Stop 14 L1)
  + implements: `/lite/legal/{terms,privacy,acceptable-use,cookie-policy,index}`
  static MDX pages (LLM-drafted from template + Andy approve-once per
  `feedback_no_content_authoring`); `legal_doc_versions` reference table (version
  hash + effective_date per document) — NOTE: table was created in A7; B3 seeds
  rows into it; GDPR cookie-consent banner (geo-gated: MaxMind lookup → EU IPs
  get full reject-all/accept-all/manage-categories banner, everyone else gets a
  permanent footer "We use cookies — details" link to `/lite/legal/cookie-policy`);
  `cookie_consents` audit table for EU traffic; consent state in localStorage +
  echo to DB. Evaluates Klaro vs rolled-your-own inside the session and picks
  (technical call, no Andy question).
- Owns: `docs/specs/legal-pages.md`, `cookie_consents`, `/lite/legal/*` routes.
- Consumes: A2 (design tokens for legal page styling), A3 (primitives), B1
  (Sentry for consent-banner error telemetry).
- Settings keys (NEW): `legal.dsr_email`, `legal.dsr_response_days`.
- Rollback: git-revertable; cookie banner is client-only rendering.

Foundation-B exit: typecheck/test green, Sentry captures an intentional throw,
Litestream restore drill completes, vault round-trips a test secret,
`/lite/legal/privacy` renders for logged-out visitors, GDPR banner shows from a
spoofed EU IP. Handoff written.
```

## 4. Skill whitelist

- `superbad-brand-voice` — legal-page copy tone (plain English, not stuffy; still SuperBad voice, just measured).

## 5. File whitelist (G2 scope discipline)

- `docs/specs/legal-pages.md` — inline spec draft (owns routes, content model, version table, DSR email) (`new`).
- `lib/db/schema/cookie-consents.ts` — `cookie_consents` audit table (`new`).
- `lib/db/migrations/0006_b3_legal.sql` — `cookie_consents` table + `legal_doc_versions` seed rows (`new`).
- `lib/db/schema/index.ts` — add barrel export for `cookie-consents` (`edit`).
- `app/lite/legal/layout.tsx` — legal-pages layout (publicly accessible, no auth gate) (`new`).
- `app/lite/legal/page.tsx` — `/lite/legal` index (links to all 4 sub-pages) (`new`).
- `app/lite/legal/terms/page.tsx` — Terms of Service (MDX-rendered static page) (`new`).
- `app/lite/legal/privacy/page.tsx` — Privacy Policy + DSR email disclosure (`new`).
- `app/lite/legal/acceptable-use/page.tsx` — Acceptable Use Policy (`new`).
- `app/lite/legal/cookie-policy/page.tsx` — Cookie Policy (`new`).
- `content/legal/terms.mdx` — Terms of Service MDX content (`new`).
- `content/legal/privacy.mdx` — Privacy Policy MDX content (`new`).
- `content/legal/acceptable-use.mdx` — Acceptable Use Policy MDX content (`new`).
- `content/legal/cookie-policy.mdx` — Cookie Policy MDX content (`new`).
- `components/lite/cookie-consent-banner.tsx` — geo-gated GDPR banner + permanent footer link (`new`).
- `lib/geo/maxmind.ts` — MaxMind GeoLite2 lookup (or IP API fallback) → `isEuIp(ip): boolean` (`new`).
- `app/api/cookie-consent/route.ts` — POST handler: writes `cookie_consents` row from EU visitors (`new`).
- `middleware.ts` — extend matcher to allow `/lite/legal/*` without auth (legal pages must be publicly accessible) (`edit`). Also: confirm `/api/cookie-consent` is excluded from auth check.
- `docs/settings-registry.md` — add `legal.dsr_email` + `legal.dsr_response_days` rows + update totals (`edit`).
- `lib/db/migrations/0001_seed_settings.sql` — append `legal.dsr_email` + `legal.dsr_response_days` INSERT OR IGNORE rows (`edit`).
- `package.json` + lock — MDX rendering package (e.g. `@next/mdx`) if not already present + MaxMind or geo-lookup (`edit`).
- `tests/cookie-consent.test.ts` — unit tests: EU IP → banner state, non-EU → footer-only, consent record write (`new`).

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** none at runtime (legal pages are static; cookie-consent banner reads no settings keys).
- **Seeds (new keys):**
  - `legal.dsr_email` — `"privacy@superbadmedia.com.au"` — Privacy Act DSR contact address.
  - `legal.dsr_response_days` — `30` — statutory response commitment (days).

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] B2 closed cleanly — verify: `ls sessions/b2-handoff.md`.
- [ ] `legal_doc_versions` table exists (created in A7, not B3) — verify: `Grep "legal_doc_versions" lib/db/schema/`.
- [ ] `isAdminPath()` excludes `/lite/legal/` from the admin gate — verify: `Grep "legal" lib/auth/has-completed-critical-flight.ts` (should NOT be in the admin path set; if it is, patch the middleware in this session first).
- [ ] `lib/support/reportIssue.ts` exists (B1) — verify: `ls lib/support/reportIssue.ts`.
- [ ] `CREDENTIAL_VAULT_KEY` in `.env.example` (B2) — verify: `Grep "CREDENTIAL_VAULT_KEY" .env.example`.
- [ ] `INCIDENT_PLAYBOOK.md` exists (B2) — verify: `ls INCIDENT_PLAYBOOK.md`.
- [ ] `docs/settings-registry.md` has no `legal.*` keys yet — verify: `Grep "legal\." docs/settings-registry.md` returns nothing. (B3 seeds them.)

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**git-revertable, no data shape change** — cookie banner is client-only rendering (EU IP check is edge-safe, no DB required to render); `cookie_consents` is additive (migration-reversible). Legal pages are static MDX with no DB dependency. Reverting B3's commits removes all surfaces cleanly.

## 9. Definition of done

- [ ] `docs/specs/legal-pages.md` exists with routes, content model, DSR-email pattern, version-table row structure — verify: `Read docs/specs/legal-pages.md`.
- [ ] `/lite/legal/privacy` returns HTTP 200 for a logged-out request — verify: curl dev server without a session cookie.
- [ ] `/lite/legal/terms` returns HTTP 200 for a logged-out request — verify: curl.
- [ ] GDPR banner renders for a spoofed EU IP (use `x-forwarded-for: 212.58.244.1` in a curl header) — verify: HTML response contains consent banner component.
- [ ] Non-EU IP response does NOT contain the full banner (contains footer cookie link only) — verify: curl without EU IP header.
- [ ] `cookie_consents` table exists — verify: `Grep "cookie_consents" lib/db/schema/cookie-consents.ts`.
- [ ] `legal.dsr_email` + `legal.dsr_response_days` seeded in settings migration — verify: `Grep "dsr_email" lib/db/migrations/`.
- [ ] **Foundation-B exit checklist (all must pass):**
  - [ ] B1: Sentry captures an intentional throw (from `sentry.client.config.ts` smoke event) — verify: Sentry event log or offline mock in tests.
  - [ ] B2: Litestream restore drill documented in `docs/dr-runbook.md` — verify: `Read docs/dr-runbook.md`.
  - [ ] B2: `vault.encrypt/decrypt` round-trips in `tests/vault.test.ts` — verify: `npm test`.
  - [ ] B3: `/lite/legal/privacy` renders logged-out — verify: curl.
  - [ ] B3: GDPR banner renders for EU IP — verify: curl.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run build` → clean.

## 10. Notes for the next-session brief writer (Wave 3 BDA-1)

B3 is the Foundation-B closing session. After B3 closes, Wave 3 (Brand DNA) opens with BDA-1.

BDA-1 must know from Foundation-B:
- `legal_doc_versions` table exists with seeded rows for terms/privacy/acceptable-use/cookie-policy (B3 seeds them; BDA-1 can reference for version hash on consent surfaces).
- `reportIssue(context)` is available from `lib/support/reportIssue.ts` — BDA wizard should surface the "Report an issue" button in its footer (via the global footer component wired in B1).
- `vault.encrypt/decrypt` is available from `lib/crypto/vault.ts` — BDA-1 does not need the vault (no third-party credentials), but BDA wizard may want to flag this for BDA-5 client invite flow.
- `INCIDENT_PLAYBOOK.md` exists — BDA-4 (gate-flip session) does not need to create it; it may add the "Brand DNA gate cleared" success scenario as a note.
- Foundation-B exit is confirmed clean — BDA-1 can proceed.
- `isAdminPath()` middleware: `/lite/legal/*` is excluded from admin gate (publicly accessible). BDA-1's onboarding route `/lite/onboarding` is already excluded. BDA-1 adds `/lite/brand-dna` or similar admin routes which ARE gated by `isAdminPath()` → brand DNA gate runs first (redirects to `/lite/onboarding` until profile is complete — BDA-1 is building that onboarding, so the gate starts as a redirect loop until BDA-3 sets `status = 'complete'`). Use `BRAND_DNA_GATE_BYPASS=true` during BDA-1/BDA-2/BDA-3 development.
