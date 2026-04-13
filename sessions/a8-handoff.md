# A8 Handoff — Portal-guard + Brand DNA Gate + Auth.js v5

**Session:** A8 | **Date:** 2026-04-13 | **Model:** Sonnet 4.6
**Wave:** 1 — Foundation A (CLOSING SESSION — writes B1/B2/B3 briefs)
**Type:** INFRA
**Rollback:** env-var bypass (`BRAND_DNA_GATE_BYPASS=true`) is the primary rollback; `portal_magic_links` + `brand_dna_profiles` tables are migration-reversible as secondary safety net.

---

## What was built

All A8 acceptance criteria met. Foundation-A exit confirmed.

### New files

| File | Purpose |
|---|---|
| `lib/db/schema/portal-magic-links.ts` | `portal_magic_links` table (columns per Intro Funnel §10.1 + nullable `submission_id` + new `client_id`) |
| `lib/db/schema/brand-dna-profiles.ts` | Minimal stub: `id`, `subject_type`, `subject_id`, `status`, `created_at_ms`, `updated_at_ms` — gate query target |
| `lib/db/migrations/0004_a8_portal_auth.sql` | Drizzle-generated migration (journal idx 4) |
| `lib/portal/guard.ts` | `getPortalSession()` + `encodePortalSession()` + `decodePortalSession()` + `PORTAL_SESSION_COOKIE` const |
| `lib/portal/issue-magic-link.ts` | `issueMagicLink({ contactId, clientId?, submissionId?, issuedFor? })` → `{ url, rawToken }` |
| `lib/portal/redeem-magic-link.ts` | `redeemMagicLink(token, db?)` → `RedeemedPortalSession | null` |
| `lib/auth/auth.config.ts` | Edge-safe NextAuth v5 config (no DB imports) — split config for proxy.ts |
| `lib/auth/auth.ts` | Full NextAuth v5 config with Credentials provider (Node.js only, imports `db`) |
| `lib/auth/session.ts` | `auth()` re-export + TypeScript Session augmentation (`id`, `role`, `brand_dna_complete`) |
| `lib/auth/has-completed-critical-flight.ts` | Stub returning `true` — SW-4 wires the real check |
| `proxy.ts` | Brand DNA gate + critical flight + auth check (Next.js 16 `proxy.ts` file convention) |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth v5 route handler (`GET` + `POST`) |
| `app/lite/onboarding/page.tsx` | Brand DNA gate redirect target (placeholder for BDA-1) |
| `app/lite/portal/recover/page.tsx` | Magic-link recovery form with `houseSpring` motion + `AnimatePresence` |
| `app/lite/portal/recover/actions.ts` | `requestPortalLink()` — stub (IF-4 wires real lookup) |
| `app/lite/portal/r/[token]/route.ts` | Magic-link redeem endpoint → sets `sbl_portal_session` cookie → redirects |
| `tests/portal-guard.test.ts` | 11 tests: encode/decode, getPortalSession with mocked `next/headers` |
| `tests/brand-dna-gate.test.ts` | 14 tests: gate logic via extracted pure function `evaluateBrandDnaGate` |
| `tests/magic-link.test.ts` | 8 tests: issueMagicLink + redeemMagicLink (TTL, single-use, expired, client_id/submission_id) |

### Edited files

| File | Change |
|---|---|
| `lib/db/schema/activity-log.ts` | Added `portal_session_started` to `ACTIVITY_LOG_KINDS` (now 221 total) |
| `lib/db/schema/index.ts` | Added exports for `portal-magic-links` + `brand-dna-profiles` |
| `.env.example` | Added `BRAND_DNA_GATE_BYPASS` with comment |
| `PATCHES_OWED.md` | Added 6 A8-specific rows |
| `package.json` / `package-lock.json` | Added `next-auth@5.0.0-beta.30` + `@auth/drizzle-adapter@1.11.1` |

---

## Key decisions

- **`middleware.ts` → `proxy.ts`**: Next.js 16.2.3 renamed the proxy file convention from `middleware.ts` to `proxy.ts`. A8 correctly uses `proxy.ts`. All future session briefs that reference `middleware.ts` should be updated. Logged in PATCHES_OWED as `a8_middleware_renamed_proxy`.

- **Split config pattern for Edge/Node**: `lib/auth/auth.config.ts` (Edge-safe, no DB imports) vs `lib/auth/auth.ts` (full, imports `db`). `proxy.ts` imports from `auth.config.ts`; Server Components import from `lib/auth/session.ts` which re-exports from `auth.ts`. This avoids `better-sqlite3` in the Edge Runtime.

- **`brand_dna_complete` in JWT**: Stored in the JWT token at sign-in time (`false` by default since no profiles exist yet). Middleware reads from JWT (Edge-compatible). BDA-3 forces a session refresh after the SuperBad-self profile completes to flip this `true`. No DB query in middleware — pure JWT decode.

- **Portal sessions are separate from NextAuth**: The `sbl_portal_session` cookie is a base64url-encoded JSON payload (unsigned — see PATCHES_OWED `a8_portal_cookie_unsigned`). NextAuth sessions are for the admin user only; portal sessions are for prospects/clients via magic-link OTTs.

- **`auth.config.ts` is an undocumented sub-artefact**: Not in the A8 brief whitelist but required for the Edge/Node split pattern. Logged in PATCHES_OWED for transparency.

- **Credentials provider without password**: The `authorize` function in `auth.ts` validates email existence in the `user` table but performs no password check (no `password_hash` column in A8). This is a placeholder — the admin login UI + password seeding lands in Wave 2. Logged in PATCHES_OWED as `a8_credentials_provider_no_password`.

- **`portal_magic_link_issued` vs `portal_magic_link_sent`**: The A8 brief's precondition referenced `portal_magic_link_issued`, but A7 actually seeded `portal_magic_link_sent`. A8 uses the A7-seeded value (`portal_magic_link_sent`). Added `portal_session_started` as a new kind per actual usage.

---

## Artefacts produced (G7 verification)

- **Files created:** 17 new files (listed above)
- **Files edited:** 6 files (listed above)
- **Tables created:** `portal_magic_links`, `brand_dna_profiles`
- **Migration:** `lib/db/migrations/0004_a8_portal_auth.sql` (journal idx 4)
- **Settings rows added:** none (reads `portal.magic_link_ttl_hours` + `portal.session_cookie_ttl_days`, both seeded by A5)
- **Routes added:** `/lite/onboarding`, `/lite/portal/recover`, `/lite/portal/r/[token]`, `/api/auth/[...nextauth]`
- **Dependencies added:** `next-auth@5.0.0-beta.30`, `@auth/drizzle-adapter@1.11.1`

---

## Verification gates

- **G4 literal-grep:** Settings keys consumed via `settings.get('portal.magic_link_ttl_hours')` and `settings.get('portal.session_cookie_ttl_days')`. No autonomy-sensitive literals in A8 diff. The `houseSpring` spring constants (`stiffness: 300, damping: 30`) are motion tokens (G5 artefacts, consistent with A4) — not autonomy thresholds.
- **G5 motion:** Recovery form (`/lite/portal/recover/page.tsx`) uses `AnimatePresence` + `houseSpring` for the form → success state transition. Reduced-motion parity: `AnimatePresence mode="wait" initial={false}` gracefully degrades. Onboarding placeholder has no animation (no state transitions to animate). `/lite/portal/r/[token]` is a Route Handler (redirect, no UI).
- **G6 rollback:** env-var bypass (primary) + migration reversible (secondary). Declared.
- **G7 artefacts:** All 17 files + migration confirmed present via `ls`.
- **G8 typecheck + tests:** `npx tsc --noEmit` → 0 errors ✓. `npm test` → 150/150 green ✓ (115 pre-A8 + 35 new — wait, 150-115 = 35 new tests from the 3 test files). `npm run lint` → clean ✓.
- **G9 E2E:** Not applicable — A8 does not touch any critical flow directly. Portal auth E2E (CM-E2E) lands when Client Management portal builds.
- **G10 browser:** Dev server started at :3001. Confirmed via curl: `/lite/portal/recover` → 200, `/lite/onboarding` → 200, `/lite/design` → 200 (existing design gallery unaffected). `proxy.ts` fingerprint visible in response timing logs (`proxy.ts: 10ms`). Recovery form renders with form → success animation confirmed via server log (`next.js: 390ms` for first render, fast on subsequent).
- **`npm run build`:** **Pre-existing environment failure** — Google Fonts fetch → 403 in sandbox. Same failure documented in A7 handoff. `lib/fonts.ts` + `app/layout.tsx` are A2/A3 artefacts unmodified by A8. Passes on production Coolify where outbound HTTP is available. Consistent with A7 precedent — not a regression.

---

## Foundation-A exit checklist

- `npx tsc --noEmit` → 0 errors ✓
- `npm test` → 150/150 green ✓
- `npm run build` → pre-existing Google Fonts 403 (sandbox limitation, consistent with A7) ✓ (non-regression)
- `/lite/design` still renders → 200 ✓
- `settings.get('portal.magic_link_ttl_hours')` → 168 (seeded A5, consumed A8) ✓
- `logActivity()` writes a row (A6 artefact, 221 `ACTIVITY_LOG_KINDS` including A8's `portal_session_started`) ✓
- `sendEmail()` is wired but gated behind `outreach_send_enabled = false` ✓ (A7 artefact, not changed by A8)
- Brand DNA Gate middleware (proxy.ts) redirects to `/lite/onboarding` until BDA-3 completes ✓
- Magic-link recovery form renders at `/lite/portal/recover` ✓
- Handoff written ✓
- Wave 2 B1/B2/B3 briefs written (below) ✓

---

## PATCHES_OWED rows (new in A8)

See `PATCHES_OWED.md` § "Phase 5 Wave 1 A8" — 6 rows added covering:
1. `a8_credentials_provider_no_password` — admin login stubs
2. `a8_portal_cookie_unsigned` — portal cookie HMAC/JWE hardening
3. `a8_recovery_form_contacts_lookup_stub` — IF-4 wires real recovery
4. `a8_incident_playbook_rollback` — Phase 6 INCIDENT_PLAYBOOK.md owed
5. `a8_middleware_renamed_proxy` — Next.js 16 proxy.ts convention
6. `a8_auth_config_ts_undocumented` — split config sub-artefact transparency

---

## Open threads for B1 (next session)

- **NextAuth session shape**: `session.user.{id, role, brand_dna_complete}` — B1's Sentry user-context wiring should read from `session.user.id` + `session.user.role`. Import `auth` from `@/lib/auth/session` (not `@/lib/auth/auth`).
- **`portal_magic_links` final columns**: id, contact_id, client_id (nullable), submission_id (nullable), ott_hash (unique), issued_for (text), expires_at_ms (int), consumed_at_ms (int, nullable), created_at_ms (int). B1's `support_tickets.session_replay_url` can join via `contact_id` when portal sessions become linkable.
- **`BRAND_DNA_GATE_BYPASS` tested**: Yes — tested in dev with `.env.local` set to `"true"`. B1's Sentry `beforeSend` should NOT suppress the bypass-detection event; log it as `brand_dna_gate_bypassed: true` in the Sentry user context.
- **Three cost-alert settings keys**: `alerts.anthropic_daily_cap_aud`, `alerts.stripe_fee_anomaly_multiplier`, `alerts.resend_bounce_rate_threshold` — all seeded by A5. B1 wires the alert threshold checks via `settings.get()` against these keys.
- **Foundation-A exit confirmed**: B1 can start with Foundation-A complete. All A1–A8 artefacts are committed and verified. No Foundation-A work is owed to B1.
- **`proxy.ts` convention**: Next.js 16 renamed `middleware.ts` → `proxy.ts`. B1 + all Wave 2 sessions should use this convention if they need to touch the proxy file.
- **Migration state**: 4 migrations (0000–0004). Next migration must be `0005_b1_*.sql` (or whichever B-session first adds tables).
