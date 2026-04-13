# B3 — Legal pages + cookie consent — Session Brief

> Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0 + §G11.b rolling cadence.
> Written by A8 (Wave 1 closing session) against current repo state 2026-04-13.
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** B3
- **Wave:** 2 — Foundation B (closing session)
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes (prescribed tier)
- **Estimated context:** large

## 2. Spec references

- `BUILD_PLAN.md` Wave 2 §B3 — owner block (full description).
- `FOUNDATIONS.md` §13 — legal/compliance context.
- `lib/db/schema/legal-doc-versions.ts` — A7 artefact; B3 reads this table, does not recreate it.
- `docs/specs/quote-builder.md` §QB-4 — ToS acceptance tickbox consumer (forward reference).
- `docs/specs/saas-subscription-billing.md` §SB-5 — subscriber ToS acceptance (forward reference).

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md B3)

```
B3 — Legal pages + cookie consent
- Draft docs/specs/legal-pages.md spec inline (Stop 14 L1): covers the
  five document types (privacy_policy, terms_of_service, client_agreement,
  subscriber_tos, cookie_policy), DSR process, and cookie category taxonomy.
- /lite/legal/{terms,privacy,acceptable-use,cookie-policy,index} static
  pages — LLM-drafted placeholder content with Andy approve-once caveat
  (feedback_no_content_authoring). Pages render for logged-out visitors
  (no auth required). Use design tokens (A2) + A3 primitives for layout.
- legal_doc_versions table already exists (A7 artefact). B3 inserts the
  initial version rows (one per doc type, version "1.0.0",
  effective_from_ms = 2026-01-01T00:00:00Z epoch) via the B3 migration.
- GDPR cookie-consent banner: geo-gated. MaxMind lookup → EU IPs get
  full reject-all / accept-all / manage-categories banner.
  Non-EU visitors get a permanent footer strip: "We use cookies — details"
  linking to /lite/legal/cookie-policy.
  Technical call (no Andy question): evaluate @maxmind/geoip2-node vs
  ip-api fallback vs rolled-your-own. Pick one, document decision in
  handoff.
- cookie_consents audit table for EU traffic (id, visitor_id, ip_country,
  accepted_categories, rejected_categories, banner_version, created_at_ms).
  visitor_id = localStorage uuid echoed to DB on consent action.
- Consent state stored in localStorage (key: sbl_cookie_consent). On
  consent action, POST to /api/cookie-consent to echo to DB.
- Klaro vs rolled-your-own evaluation: technical call inside session.
  Klaro is ~14 kB gzipped, well-maintained; rolled-your-own avoids the
  dependency. Pick one, document decision in handoff.
- Settings keys added to seed: legal.dsr_email (Andy's DSR intake address),
  legal.dsr_response_days (default 30, integer). Use INSERT OR IGNORE
  pattern in B3 migration (same pattern as 0001_seed_settings.sql).
- lib/auth/permissions.ts: /lite/legal/* routes marked public (anonymous
  access allowed) so logged-out visitors can read legal pages.
- npx tsc --noEmit → zero errors.
- npm test → green.
- npm run lint → clean.
```

## 4. Skill whitelist

(No skill needed — B3 is static pages + SQLite schema + a geo-check lib. Standard patterns.)

## 5. File whitelist (G2 scope discipline)

- `docs/specs/legal-pages.md` — inline spec (`new`)
- `lib/db/schema/cookie-consents.ts` — `cookie_consents` table (`new`)
- `lib/db/migrations/0006_b3_legal.sql` — B3 migration: creates `cookie_consents`, inserts initial `legal_doc_versions` rows, seeds `legal.dsr_email` + `legal.dsr_response_days` (`new`)
- `lib/db/schema/index.ts` — add `cookie-consents` export (`edit`)
- `lib/geo/eu-check.ts` — `isEuIp(ip: string): Promise<boolean>` helper (`new`)
- `app/lite/legal/layout.tsx` — shared layout for legal pages (no auth wrapper) (`new`)
- `app/lite/legal/page.tsx` — index: links to all five documents (`new`)
- `app/lite/legal/terms/page.tsx` — Terms of Service (`new`)
- `app/lite/legal/privacy/page.tsx` — Privacy Policy (`new`)
- `app/lite/legal/acceptable-use/page.tsx` — Acceptable Use Policy (`new`)
- `app/lite/legal/cookie-policy/page.tsx` — Cookie Policy (`new`)
- `components/lite/cookie-banner.tsx` — GDPR banner + non-EU footer strip (`new`)
- `app/api/cookie-consent/route.ts` — POST endpoint to echo consent to DB (`new`)
- `lib/auth/permissions.ts` — add `/lite/legal/*` public rule (`edit`)
- `lib/env.ts` — no new vars needed unless MaxMind requires a license key (`edit` only if needed)
- `.env.example` — add `MAXMIND_LICENSE_KEY` if geo lib requires it (`edit` only if needed)
- `tests/cookie-consent.test.ts` — unit tests for `isEuIp()` + consent round-trip (`new`)
- `package.json` + lock — add geo-check package if npm dep is chosen (`edit` only if needed)

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** none (B3 seeds new keys, no existing keys consumed).
- **Seeds (new keys — INSERT OR IGNORE in 0006_b3_legal.sql):**
  - `legal.dsr_email` — string, default `"privacy@superbadmedia.com.au"`, description "Data Subject Request intake address"
  - `legal.dsr_response_days` — integer, default `30`, description "Statutory DSR response window (days)"

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] B2 closed cleanly — verify: `ls sessions/b2-handoff.md`
- [ ] `legal_doc_versions` schema exists (A7 artefact) — verify: `ls lib/db/schema/legal-doc-versions.ts`
- [ ] A3 design primitives exist — verify: `ls components/ui/button.tsx` (or any shadcn component)
- [ ] B1 Sentry wired (SENTRY_DSN in env.ts) — verify: `grep "SENTRY_DSN" lib/env.ts`
- [ ] No prior `cookie_consents` schema — verify: `ls lib/db/schema/cookie-consents.ts 2>/dev/null` returns nothing
- [ ] No prior `docs/specs/legal-pages.md` — verify: `ls docs/specs/legal-pages.md 2>/dev/null` returns nothing
- [ ] `legal.dsr_email` not yet seeded — verify: `grep "dsr_email" lib/db/migrations/0001_seed_settings.sql` returns nothing

## 8. Rollback strategy (G6)

**git-revertable, no data shape change for live feature code** — `cookie_consents` is a new table (migration reversible). Legal pages are static React components (git-revertable). Cookie banner is client-only rendering; disabling it requires deleting the `<CookieBanner />` mount from `app/layout.tsx` — one line. Geo-check lib (if npm dep) can be removed with `npm uninstall` and `isEuIp` stub returns `false` (everyone gets non-EU treatment — banner degrades to footer strip).

## 9. Definition of done

- [ ] `docs/specs/legal-pages.md` present — verify: `ls docs/specs/legal-pages.md`
- [ ] `cookie_consents` table created — verify: `grep "cookie_consents" lib/db/schema/cookie-consents.ts`
- [ ] Initial `legal_doc_versions` rows in migration — verify: `grep "legal_doc_versions" lib/db/migrations/0006_b3_legal.sql`
- [ ] `legal.dsr_email` seeded — verify: `grep "dsr_email" lib/db/migrations/0006_b3_legal.sql`
- [ ] `/lite/legal/privacy` route created — verify: `ls app/lite/legal/privacy/page.tsx`
- [ ] `/lite/legal/*` marked public in permissions — verify: `grep "legal" lib/auth/permissions.ts`
- [ ] `CookieBanner` component created — verify: `ls components/lite/cookie-banner.tsx`
- [ ] Geo/EU-check helper created — verify: `ls lib/geo/eu-check.ts`
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run lint` → clean
- [ ] Dev server: `curl http://localhost:3001/lite/legal/privacy` → 200 without auth cookie

## 10. Notes for the next-session brief writer (BDA-1)

B3 closes Wave 2 Foundation B. BDA-1 opens Wave 3.

- `legal_doc_versions` rows now seeded — BDA-1 can reference the `terms_of_service` version when wiring ToS acceptance on the Brand DNA invite flow (forward reference only; BDA-1 itself does not implement ToS acceptance, that's QB-4).
- `cookie_consents` table exists — BDA-1 does not need to touch it.
- `/lite/legal/*` routes are public — BDA-1's onboarding flow can link to them freely.
- `lib/geo/eu-check.ts` exists — BDA-1 can re-use it if it needs EU-gated behaviour (unlikely, but available).
- Geo-check dependency decision logged in B3 handoff — review before adding any new geo deps.
- **Klaro vs rolled-your-own decision** logged in B3 handoff — BDA-1 does not need to re-evaluate.
- Migration state after B3: 7 migrations (0000–0006). BDA-1's migration should be `0007_bda1_*.sql` (BDA-1 creates `brand_dna_answers`, `brand_dna_blends`, `brand_dna_invites` — `brand_dna_profiles` already exists from A8).
- `INCIDENT_PLAYBOOK.md` stub created by B2 — BDA-1 can extend it if needed, but no obligation.
- Wave 2 Foundation-B exit criteria (typecheck + test + browser for all three B sessions + Litestream restore drill + vault round-trip + `/lite/legal/privacy` visible to logged-out visitors) must be confirmed in B3 handoff before BDA-1 starts.
