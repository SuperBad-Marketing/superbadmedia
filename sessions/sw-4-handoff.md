# SW-4 Handoff — Admin critical-flight sequencer

**Session:** SW-4 | **Date:** 2026-04-14 | **Model:** Sonnet 4.6 (`/normal` per brief)
**Wave:** 4 — Setup Wizards
**Type:** FEATURE
**Rollback:** feature-flag-gated. `setup_wizards_enabled` (SW-2's kill-switch) — when off, `hasCompletedCriticalFlight` short-circuits to true, gate 2 no-ops, `/lite/first-run` renders capstone without redirecting into nonexistent wizard routes. Revert = restore the stub + delete new files; no schema + no migration.

---

## What was built

All SW-4 acceptance criteria met. Admins now gate on critical-flight completion after Brand DNA clears.

### New files

| File | Purpose |
|---|---|
| `lib/wizards/critical-flight.ts` | `getCriticalFlightStatus(userId, dbOverride?)` — reads `wizards.critical_flight_wizards` + `wizard_completions`, returns `{ ordered, completedKeys, remaining }`. `nextCriticalWizardKey()` returns the ordered head of `remaining` or `null`. Injectable db for tests (matches verify-completion / brand-dna pattern). |
| `app/lite/first-run/page.tsx` | Server Component. `auth()` → `redirect("/lite/login")` if no session. When `setup_wizards_enabled` is on, calls `nextCriticalWizardKey()` → 302 to `/lite/setup/critical-flight/<key>` (routes land SW-5+). When off (or complete), renders capstone. |
| `app/lite/first-run/capstone.tsx` | Client Component. Motion `motion.div` reads `tier2["wizard-complete"]` directly (SW-2's SSOT precedent). Placeholder copy "SuperBad is open for business." per spec §8.3 — content mini-session calibrates later. `Link` styled via `buttonVariants()` because the project's `Button` has no `asChild` (SW-2 decision). |
| `tests/critical-flight.test.ts` | 7 tests — ordered remaining, per-user isolation, partial completion tail, full completion, duplicate-row tolerance (spec §6.1 permits), `nextCriticalWizardKey` progression + null sentinel. |
| `tests/has-completed-critical-flight.test.ts` | 4 tests — kill-switch-off short-circuit, kill-switch-on partial miss, kill-switch-on all-complete, empty-userId false. |
| `sessions/sw-4-handoff.md` | This file. |
| `sessions/sw-5-brief.md` | Pre-compiled per G11.b. Scopes SW-5 to the first consumer wizard (`stripe-admin`) + admin-first-run WizardDefinition. |

### Edited files

| File | Change |
|---|---|
| `lib/auth/has-completed-critical-flight.ts` | Stub → real. Kill-switch gated (`setup_wizards_enabled`); short-circuits to true when off. Delegates to `getCriticalFlightStatus()`. Accepts `dbOverride` for hermetic tests. |
| `proxy.ts` | Gate 2 wired. Reads `req.auth.user.critical_flight_complete` from the JWT and redirects incomplete admins to `/lite/first-run`, allowlisting that path itself to prevent a redirect loop. |
| `lib/auth/auth.config.ts` | Edge-safe JWT + session callback extended: `token.critical_flight_complete = false` at sign-in; session mirrors from token. Off-whitelist but contemporaneous (see §Key decisions). |
| `lib/auth/auth.ts` | Node-side `jwt()` override now also refreshes `token.critical_flight_complete` via `hasCompletedCriticalFlight(userId)` on signIn / signUp / session.update() — mirrors BDA-4's `brand_dna_complete` pattern. |
| `lib/auth/session.ts` | Module augmentation: `session.user.critical_flight_complete: boolean`. |

---

## Key decisions

- **Gate-2 check lifted into the JWT, not the middleware.** The A8 comment in proxy.ts explicitly named this path. `hasCompletedCriticalFlight` touches `better-sqlite3` — can't run in the Edge runtime. Node-side jwt callback refreshes on signIn / signUp / session.update() (same trigger set as BDA-4's brand_dna_complete). Edge middleware reads the cached token value. When the final critical-flight wizard completes, its post-completion hook (SW-5+) must call `session.update()` (or rely on sign-out → sign-in) to refresh the claim.

- **`/lite/first-run` allowlisted out of gate 2 rather than `isPublicRoute`.** Gate 1 (Brand DNA) must still apply — critical flight is sequenced *after* Brand DNA (spec §8.1). An `isPublicRoute` entry would bypass auth and the Brand DNA gate too. The narrow pathname check in gate 2 is the correct seam.

- **Capstone uses Tier-2 `wizard-complete` as the motion slot (placeholder).** Spec §8.3 reserves `motion:critical_flight_capstone` (Tier-1, one-time-per-account) but the design-system-baseline revisit hasn't registered it yet. Reusing the celebration step's entry mirrors what the celebration step already does — same "single source of truth" rationale as SW-2. When the real Tier-1 slot lands, both the celebration step and this capstone upgrade together.

- **Kill-switch OFF → `hasCompletedCriticalFlight` returns true (no-op gate).** Matches SW-2/SW-3 convention: wizards are disabled, so gate 2 shouldn't redirect admins into nonexistent wizard routes. Also means `/lite/first-run` is inert (capstone-only) in that state — safe.

- **`getCriticalFlightStatus` returns `remaining: [...ordered]` on empty-user input.** Defensive: a missing userId is a caller bug, but returning an empty completedKeys + full remaining is less surprising than throwing. `nextCriticalWizardKey("")` therefore returns the first critical wizard key — harmless because the jwt path guards on userId truthiness upstream (`hasCompletedCriticalFlight("") === false`).

- **Off-whitelist auth-triplet edits.** `auth.config.ts`, `auth.ts`, and `session.ts` aren't on the brief's file whitelist. They are the only way to implement the brief's stated requirement ("Proxy.ts gate 2 routes admins with incomplete flight to `/lite/first-run`") given A8's Edge/Node split — the proxy.ts comment itself predicted this exact change. Rationale parallels SW-3's `lib/settings.ts` + migration 0010 contemporaneous-debt argument: one change, not two. No PATCHES_OWED row owed.

---

## Verification gates

- **G0 kickoff:** Brief read; last 2 handoffs (sw-3, sw-2) read; spec §8.1–§8.4 read ✓. Sonnet model tier ✓.
- **G1 preflight:** 7/7 preconditions verified (sw-2-handoff, sw-3-handoff, step-types index, stub file, wizard_completions schema, `critical_flight_wizards` seed, registerIntegration.ts).
- **G2 scope discipline:** All whitelisted files touched. Three off-whitelist auth edits — rationale in Key decisions. No other scope creep.
- **G3 context budget:** Comfortable single-session — no split triggered.
- **G4 literal-grep:** No `['stripe-admin','resend','graph-api-admin']` literal in `lib/` or `app/`. The only occurrence of that order is in settings seed + tests (the tests intentionally assert the ordering they mock). Helpers read `settings.get('wizards.critical_flight_wizards')`.
- **G5 motion:** Capstone reuses `tier2["wizard-complete"]` entry — A4-registered, SSOT. `data-choreography="wizard-complete"` attribute present. No new motion slots introduced; spec §8.3's `critical_flight_capstone` Tier-1 slot owed to the design-system revisit.
- **G6 rollback:** feature-flag-gated on `setup_wizards_enabled` ✓. No schema, no migration. Revert = restore stub + delete new files.
- **G7 artefacts:** All whitelisted + off-whitelist files present ✓. `npm run build` shows `/lite/first-run` in the route manifest ✓.
- **G8 typecheck + tests + lint + build:** `npx tsc --noEmit` → 0 errors. `npm test` → 308/308 green (297 pre-SW-4 + 11 net new: 7 critical-flight, 4 has-completed-critical-flight). `npm run lint` → clean. `npm run build` → clean.
- **G9 E2E:** Not a critical flow; E2E smoke for the full admin-first-run arc is owned by SW-5 (first consumer wizard).
- **G10 manual browser:** Route compiles + is reachable per `npm run build`. No UI assertions executed — wizard landing page + redirect target land in SW-5. This SW-4 session ships the sequencer only; visible capstone behaviour is verified in SW-5's G10.
- **G11.b:** SW-5 brief pre-compiled ✓.
- **G12:** Tracker + commit — below.

---

## Migration state after SW-4

Unchanged from SW-3 — SW-4 is code-only.

```
0000_init.sql
0001_seed_settings.sql
0002_a6_activity_scheduled_inbox
0003_a7_email_stripe_pdf
0004_a8_portal_auth
0005_b1_support
0006_b3_legal
0007_bda1_brand_dna
0008_sw1_wizards
0009_sw2_wizard_step_timeouts
0010_sw3_verify_timeout
```

Next migration slot = 0011.

---

## PATCHES_OWED rows (SW-4 — new)

None. Auth-triplet edits are contemporaneous with the feature, not deferred.

---

## Open threads for SW-5 (next session)

- **`session.update()` on completion.** When SW-5's Stripe wizard writes its `wizard_completions` row, it must trigger `session.update()` (via the NextAuth client hook or server-side `unstable_update()` pattern) so the JWT re-runs `hasCompletedCriticalFlight` and `critical_flight_complete` flips. Otherwise the admin will keep redirecting to `/lite/first-run` until they sign out.
- **Redirect target URL shape is `/lite/setup/critical-flight/[key]`.** SW-5 owns that route. The brief expects `[key]` to be one of `stripe-admin` / `resend` / `graph-api-admin` (current settings value). The route handler resolves `[key]` → `getWizard(key)` → render.
- **Capstone motion slot is still placeholder.** When SW-5 (or the design-system revisit) registers `motion:critical_flight_capstone` Tier-1, the capstone component in `app/lite/first-run/capstone.tsx` and the celebration step both need to read the new entry. One-line change in each.
- **`admin-first-run` WizardDefinition doesn't exist yet.** The spec §3.2 CapstoneConfig lives on a WizardDefinition, but the critical flight is three separate wizards. SW-5 or a scoped content mini-session decides whether to ship a meta `admin-first-run` wizard (capstone-only, no steps) or to hang the capstone off the third wizard's `voiceTreatment.capstone`. SW-4 ducked the question by rendering the capstone at the route level, outside any specific WizardDefinition.

---

## Autonomy loop note

SW-5 is next per tracker. SW-5 brief pre-compiled. Rolling cadence (G11.b) holds.
