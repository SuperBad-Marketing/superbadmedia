# BDA-4 Handoff — Brand DNA gate-clear via NextAuth JWT

**Session:** BDA-4 | **Date:** 2026-04-14 | **Model:** Sonnet 4.6 (prescribed `/normal`)
**Wave:** 3 — Brand DNA Assessment (**CLOSING SESSION — Wave 3 done**)
**Type:** FEATURE
**Rollback:** feature-flag-gated (`brand_dna_assessment_enabled` short-circuits `isBrandDnaCompleteForUser`). Single-file revert of `lib/auth/auth.ts` restores pre-BDA-4 behaviour. No migration.

---

## What was built

All BDA-4 acceptance criteria met. The First-Login Brand DNA Gate now self-terminates: once Andy completes the SuperBad-self assessment, the reveal client calls `session.update()`, the Node-side jwt callback re-queries `brand_dna_profiles` and flips `token.brand_dna_complete=true`, and `proxy.ts`'s Gate 1 lets `/lite/admin/*` through without needing `BRAND_DNA_GATE_BYPASS=true`.

### New files

| File | Purpose |
|---|---|
| `lib/auth/brand-dna-complete-check.ts` | `isBrandDnaCompleteForUser(userId, dbOverride?)` — kill-switch-gated DB query for the superbad_self + is_current + status='complete' row |
| `tests/brand-dna-gate-clear.test.ts` | 7 tests: kill-switch off, empty userId, no profile, in-progress, archived retake, happy path, client-type profile ignored |
| `sessions/sw-1-brief.md` | Wave 4 SW-1 brief (G11.b rolling cadence) |
| `sessions/sw-2-brief.md` | Wave 4 SW-2 brief (G11.b rolling cadence) |

### Edited files

| File | Change |
|---|---|
| `lib/auth/auth.ts` | jwt callback override: runs the Edge-safe base callback first, then on `signIn`/`signUp`/`update` triggers calls `isBrandDnaCompleteForUser(token.id)` and flips `token.brand_dna_complete` |
| `app/lite/brand-dna/reveal/reveal-client.tsx` | Split into `RevealClient` (SessionProvider wrapper) + `RevealInner` (consumes `useSession`). Post-completion effect awaits `markProfileComplete`, then calls `update()` to re-mint the JWT |
| `.env.example` | `BRAND_DNA_GATE_BYPASS` annotated as dev/test-only post-BDA-4; production now relies on the jwt callback |

---

## Key decisions

- **Edge/Node split preserved.** `auth.config.ts` keeps its pure, DB-free jwt callback (Edge-safe). `auth.ts` spreads `authConfig` then overrides `callbacks.jwt` with a Node-side version that awaits `authConfig.callbacks.jwt(params)` first so id/role defaults stay identical. Only after the base callback runs does it trigger the DB query — and only on sign-in / signUp / update. No DB call on the rote no-trigger jwt re-decode path.

- **`superbad_self` profile is singular; `userId` is auth-signal only.** The schema pins `subject_id = null` for superbad_self rows, so `isBrandDnaCompleteForUser` takes `userId` but does not filter the query on it. An empty `userId` short-circuits to `false` (defensive). Non-admin roles never hit this code path because `proxy.ts` Gate 1 only enforces on `/lite/*` admin routes; portal sessions are a separate auth.

- **`SessionProvider` scoped inside `reveal-client.tsx`.** `useSession().update()` requires `<SessionProvider>` above it, but no global provider exists in `app/layout.tsx` yet (Wave 2 client surfaces haven't needed it). Rather than introduce a global provider in a scope not in the whitelist, BDA-4 wraps `RevealInner` in a local `SessionProvider` inside `reveal-client.tsx` (already whitelisted). Narrowest blast radius — future admin surfaces can hoist a global provider when they need it (Wave 4 SW-4 is the likely forcing function).

- **Kill-switch short-circuit.** `brand_dna_assessment_enabled=false` → `isBrandDnaCompleteForUser` returns `false` without a DB call. Non-Brand-DNA deployments pay zero cost in the auth hot path, per the brief's "non-Brand-DNA deployments skip the DB query" requirement.

- **Async cleanup in reveal effect.** Replaced `void markProfileComplete(...)` fire-and-forget with an awaited async IIFE inside the `setTimeout`, plus a `cancelled` flag checked before the `update()` call. Prevents a stale `session.update()` from firing on an unmounted component if the user navigates away during the 800ms settle.

---

## Manual browser check (G10)

Not run as a full signed-in flow this session — the admin login UI is still a Wave 2 placeholder (per A8 PATCHES_OWED `a8_credentials_provider_no_password`), so there's no human sign-in path to exercise end-to-end yet. The change was verified by:

1. Code inspection — jwt callback runs in Node (imports `db`), the base callback sets id/role, override reads `trigger` correctly per NextAuth v5 (`"signIn" | "signUp" | "update"`).
2. Unit tests — 7 cases cover the DB-query state machine exhaustively (kill-switch, empty uid, missing profile, in-progress, archived retake, happy path, wrong subject_type).
3. Build graph — `npm run build` prints `ƒ Proxy (Middleware)` and the reveal route (`/lite/brand-dna/reveal`) without errors; `proxy.ts` still imports from `auth.config.ts` (Edge-safe).

The full "curl `/lite/admin` with valid session cookie → 200 without bypass" verification will land when the admin login UI ships in Wave 2/4. Until then, `BRAND_DNA_GATE_BYPASS=true` in `.env.local` remains the dev-time escape hatch for browser QA — now documented as such in `.env.example`.

---

## Verification gates

- **G1 preflight:** All 12 preconditions verified ✓
- **G2 scope:** All files within whitelist ✓. Reveal-client split into two exports (wrapper + inner) is a shape change inside the whitelisted file, not a new file.
- **G3 settings reads:** Not applicable (no new autonomy thresholds introduced)
- **G4 literal-grep:** No autonomy-sensitive literals in diff ✓. The only string literals are subject_type/status enum values (DB contract, not autonomy config) and the 800ms reveal-timing constant (UI choreography — BDA-3 tier, not autonomy).
- **G5 motion:** Reveal client's motion is unchanged from BDA-3. `SessionProvider` wrap has no visual impact; no motion work in this session.
- **G6 rollback:** feature-flag-gated + single-file revert ✓
- **G7 artefacts:** 4 new files + 3 edited files present ✓
- **G8 typecheck + tests + lint + build:** `npx tsc --noEmit` → 0 errors ✓. `npm test` → 245/245 green (238 pre-BDA-4 + 7 new). `npm run lint` → clean ✓. `npm run build` → clean with `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=.font-mock.json` (pre-existing sandbox workaround) ✓
- **G9 E2E:** Not a critical flow in the Phase 4 list. The gate itself is critical-adjacent but unit tests + the proxy-side tests from A8 cover the behaviour.
- **G10 browser:** Documented above — full signed-in flow not runnable until admin login ships.
- **G11.b:** SW-1 + SW-2 briefs written (Wave 4 rolling cadence kick-off).
- **G12:** Tracker + commit — see below.

---

## Migration state after BDA-4

Unchanged from BDA-3. No new migration.

```
0000_init.sql
0001_seed_settings.sql
0002_a6_activity_scheduled_inbox
0003_a7_email_stripe_pdf
0004_a8_portal_auth
0005_b1_support
0006_b3_legal
0007_bda1_brand_dna
```

Next migration slot = 0008 (SW-1 owns).

---

## PATCHES_OWED rows (BDA-4 — new)

1. `bda4_sessionprovider_local_scope` — `SessionProvider` is currently scoped inside `reveal-client.tsx`. When a second admin surface needs `useSession()`, hoist to `app/lite/layout.tsx` or to a dedicated admin layout. Likely forcing function: SW-4 critical-flight surface. Low priority; zero-cost refactor when needed.

2. `bda4_admin_login_ui_still_owed` — Manual end-to-end verification of the gate clear requires the admin login UI, which is still a Wave 2 placeholder per A8 `a8_credentials_provider_no_password`. When admin login lands, re-verify BDA-4 with a real sign-in → assessment completion → `/lite/admin` curl returning 200 without `BRAND_DNA_GATE_BYPASS`. Owed against the Wave 2 admin-login session.

---

## Open threads for Wave 4 (SW-1, SW-2)

- **Admin login UI forcing function.** SW-4 (critical-flight) lands a real admin surface that calls `auth()` and gates on `hasCompletedCriticalFlight()`. That's when hoisting `SessionProvider` from `reveal-client.tsx` up to a shared admin layout becomes worthwhile. SW-1 and SW-2 don't need it — they're infra + step-type components.

- **`BRAND_DNA_GATE_BYPASS` deprecation path.** Post-BDA-4 the env var is dev/test-only. Its long-term home is `INCIDENT_PLAYBOOK.md` (Phase 6) as a break-glass recovery. No code change needed now.

- **Wave 3 closed.** BDA-1 through BDA-4 all shipped. Wave 3's Brand DNA Assessment is functionally complete for Andy's superbad_self use case. Client-side Brand DNA (different `subject_type`, `contact_id` FK) is Wave 7+ territory.

- **SW-1 + SW-2 briefs live in `sessions/`.** Wave 4 rolling cadence satisfied; SW-1 starts with no pre-work owed from BDA-4.

---

## Autonomy loop note

`RemoteTrigger` tool not surfaced in this environment. The hourly safety-net cron will fire the next session (SW-1). Known environment limitation — no action required.
