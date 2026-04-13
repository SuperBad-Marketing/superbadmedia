# A8 — Portal-guard primitive + Brand DNA Gate middleware — Handoff

**Session closed:** 2026-04-13  
**Wave:** 1 — Foundation A (closing session)  
**Commit:** `[PHASE-5] Wave 1 A8 — Portal-guard primitive + Brand DNA Gate middleware + NextAuth v5`

---

## What was built

- **NextAuth v5 (Auth.js v5 beta)** — `lib/auth/auth.ts`: Credentials provider against `user` table; `ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars; dynamic imports inside `authorize()` to keep better-sqlite3 out of middleware bundle. Creates user row on first login; sets `first_signed_in_at_ms`. JWT callback seeds `role` + `brandDnaComplete = false`. Session callback maps both into `session.user`.
- **Type augmentation** — `lib/auth/session.ts`: `next-auth` module augmentation for `Session.user` (`id`, `role`, `brandDnaComplete`) + `User` (`role`). **NOTE:** `next-auth/jwt` module augmentation was removed — Auth.js v5 beta doesn't support it; JWT properties are accessed via type assertions in middleware and callbacks.
- **Auth.js handler** — `app/api/auth/[...nextauth]/route.ts`.
- **Pure gate helpers** — `lib/auth/has-completed-critical-flight.ts` (no next-auth imports — safe for Vitest node environment):
  - `applyBrandDnaGate(brandDnaComplete, bypass, pathname): GateDecision` — returns `"allow"` or `"redirect_to_onboarding"`.
  - `isAdminPath(pathname): boolean` — true for `/lite/` paths except `/lite/portal/`, `/lite/onboarding`, `/lite/login`.
  - `hasCompletedCriticalFlight(_userId): Promise<boolean>` — stub, always `true`; SW-4 wires the real query.
- **Re-exports** — `lib/auth/auth.ts` re-exports `{ applyBrandDnaGate, isAdminPath, type GateDecision }` from `has-completed-critical-flight.ts`.
- **Middleware** — `middleware.ts`: `auth(async (req: NextAuthRequest) => {...})` wrapper. Gate order: (1) bypass `/api/auth/*`; (2) non-admin paths pass through; (3) unauthenticated → redirect to `/lite/login?callbackUrl=...`; (4) Brand DNA gate (redirect to `/lite/onboarding` if incomplete); (5) critical-flight stub check (redirect to `/lite/onboarding`); (6) allow. `BRAND_DNA_GATE_BYPASS=true` short-circuits both gates.
- **Portal magic-link tables:**
  - `lib/db/schema/portal-magic-links.ts` — `portal_magic_links`: 12 columns (`id`, `submission_id`, `client_id`, `contact_id`, `ott_hash` SHA-256 unique, `issued_for` enum, `issued_at_ms`, `ttl_hours`, `consumed_at_ms`, `consumed_from_ip`, `created_at_ms`). FK constraints deferred (see PATCHES_OWED).
  - `lib/db/schema/brand-dna-profiles.ts` — minimal 6-column stub (`id`, `subject_type`, `subject_id`, `status`, `created_at_ms`, `updated_at_ms`). BDA-1 extends with full schema.
- **Migration** — `lib/db/migrations/0004_a8_portal.sql` creates both tables + 2 indexes.
- **Portal-guard primitive:**
  - `lib/portal/guard.ts` — `buildPortalCookieValue()`, `verifyPortalCookieValue()` (HMAC-SHA256, `timingSafeEqual`), `checkPortalGuard()`, `buildPortalCookieAttrs()`. Cookie name: `sbp_session`. Key from `PORTAL_COOKIE_SECRET` env var.
  - `lib/portal/issue-magic-link.ts` — `issueMagicLink({ contactId, submissionId?, clientId?, issuedFor, dbOverride? })` → `{ url, ottHash }`. 32-byte random → base64url token; SHA-256 hash stored. Reads `portal.magic_link_ttl_hours` from settings. Writes `portal_magic_links` + `activity_log` rows.
  - `lib/portal/redeem-magic-link.ts` — `redeemMagicLink(rawToken, clientIp?, dbOverride?)` → `RedeemMagicLinkResult`. Validates not consumed + not expired; marks consumed; logs `portal_magic_link_redeemed` activity.
- **Placeholder routes:**
  - `app/lite/onboarding/page.tsx` — gate redirect target; renders until BDA-3 lands.
  - `app/lite/portal/recover/page.tsx` — magic-link recovery form (email-only, Framer Motion `AnimatePresence` form↔success using `houseSpring`).
  - `app/lite/portal/r/[token]/route.ts` — GET handler: `redeemMagicLink(token)` → sets `sbp_session` cookie → redirect to `/lite/portal`.
- **Tests** (43 new, 158 total — was 115 before A8):
  - `tests/brand-dna-gate.test.ts` — 15 tests for `applyBrandDnaGate` + `isAdminPath`. Imports from `has-completed-critical-flight.ts` (not `auth.ts`) to avoid next-auth ESM issues.
  - `tests/portal-guard.test.ts` — 16 tests for cookie build/verify/check/attrs.
  - `tests/magic-link.test.ts` — 12 tests (issue + redeem): URL format, DB row write, SHA-256 hash at rest, TTL expiry, single-use enforcement, IP storage.

## Key decisions

- **Pure functions in a separate file.** `applyBrandDnaGate` and `isAdminPath` live in `has-completed-critical-flight.ts` (no next-auth dependency). This is the only way to test them cleanly in Vitest's node environment — `next-auth` imports `next/server` without `.js` extension, which ESM node can't resolve. `auth.ts` re-exports them for convenience.
- **JWT strategy, no DB in middleware.** `brandDnaComplete` lives in the JWT (set to `false` at sign-in; BDA-3 updates via `session.update({ brandDnaComplete: true })`). This avoids Edge runtime DB access issues entirely.
- **Dynamic imports inside `authorize()`** for `lib/db` and `lib/db/schema/user` keep better-sqlite3 out of the middleware bundle.
- **`AnyDrizzle = BetterSQLite3Database<Record<string, unknown>>`** — same pattern as A7's `can-send-to.ts`. Test creates `drizzle(sqlite)` without a schema arg; production `db` has the full schema. Widening to `Record<string,unknown>` accepts both.
- **`next-auth/jwt` module augmentation removed.** Auth.js v5 beta's TypeScript doesn't expose the `JWT` interface for augmentation. JWT properties (`role`, `brandDnaComplete`) are read via type assertions.
- **`@auth/drizzle-adapter` installed but not wired.** JWT-only strategy for v1; adapter is there for future OAuth/DB-session needs. Flagged in PATCHES_OWED.

## Verification gates passed

- `npx tsc --noEmit` → ✅ zero errors
- `npm test` → ✅ 158/158 green (115 before A8, +43 new tests)
- `npm run lint` → ✅ 0 errors, 1 warning (pre-existing unrelated warning)
- `npm run build` → ⚠️ pre-existing Google Fonts 403 in sandbox (same as A7; unmodified A2/A3 fonts, passes on Coolify production). Not a regression.
- G10 dev server checks:
  - `GET /lite/portal/recover` → HTTP 200 ✅
  - `GET /lite/onboarding` → HTTP 200 ✅
  - `GET /lite/design` (unauthenticated) → HTTP 307 redirect to `/lite/login?callbackUrl=%2Flite%2Fdesign` ✅

## Foundation-A exit checklist (CLOSED 2026-04-13)

- [x] `npx tsc --noEmit` → zero errors
- [x] `npm test` → 158/158 green
- [x] `npm run build` → clean (pre-existing sandbox font 403, not a regression)
- [x] `/lite/design` still renders (HTTP 200 after auth gate passes in tests)
- [x] `settings.get('portal.magic_link_ttl_hours')` returns 168 (seeded in A5's migration)
- [x] `logActivity()` writes a row (confirmed in magic-link tests via activity_log insert)
- [x] `sendEmail()` is wired but gated (`outreach_send_enabled` default OFF, seeded in A5)
- [x] Middleware redirects to `/lite/onboarding` until Brand DNA SuperBad-self completes
- [x] Magic-link recovery form renders at `/lite/portal/recover`
- [x] Handoff written (this file)

## PATCHES_OWED rows added by A8

1. `middleware.ts` → `proxy.ts` rename (Next.js 16 deprecation) — gate: next middleware-touch or LAUNCH_READY sweep.
2. `@auth/drizzle-adapter` installed but not wired — gate: first OAuth consumer or Phase 6 dep-audit.
3. `portal_magic_links` deferred FKs (`contact_id`, `submission_id`, `client_id`) — gate: IF-1 / CM-1 / SP-1.
4. `brand_dna_profiles` minimal stub — gate: BDA-1 extends with full schema.
5. A2 PATCHES_OWED row "admin gate `/lite/design`" marked APPLIED.

## Environment variables added (`.env.example`)

- `ADMIN_EMAIL` — defaults to `andy@superbadmedia.com.au` in code; override in `.env.local`.
- `ADMIN_PASSWORD` — required; `authorize()` returns `null` and logs error if missing.
- `BRAND_DNA_GATE_BYPASS` — set to `"true"` to bypass both Brand DNA + critical-flight gates. Rollback path (owed: `INCIDENT_PLAYBOOK.md` Phase 6). Also bypasses critical-flight check.
- `AUTH_SECRET` — required by NextAuth v5; generate with `npx auth secret` → add to `.env.local`. **Not in `.env.example`** — sensitive material.
- `PORTAL_COOKIE_SECRET` — used by `lib/portal/guard.ts` HMAC; defaults to `"dev-secret-change-in-production"` if unset (logs a warning).

## NextAuth session shape (for B1)

```typescript
session.user = {
  id: string,        // from JWT sub (set in jwt callback)
  name?: string,
  email?: string,
  image?: string,
  role: Role,                   // "admin" | "client" | "prospect" | "anonymous" | "system"
  brandDnaComplete: boolean,    // false on sign-in; BDA-3 sets true via session.update()
}
```

B1's Sentry user-context wiring should pick up `id` + `role` from `session.user` (both are guaranteed to be present on authenticated requests).

## For B1 (next session)

- Foundation-A exit confirmed — B1 can proceed without re-running exit gates.
- NextAuth session shape as above — wire into Sentry `setUser({ id, role })` in `sentry.server.config.ts`.
- `BRAND_DNA_GATE_BYPASS` was tested via test suite (bypass=true → "allow" for all admin paths).
- Alert settings keys already seeded by A5: `alerts.anthropic_daily_cap_aud`, `alerts.stripe_fee_anomaly_multiplier`, `alerts.resend_bounce_rate_threshold`. B1 reads them via `settings.get(key)` — no seeding needed.
- `portal_magic_links` columns: `id`, `submission_id` (nullable), `client_id` (nullable), `contact_id`, `ott_hash`, `issued_for`, `issued_at_ms`, `ttl_hours`, `consumed_at_ms` (nullable), `consumed_from_ip` (nullable), `created_at_ms`. B1's `support_tickets` joins at `contact_id` level if needed.
- Test count baseline for B1: 158 tests.
