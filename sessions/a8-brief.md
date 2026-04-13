# A8 — Portal-guard primitive + Brand DNA Gate middleware — Session Brief

> Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** A8
- **Wave:** 1 — Foundation A (closing session — also writes Wave 2 B1/B2/B3 briefs per G11 extension)
- **Type:** INFRA
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes (prescribed tier)
- **Estimated context:** medium

## 2. Spec references

- `BUILD_PLAN.md` Wave 1 §A8 — owner block.
- `FOUNDATIONS.md` §11.8 — First-Login Brand DNA Gate semantics + critical-flight middleware layering.
- `docs/specs/intro-funnel.md` §10.1 — `portal_magic_links` table column shape (the canonical source; A8 generalises with `client_id` + nullable `submission_id`).
- `docs/specs/client-management.md` §10.1 — confirms the Client-Management reuse case for the same table.
- `docs/specs/brand-dna-assessment.md` §SuperBad-self gate behaviour — informs middleware redirect logic.
- `PATCHES_OWED.md` row "Hard ordering constraint: Brand DNA Assessment SuperBad-self before downstream consumers" (F2.b) — A8 is where the middleware lands; the gate flips when BDA-3 completes.
- `sessions/a7-handoff.md` — must be read at G0 for the email-classification enum (A8 uses `portal_magic_link_recovery`).

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md A8 + Foundation-A exit)

```
A8 — Portal-guard primitive + Brand DNA Gate middleware
- Builds: `portal_magic_links` table (columns per Intro Funnel §10.1,
  generalised with nullable `submission_id` + new `client_id` column so Client
  Management reuses it). Portal-guard primitive: session-cookie check with
  magic-link-recovery fallback form. First-Login Brand DNA Gate middleware
  (§11.8) — `brand_dna_profiles.subject_type = 'superbad_self' AND status =
  'complete'` check on every admin route; redirects to `/lite/onboarding` if
  missing; `BRAND_DNA_GATE_BYPASS=true` env-var escape hatch. Critical-flight
  middleware layering — Brand DNA gate runs first, `hasCompletedCriticalFlight`
  runs second; both self-terminate per user on completion.
- Owns: `portal_magic_links` table, `lib/portal/guard.ts`, `middleware.ts`
  (Brand DNA gate + critical flight).
- Settings keys: portal.magic_link_ttl_hours, portal.session_cookie_ttl_days.
- Rollback: env-var bypass is the rollback (documented in INCIDENT_PLAYBOOK.md,
  owed Phase 6).

Foundation-A exit (this session contributes):
  `sendEmail()` is wired but gated behind `outreach_send_enabled = false`,
  middleware redirects to `/lite/onboarding` until Brand DNA SuperBad-self
  completes, magic-link recovery form renders. Handoff written.
```

## 4. Skill whitelist

- `nextauth` — Auth.js v5 wiring, `auth()` in middleware + Server Components, session shape, role enum binding to A5's permissions module.

(Only one skill — A8 is narrowly NextAuth-flavoured. If something else surfaces, pause and patch the brief.)

## 5. File whitelist (G2 scope discipline)

- `lib/db/schema/portal-magic-links.ts` — table per Intro Funnel §10.1 + nullable `submission_id` + `client_id` column (`new`).
- `lib/db/schema/brand-dna-profiles.ts` — minimal stub for the `subject_type = 'superbad_self' AND status = 'complete'` query (BDA-1 lands the full schema in Wave 3; A8 ships only what the gate needs to compile + query) (`new`).
- `lib/db/migrations/0003_*.sql` — A8 tables (`new`).
- `lib/portal/guard.ts` — session-cookie check + magic-link-recovery fallback (`new`).
- `lib/portal/issue-magic-link.ts` — `issueMagicLink({ contactId | clientId, submissionId? })` returning a one-time URL (`new`).
- `lib/portal/redeem-magic-link.ts` — `redeemMagicLink(token)` (`new`).
- `lib/auth/auth.ts` — Auth.js v5 root config (NextAuth's session shape includes `role` from A5) (`new`).
- `lib/auth/session.ts` — `auth()` re-export + typed augmentation (`new`).
- `app/api/auth/[...nextauth]/route.ts` — Auth.js handler (`new`).
- `middleware.ts` — Brand DNA gate (first) + `hasCompletedCriticalFlight()` (second), self-terminating per user (`new`).
- `lib/auth/has-completed-critical-flight.ts` — checks the wizard-progress table for the admin critical-flight; A8 returns `true` for now (table lands in SW-1) and exposes the seam for SW-4 to wire later (`new`).
- `app/lite/onboarding/page.tsx` — placeholder route the gate redirects to until BDA-3 lands the real onboarding (`new`).
- `app/lite/portal/recover/page.tsx` — magic-link-recovery form (email-only; submits, sends a fresh OTT, neutral success) (`new`).
- `app/lite/portal/r/[token]/route.ts` — magic-link redeem endpoint that exchanges OTT for session cookie (`new`).
- `tests/portal-guard.test.ts`, `tests/brand-dna-gate.test.ts`, `tests/magic-link.test.ts` (`new`).
- `.env.example` — `BRAND_DNA_GATE_BYPASS` (default unset; truthy bypasses the gate per spec) (`edit`).
- `package.json` + lock — `next-auth@beta` (v5) + `@auth/drizzle-adapter` (`edit`).

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** `portal.magic_link_ttl_hours`, `portal.session_cookie_ttl_days` (both seeded by A5; A8 consumes in `issueMagicLink` + cookie set respectively).
- **Seeds:** none.

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] A5 + A6 + A7 closed cleanly — verify: `ls sessions/a{5,6,7}-handoff.md`.
- [ ] `settings.get('portal.magic_link_ttl_hours')` returns 168 — verify: `Grep "magic_link_ttl_hours" lib/db/migrations/`.
- [ ] `settings.get('portal.session_cookie_ttl_days')` returns 90 — verify: same.
- [ ] `lib/channels/email/send.ts` exists and accepts `classification: 'portal_magic_link_recovery'` — verify: `Grep "portal_magic_link_recovery" lib/channels/email/classifications.ts`.
- [ ] `lib/types/glossary.ts` exports `Contact` + `Client` — verify: `Grep "export type Contact\|export type Client" lib/types/glossary.ts`.
- [ ] `lib/auth/permissions.ts` exports the role enum (admin/client/prospect/anonymous/system) — verify: `Grep "export.*Role" lib/auth/permissions.ts`.
- [ ] `activity_log.kind` enum has values for `portal_magic_link_issued`, `portal_magic_link_redeemed`, `portal_session_started` — verify: `Grep` against the enum file.
- [ ] No prior NextAuth scaffolding present — verify: `ls lib/auth/ 2>/dev/null` returns nothing (avoid clobber).

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**env-var bypass is the rollback.** Setting `BRAND_DNA_GATE_BYPASS=true` clears the middleware redirect for every admin route (per spec); the magic-link side is migration-reversible as a secondary safety net. INCIDENT_PLAYBOOK.md is owed Phase 6 — A8 logs a PATCHES_OWED row to capture this rollback verbatim there.

## 9. Definition of done

- [ ] `portal_magic_links` table present with all Intro Funnel §10.1 columns + nullable `submission_id` + `client_id` — verify: `Read lib/db/schema/portal-magic-links.ts`.
- [ ] `issueMagicLink()` writes a row + returns a URL — verify: tests/magic-link.test.ts.
- [ ] `redeemMagicLink()` validates TTL + single-use, sets the session cookie — verify: tests.
- [ ] Hitting any `/lite/admin/*` route as an authed user without a complete SuperBad-self profile redirects to `/lite/onboarding` — verify: tests/brand-dna-gate.test.ts.
- [ ] Setting `BRAND_DNA_GATE_BYPASS=true` clears the redirect — verify: tests with env override.
- [ ] `/lite/portal/recover` renders the recovery form — verify: dev server + curl.
- [ ] `/lite/portal/r/[token]` exchanges a valid OTT for a session — verify: tests.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run build` → clean.
- [ ] **G10 manual browser walk:** dev server on `:3001`, hit `/lite/admin/anything` logged out → recovery form. Walk `/lite/portal/recover` form → email-success state. Confirm motion via `houseSpring` for the form transition (G5).
- [ ] Foundation-A exit checklist (per BUILD_PLAN.md): typecheck + tests + build green; `/lite/design` still renders; `settings.get('portal.magic_link_ttl_hours')` returns 168; `logActivity()` writes a row; `sendEmail()` is wired but gated. **All ticked.**
- [ ] **Wave 2 B1, B2, B3 briefs written** (G11 extension; if context too tight, split: A8 handoff covers the split + first Wave 2 session writes the briefs).

## 10. Notes for the next-session brief writer (B1 — first Wave 2 session)

A8's closing handoff writes B1 + B2 + B3 briefs (or splits per the escape hatch). Capture for B1:

- NextAuth session shape (so B1's Sentry user-context wiring picks up `id` + `role` from the right place).
- Final `portal_magic_links` columns landed (so B1 can attach `support_tickets.session_replay_url` against the right join key).
- Whether `BRAND_DNA_GATE_BYPASS` was tested (so B1's Sentry `beforeSend` doesn't suppress the bypass-detection event).
- The three new alert settings keys (`alerts.anthropic_daily_cap_aud`, `alerts.stripe_fee_anomaly_multiplier`, `alerts.resend_bounce_rate_threshold`) — already seeded by A5; B1 consumes via `settings.get()`.
- Foundation-A exit completion confirmed (so B1 doesn't accidentally re-run the exit gates).
