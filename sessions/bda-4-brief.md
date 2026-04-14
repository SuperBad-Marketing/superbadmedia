# BDA-4 — Brand DNA gate-clear via NextAuth JWT — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.

---

## 1. Identity

- **Session id:** BDA-4
- **Wave:** 3 — Brand DNA Assessment (**final session in Wave 3**)
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet) — small scoped auth-plumbing change
- **Sonnet-safe:** yes
- **Estimated context:** small

## 2. Spec references

- `FOUNDATIONS.md` §11.8 — Brand DNA gating constraint + middleware contract
- `docs/specs/brand-dna-assessment.md` §7 — completion semantics (`status='complete'` → gate clears)
- `BUILD_PLAN.md` Wave 3 §BDA-4 — session inventory
- `sessions/a8-handoff.md` — NextAuth v5 split-config pattern (`auth.config.ts` Edge-safe vs `auth.ts` Node)
- `sessions/bda-3-handoff.md` — what BDA-3 left for BDA-4 (jwt flip, session refresh, open threads)

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md BDA-4)

```
BDA-4 — SuperBad-self completion flips gate middleware to "clear";
        `hasCompletedCriticalFlight()` check continues to Setup Wizards
        critical flight on next admin nav
- Wires: NextAuth jwt callback sets token.brand_dna_complete = true when
  brand_dna_profiles has a superbad_self row with is_current=1 AND
  status='complete' for the authenticated user
- Post-reveal session refresh: reveal-client.tsx (from BDA-3) calls
  `session.update()` once markProfileComplete resolves so Andy's JWT is
  refreshed without requiring a manual sign-out
- Middleware side: `proxy.ts` Brand DNA gate is already in place (A8);
  BDA-4 verifies the gate correctly allows `/lite/admin/*` access once
  the token flips
- `hasCompletedCriticalFlight()` stays a stub returning true (SW-4 wires
  the Setup Wizards critical-flight; that work is not in scope here)
- After BDA-4: BRAND_DNA_GATE_BYPASS is no longer required for Andy's admin
  access; still useful in tests as an escape hatch
- Rollback: revert-safe — jwt callback change gated behind the existing
  `brand_dna_assessment_enabled` kill-switch so non-Brand-DNA deployments
  skip the DB query
```

## 4. Skill whitelist

- `next-auth` (v5) — jwt + session callbacks, `session.update()`, split-config Edge vs Node pattern
- `drizzle-orm` — profile lookup in jwt callback
- (No motion / sound / new UI in scope.)

## 5. File whitelist (G2 scope discipline)

**New:**
- `lib/auth/brand-dna-complete-check.ts` — `isBrandDnaCompleteForUser(userId: string, dbOverride?): Promise<boolean>`; single DB query, kill-switch gated; reused by jwt callback and tests
- `tests/brand-dna-gate-clear.test.ts` — tests for `isBrandDnaCompleteForUser` (kill-switch off, no profile, profile pending, profile complete); integration-style test of the jwt callback if feasible
- `sessions/sw-1-brief.md` — Wave 4 first session brief (per G11.b)
- `sessions/sw-2-brief.md` — Wave 4 second session brief (per G11.b)

**Edited:**
- `lib/auth/auth.ts` — jwt callback override that calls `isBrandDnaCompleteForUser(token.id)` and sets `token.brand_dna_complete`; runs on initial sign-in AND on `session.update()` trigger (check NextAuth v5 `trigger` param)
- `lib/auth/auth.config.ts` — leave the Edge-safe stub in place for middleware decode; the authoritative callback runs from `auth.ts` (Node) because it needs the DB
- `app/lite/brand-dna/reveal/reveal-client.tsx` — after `markProfileComplete` resolves, call `useSession().update()` so the client-side JWT re-mints with `brand_dna_complete=true`
- `.env.example` — annotate `BRAND_DNA_GATE_BYPASS` as "dev/test escape hatch only; production relies on the NextAuth jwt callback post-BDA-4"
- `sessions/bda-4-handoff.md` — write at close

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** none (kill-switch `brand_dna_assessment_enabled` is read, not written)
- **Seeds:** none

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] BDA-3 closed cleanly — verify: `ls sessions/bda-3-handoff.md`
- [ ] `markProfileComplete` server action exists — verify: `grep "markProfileComplete" app/lite/brand-dna/actions.ts`
- [ ] `reveal-client.tsx` fires `markProfileComplete` — verify: `grep "markProfileComplete" app/lite/brand-dna/reveal/reveal-client.tsx`
- [ ] `brand_dna_profiles.status` column exists and supports `'complete'` — verify: `grep "status.*complete" lib/db/schema/brand-dna-profiles.ts`
- [ ] `brand_dna_profiles.is_current` column exists — verify: `grep "is_current" lib/db/schema/brand-dna-profiles.ts`
- [ ] `brand_dna_profiles.subject_type` column exists with `'superbad_self'` discriminant — verify: `grep "superbad_self" lib/db/schema/brand-dna-profiles.ts`
- [ ] NextAuth v5 split-config in place — verify: `ls lib/auth/auth.config.ts lib/auth/auth.ts`
- [ ] jwt callback currently sets `brand_dna_complete = false` — verify: `grep "brand_dna_complete" lib/auth/auth.config.ts`
- [ ] session.user type augmentation exists — verify: `grep "brand_dna_complete" lib/auth/session.ts`
- [ ] `proxy.ts` Brand DNA gate reads `token.brand_dna_complete` — verify: `grep "brand_dna_complete" proxy.ts`
- [ ] `BRAND_DNA_GATE_BYPASS` env var honoured in `proxy.ts` — verify: `grep "BRAND_DNA_GATE_BYPASS" proxy.ts`
- [ ] `brand_dna_assessment_enabled` kill-switch registered — verify: `grep "brand_dna_assessment_enabled" lib/kill-switches.ts`

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated + revert-safe.** The new DB query inside the jwt callback is short-circuited when `brand_dna_assessment_enabled=false`, so non-Brand-DNA deployments pay no cost. Rolling back is a single-file revert of `lib/auth/auth.ts`; BDA-4 introduces no schema change. The pre-BDA-4 escape hatch (`BRAND_DNA_GATE_BYPASS=true`) stays functional as a belt-and-braces safety.

## 9. Definition of done

- [ ] `isBrandDnaCompleteForUser` returns `true` only when a superbad_self + `is_current=1` + `status='complete'` row exists for the given user
- [ ] jwt callback in `lib/auth/auth.ts` sets `token.brand_dna_complete` correctly on both initial sign-in and on `session.update()` trigger
- [ ] `reveal-client.tsx` calls `session.update()` post-completion (verify: `grep "update()" app/lite/brand-dna/reveal/reveal-client.tsx`)
- [ ] Manual curl against `/lite/admin` with a completed profile + valid session cookie returns 200 (not 307 to `/lite/onboarding`) without `BRAND_DNA_GATE_BYPASS=true`
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green (≥ 238 + new)
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean (with `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=.font-mock.json` per BDA-2 handoff)
- [ ] G-gates G0–G12 run end-to-end with a clean handoff written

## 10. Notes for the next-session brief writer (Wave 4 SW-1, SW-2)

BDA-4 is the last session in Wave 3. Per G11.b, BDA-4 owes **two** fresh briefs to start Wave 4 rolling:

- **SW-1 (INFRA, medium):** `wizard_progress`, `wizard_completions`, `integration_connections` tables; shell chrome; `WizardDefinition` TS interface. Depends on A3 (UI primitives), A5 (settings), A6 (`logActivity`). No new cron; no LLM calls; no Brand DNA reads.
- **SW-2 (FEATURE, large):** 10 step-types — form, oauth-consent, api-key-paste, webhook-probe, dns-verify, csv-import, async-check, content-picker, review-and-confirm, celebration. Depends on SW-1. Celebration step-type consumes Tier 2 choreography slot 2 (`wizard-complete` — already registered in A4's choreography baseline).

Setup-wizards spec lives at `docs/specs/setup-wizards.md`. SW-5 is where the integration wizards land (Stripe, Resend, Graph API, Pixieset, etc.) — that's a large session and should not bleed into SW-1/SW-2 scope.
