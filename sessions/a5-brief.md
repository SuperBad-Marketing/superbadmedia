# A5 — Settings + permissions + kill-switches + ESLint rules — Session Brief

> Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.

---

## 1. Identity

- **Session id:** A5
- **Wave:** 1 — Foundation A
- **Type:** INFRA
- **Model tier:** `/normal` (Sonnet) — set this command at session start.
- **Sonnet-safe:** yes (this is the session's prescribed tier — no fallback risk).
- **Estimated context:** medium

## 2. Spec references

- `BUILD_PLAN.md` Wave 1 §A5 — owner block (the canonical scope statement for this session).
- `docs/settings-registry.md` (full) — source of truth for every seeded key.
- `FOUNDATIONS.md` §13 (Glossary) — source of truth for the TS glossary types (`Lead`, `Prospect`, `Client`, `Subscriber`, `Contact`, `Company`, `Deal`, `Quote`, `Invoice`, `Candidate`, `Hire`).
- `FOUNDATIONS.md` §11.7 + §12 — context for permissions module + `subscription_state` literals the ESLint rule must catch.
- `AUTONOMY_PROTOCOL.md` §G4 — the literal-grep gate that the new ESLint rules enforce statically.
- `sessions/a2-handoff.md` "Scope call locked in-session" + PATCHES — A5 inherits the six deferred `user`-table preference columns + `first_signed_in_at`.
- `sessions/a4-handoff.md` "Open threads for A5" — confirms providers fall back to cookie defaults until A5 lands the user columns.

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md A5 + Foundation-A exit)

```
A5 — Settings + permissions + kill-switches + ESLint rules
- Builds: `settings` table + `settings.get(key)` helper + seed migration from
  `docs/settings-registry.md` (60+ keys across Finance/Wizards/Plan/Portal/Hiring
  + any Wave-added keys from Foundation A7/A8/B3). Permissions module
  (`lib/auth/permissions.ts`) derived from Phase 3.5 access matrix
  (admin/client/prospect/anonymous/system roles). Kill-switch layer
  (`lib/kill-switches.ts`) — central feature flags for outreach / scheduled tasks
  / LLM calls / anything risky. Glossary TypeScript types
  (`lib/types/glossary.ts`) from FOUNDATIONS §13. ESLint no-direct-import rules:
  `@anthropic-ai/sdk`, `stripe.customers.create`, `resend.emails.send()` all
  blocked from feature code.
- Owns: `settings` table, `settings.get()`, `lib/auth/permissions.ts`,
  `lib/kill-switches.ts`, `lib/types/glossary.ts`, ESLint custom rules.
- Settings keys: seeds all 60+ registered keys.
- Rollback: migration reversible.

Foundation-A exit (this session contributes):
  `settings.get('portal.magic_link_ttl_hours')` returns 48,
  the user table carries the six display-preference columns,
  `npx tsc --noEmit` zero errors, `npm test` green.
```

(Note the BUILD_PLAN exit-line example default `48` predates the registry; the
registry locks `portal.magic_link_ttl_hours = 168` per F1.a 2026-04-13 — seed
the registry value, not the BUILD_PLAN example. Both are correct as written;
the registry is canonical.)

## 4. Skill whitelist

- `drizzle-orm` — schema definition, migrations, type inference for the new tables and `user`-table column additions.
- `typescript-validation` — zod for `settings.get()` value parsing + ESLint custom-rule authoring patterns.
- `nextauth` — informs the permissions module's role enum (admin/client/prospect/anonymous/system) so it lines up with the session shape A8 will land. **Read for shape only — do not implement auth here; A8 owns NextAuth wiring.**

## 5. File whitelist (G2 scope discipline)

- `lib/db/index.ts` — singleton Drizzle client (`new`).
- `lib/db/schema/settings.ts` — `settings` table (`new`).
- `lib/db/schema/user.ts` — extends user with the six display-preference columns + `first_signed_in_at` + `role` + `timezone` (`new`; A6 will add `timezone` again if not landed here — coordinate via the brief's §10 note).
- `lib/db/schema/index.ts` — barrel re-export (`new`).
- `lib/db/migrations/0000_*.sql` (or first numbered migration) — seed migration including all 60 + 7 keys (`new`).
- `drizzle.config.ts` — drizzle-kit config (`new`).
- `lib/settings.ts` — `settings.get(key)` helper with typed key map + zod parsing + in-memory cache invalidated on write (`new`).
- `lib/auth/permissions.ts` — role enum + `can(role, action, resource)` helper (`new`).
- `lib/kill-switches.ts` — central flags: `outreach_send_enabled`, `scheduled_tasks_enabled`, `llm_calls_enabled`, `drift_check_enabled` (`new`).
- `lib/types/glossary.ts` — TS types per FOUNDATIONS §13 (`new`).
- `eslint.config.mjs` — register the custom rules + scope to `app/` + `components/` + `lib/` minus `lib/channels/`, `lib/ai/`, `lib/stripe/` (`edit`).
- `lib/eslint-rules/no-direct-anthropic-import.ts` (and siblings) — three custom rules: anthropic SDK, `stripe.customers.create`, `resend.emails.send()` (`new`).
- `docs/settings-registry.md` — append the 7 new keys this session seeds (`edit`).
- `tests/settings.test.ts` — `settings.get()` + seeded-key inventory parity (`new`).
- `tests/permissions.test.ts` — role/action matrix smoke (`new`).
- `tests/eslint-rules.test.ts` — RuleTester cases for the three custom rules (`new`).
- `package.json` + `package-lock.json` — drizzle, drizzle-kit, better-sqlite3, eslint-plugin local-rule scaffolding (`edit`).
- `.env.example` — `DATABASE_URL` (sqlite path) (`edit`).

Anything outside this list = stop and patch the brief first.

## 6. Settings keys touched

- **Reads:** none directly; A5 is the producer. Tests assert reads work.
- **Seeds (registry-locked, 60 existing):** every row in `docs/settings-registry.md` (Finance 11, Wizards 6, Plan 10, Portal 5, Intro Funnel 1, Hiring 28).
- **Seeds (new keys to add to the registry in this session):**
  - `email.quiet_window_start_hour` — `8` — A7 quiet-window gate (§11.4).
  - `email.quiet_window_end_hour` — `18` — A7 quiet-window gate (§11.4).
  - `email.drift_check_threshold` — `0.7` — A7 drift grader threshold (§11.5).
  - `email.drift_retry_count` — `1` — A7 drift retry count (§11.5).
  - `alerts.anthropic_daily_cap_aud` — `25.00` — B1 cost-alert threshold.
  - `alerts.stripe_fee_anomaly_multiplier` — `2.0` — B1 fee-anomaly threshold.
  - `alerts.resend_bounce_rate_threshold` — `0.05` — B1 bounce-rate threshold.

(BUILD_PLAN A8 also lists `portal.magic_link_ttl_hours` + `portal.session_cookie_ttl_days`; both already in the registry under Portal — do not re-seed, do not duplicate.)

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] `package.json` declares Next 16 + React 19 — verify: `Read package.json`.
- [ ] `instrumentation.ts` exists and imports `lib/env.ts` — verify: `ls instrumentation.ts && Read`.
- [ ] `lib/env.ts` exports zod-validated env schema — verify: `Grep "zod" lib/env.ts`.
- [ ] `vitest.config.ts` exists with `@/` alias — verify: `Read vitest.config.ts`.
- [ ] `docs/settings-registry.md` has the 60 v1.0 keys laid out — verify: `Grep "Total: 60 keys" docs/settings-registry.md`.
- [ ] `FOUNDATIONS.md` §13 Glossary present — verify: `Grep -n "## §13" FOUNDATIONS.md` (or equivalent heading).
- [ ] `app/lite/design/page.tsx` renders against tokens (A2 / A3 / A4 chain intact) — verify: `Read app/lite/design/page.tsx`.
- [ ] `lib/presets.ts` reads the cookie-backed display preferences — verify: `Grep "getActivePresets" lib/presets.ts`.
- [ ] `components/lite/{theme,motion,sound}-provider.tsx` exist — verify: `ls components/lite/*-provider.tsx`.
- [ ] No prior Drizzle scaffolding present — verify: `ls lib/db/ 2>/dev/null` returns nothing (avoid clobber).

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**migration reversible** — every Drizzle migration in this session ships with its down counterpart; rollback = `drizzle-kit migrate:down` followed by `git revert` for the lib/eslint-rule additions. `lib/kill-switches.ts` defaults all flags to **disabled** at seed; nothing autonomous fires from this session's code regardless.

## 9. Definition of done

- [ ] `lib/db/schema/settings.ts` + migration runs clean on a fresh DB — verify: `npx drizzle-kit migrate` against an empty `dev.db`.
- [ ] `settings.get('portal.magic_link_ttl_hours')` returns `168` (registry value) — verify: tests/settings.test.ts.
- [ ] `settings.get('email.quiet_window_start_hour')` returns `8` — verify: tests/settings.test.ts.
- [ ] All 67 keys present in DB after seed — verify: `Grep -c "^|" docs/settings-registry.md` cross-checked against `SELECT count(*) FROM settings`.
- [ ] User table has `motion_preference`, `sounds_enabled`, `density_preference`, `text_size_preference`, `theme_preset`, `typeface_preset`, `first_signed_in_at`, `role`, `timezone` columns — verify: `Grep` on the schema file.
- [ ] `lib/types/glossary.ts` exports the 11 named entity types — verify: `Grep "export type" lib/types/glossary.ts`.
- [ ] `lib/kill-switches.ts` exports the four named flags, all default-disabled — verify: `Grep "export" lib/kill-switches.ts`.
- [ ] `lib/auth/permissions.ts` exports `can(role, action, resource)` and the role enum — verify: `Grep "export" lib/auth/permissions.ts`.
- [ ] ESLint custom rules fire on test fixtures — verify: tests/eslint-rules.test.ts (RuleTester).
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green (existing 25 + new tests).
- [ ] `npm run build` → clean.
- [ ] `npm run lint` → clean (custom rules don't false-positive on existing code).
- [ ] Handoff written naming: settings-registry rows added, kill-switch flag list, glossary types, ESLint rule list, A6's preconditions (so A6 can grep-verify them at G1).

## 10. Notes for the next-session brief writer (A6)

Capture in the A5 closing handoff (which writes the A6 brief per AUTONOMY_PROTOCOL §G11 extension):

- Final list of seeded settings keys + any defaults that diverged from BUILD_PLAN's stated examples (e.g. magic-link TTL).
- Whether `user.timezone` landed here (so A6 doesn't double-add).
- Drizzle file/folder layout chosen (`lib/db/schema/*.ts` per-table vs single file) — A6 follows the pattern.
- If the consolidated 166-value `activity_log.kind` enum source file does not yet exist (BUILD_PLAN A6 cites Phase 3.5 Batch A step 2a), A5 logs a PATCHES_OWED row so A6 can either author the enum from scratch or escalate. A5 does **not** create the activity_log enum itself.
- Any ESLint rule false-positives encountered against existing A1–A4 code paths and how they were resolved (allowlist patterns).
- Reminder to bump `docs/settings-registry.md` Totals table to reflect the 7 new keys (now 67).
