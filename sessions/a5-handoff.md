# A5 — Settings + permissions + kill-switches + ESLint rules — Handoff

**Date:** 2026-04-14
**Wave:** 1 — Foundation A
**Model:** `/normal` (Sonnet, per brief)
**Brief:** `sessions/a5-brief.md`
**Rollback:** **migration reversible** — `drizzle-kit drop` against `0000_init.sql` + `0001_seed_settings.sql`, then `git revert`.

---

## What got built

- **Drizzle client singleton** at `lib/db/index.ts` (`better-sqlite3` + WAL + FK pragma; globalThis cache to avoid per-HMR reconnection).
- **`settings` table** (schema `lib/db/schema/settings.ts`, migration `lib/db/migrations/0000_init.sql`).
- **Seed migration** `lib/db/migrations/0001_seed_settings.sql` — 68 rows across Finance (11) / Wizards (6) / Plan (10) / Portal (5) / Intro Funnel (1) / Hiring (28) / Email (4) / Alerts (3). All INSERTs are `INSERT OR IGNORE` so re-runs are idempotent.
- **Migration runner** at `lib/db/migrate.ts` — applies Drizzle's journal migrations then runs any untracked `.sql` files (the seed pattern). Used by the Vitest harness.
- **`settings.get(key)` helper** at `lib/settings.ts` — typed key map, per-key zod parser, in-memory cache invalidated on write. Default export + named `settingsRegistry` for call-site ergonomics.
- **`user` table** at `lib/db/schema/user.ts` with `role` + `timezone` + the six display-preference columns (`motion_preference`, `sounds_enabled`, `density_preference`, `text_size_preference`, `theme_preset`, `typeface_preset`) + `first_signed_in_at_ms`. Auth.js-compatible shape; A8 wires NextAuth against it.
- **Permissions module** at `lib/auth/permissions.ts` — `Role` union (`admin` / `client` / `prospect` / `anonymous` / `system`) + `can(role, action, resource)` default-deny helper. Seeded with the Finance Dashboard §13 matrix (6 routes + 6 cron jobs). Segment-wise matcher supports `*` trailing wildcards + `:param` path segments.
- **Kill-switches** at `lib/kill-switches.ts` — four flags (`outreach_send_enabled`, `scheduled_tasks_enabled`, `llm_calls_enabled`, `drift_check_enabled`), all default-disabled.
- **Glossary TS types** at `lib/types/glossary.ts` — branded string aliases for Lead / Prospect / Client / Subscriber / Contact / Company / Deal / Quote / Invoice / Candidate / Hire + onboarding entry paths.
- **Three custom ESLint rules** at `lib/eslint-rules/*.ts` + plugin index — `no-direct-anthropic-import`, `no-direct-stripe-customer-create`, `no-direct-resend-send`. Registered in `eslint.config.mjs` under the `lite/` namespace via jiti (needed because the rule files are TS but the config is `.mjs`). Scoped to `app/` + `components/` + `lib/` minus the adapter carve-outs (`lib/channels/`, `lib/ai/`, `lib/stripe/`, `lib/eslint-rules/`).
- **`DATABASE_URL` env var** added to `lib/env.ts` (zod-validated, default `file:./dev.db`) + `.env.example`.
- **Settings registry doc** (`docs/settings-registry.md`) extended with Email + Alerts sections; Totals reconciled to 68 (was "60" by old arithmetic, actually 61 pre-A5).

## Key decisions locked (silently per `feedback_technical_decisions_claude_calls`)

1. **Seed migrations live as untracked-by-Drizzle `.sql` files run by `lib/db/migrate.ts`.** Drizzle-kit's journal is schema-only; our seed file is numbered alongside (`0001_seed_settings.sql`) but applied by our runner, which tolerates repeated application via `INSERT OR IGNORE`. Alternative was to wire seed rows into a TypeScript `seed()` function — rejected because the SQL form is auditable by grep and cross-consumable with `sqlite3` CLI.
2. **`settings.get()` accepts a typed key; parsing is zod-per-key.** Boolean values are stored as `"true"` / `"false"` strings in SQLite (no native bool) and coerced on read. `rate_bands` + `critical_flight_wizards` are stored as JSON strings parsed on read.
3. **ESLint rule source files are `.ts` (per brief) loaded via `jiti` from `eslint.config.mjs`.** Rejected alternatives: (a) rename config to `.ts` (the file whitelist pinned `.mjs`); (b) write rules as `.mjs` (brief pinned `.ts`). Jiti is already a transitive dep of `eslint-config-next`; no new install.
4. **Permissions module ships with Finance Dashboard rules only.** Phase 3.5 step 9 never produced a consolidated access matrix — Finance is the only spec that contributed its `## Permissions matrix contribution` block. Every subsequent wave's session extends `RULES` in `lib/auth/permissions.ts` for its own routes / cron jobs. Logged as PATCHES_OWED row for each wave's G1 precondition.
5. **Registry "Total" arithmetic fix — 61 pre-A5, not 60.** The historical "60" count under-reported the actual row enumeration by one. A5's extension brings the registry to 68 (7 new keys). All tests assert 68.

## Artefacts produced (G7 verification)

Files created:
- `drizzle.config.ts`
- `lib/db/index.ts`
- `lib/db/migrate.ts`
- `lib/db/schema/settings.ts`
- `lib/db/schema/user.ts`
- `lib/db/schema/index.ts`
- `lib/db/migrations/0000_init.sql` + `meta/_journal.json` + `meta/0000_snapshot.json`
- `lib/db/migrations/0001_seed_settings.sql`
- `lib/settings.ts`
- `lib/auth/permissions.ts`
- `lib/kill-switches.ts`
- `lib/types/glossary.ts`
- `lib/eslint-rules/index.ts`
- `lib/eslint-rules/no-direct-anthropic-import.ts`
- `lib/eslint-rules/no-direct-stripe-customer-create.ts`
- `lib/eslint-rules/no-direct-resend-send.ts`
- `tests/settings.test.ts`
- `tests/permissions.test.ts`
- `tests/eslint-rules.test.ts`

Files edited:
- `eslint.config.mjs` (jiti loader + `lite` plugin block)
- `lib/env.ts` (+ `DATABASE_URL`)
- `.env.example` (+ `DATABASE_URL`)
- `package.json` + `package-lock.json` (deps)
- `docs/settings-registry.md` (Email + Alerts sections, Totals reconciled)

Tables created: `settings`, `user`.
Migrations: `0000_init.sql` (schema, tracked by Drizzle journal) + `0001_seed_settings.sql` (seed data, run by `lib/db/migrate.ts`).
Settings rows: 68 seeded.
Dependencies added: `drizzle-orm`, `better-sqlite3` (runtime); `drizzle-kit`, `@types/better-sqlite3` (dev).

## Verification gates

- **G4 literal-grep:** no autonomy-sensitive literals in feature code. The only numeric literals in this session's diff are inside the source-of-truth files themselves (registry seed SQL, kill-switch defaults, permission rules) — these are the *declarations*, not consumer code.
- **G5 motion:** no UI changes.
- **G6 rollback:** migration reversible (declared).
- **G8 typecheck + tests:** `npx tsc --noEmit` zero errors. `npm test` 42/42 green (25 pre-existing + 17 new).
- **G8 extended:** `npm run build` clean. `npm run lint` clean (no false-positives from the new rules against A1–A4 code).
- **G9 E2E:** not applicable (no critical-flow touch).
- **G10 browser:** not applicable (no UI surface).

## PATCHES_OWED rows

New rows A5 is logging:

1. **Phase 3.5 access matrix never consolidated.** Only `docs/specs/finance-dashboard.md` §13 contributed permission rules. Every other spec owes its own matrix contribution section. Each subsequent wave's session has a new G1 precondition: "Consume spec's §Permissions matrix contribution (if absent, author alongside the route)" and append rules to `lib/auth/permissions.ts`.
2. **166-value `activity_log.kind` enum source file missing.** Phase 3.5 Batch A step 2a was meant to consolidate. A6 must either author from `docs/specs/*.md` sections itself or pause-and-escalate (per the rewritten A6 brief §7).
3. **A5 deviation from brief file-whitelist:** `lib/db/migrate.ts` was created (not on the whitelist). Rationale: Drizzle's built-in `migrate()` only runs journal-tracked migrations; seed SQL had to be applied via a sibling runner. Deviation noted for transparency; asks no correction.
4. **Settings registry Totals line was arithmetically wrong pre-A5** (claimed 60, enumerated 61). A5 corrected it to 68 (post-A5). Historical note for future doc audits.

## Open threads for A6

- **`activity_log.kind` enum consolidation** — biggest risk in A6. A6 brief now flags explicitly: no inventing values; either consolidate from specs or escalate.
- **Migration numbering** — A5 used `0000_init.sql` (Drizzle-tracked schema) + `0001_seed_settings.sql` (runner-applied seeds). A6's schema additions must start at `0002_*.sql` (generate via `npx drizzle-kit generate`). A6's own seed files (if any) follow the `000N_seed_*.sql` pattern and are picked up by `runSeeds()`.
- **Drizzle schema folder convention** — per-table file in `lib/db/schema/` + barrel re-export from `index.ts`. A6 follows the same pattern (five new files: `activity-log.ts`, `scheduled-tasks.ts`, `external-call-log.ts`, `messages.ts`).
- **Permissions rules additions** — A6 lands 5 new tables but no new routes; no new rules owed this session. First wave session with UI routes is Wave 3+.
- **Settings keys A6 reads** — per brief, only `kill-switches.scheduled_tasks_enabled`. No new seeds.
- **Next-session brief (G11.b)** — A6 brief already existed (mop-up 2026-04-14). A5 has updated the three rows that drifted against the repo (user-table columns, seed-file numbering, enum source-file-missing gap). Fresh from repo state.

## Brief for A7

Per G11.b rolling cadence: **A6 writes A7's brief in its closing handoff.** A7 touches email-adapter concerns and will consume the four `email.*` settings keys A5 just seeded.
