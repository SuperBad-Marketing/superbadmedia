# SW-1 — Setup Wizards: tables + shell chrome + WizardDefinition — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** SW-1
- **Wave:** 4 — Setup Wizards (**first session in Wave 4**)
- **Type:** INFRA
- **Model tier:** `/normal` (Sonnet) — schema + chrome + TypeScript interface; no LLM work, no motion choreography novelty
- **Sonnet-safe:** yes
- **Estimated context:** medium

## 2. Spec references

- `docs/specs/setup-wizards.md` §3 (`WizardDefinition` shape), §4 (step-type library, SW-2 scope not here), §7 (schema: `wizard_progress`, `wizard_completions`, `integration_connections`), §11 (shell chrome)
- `BUILD_PLAN.md` Wave 4 §SW-1 — session inventory
- `sessions/bda-4-handoff.md` — Wave 3 close-out + NextAuth session shape

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md SW-1)

```
SW-1 — INFRA, medium
- Owns: wizard_progress, wizard_completions, integration_connections tables
- Owns: shell chrome (WizardShell component — progress bar, cancel,
  save-and-resume plumbing, help affordance)
- Owns: WizardDefinition<TCompletionPayload> TypeScript interface
  (+ WizardStepDefinition, CompletionContract, VendorManifest types)
- Registry scaffold: lib/wizards/registry.ts (empty manifest; SW-3 populates)
- No actual wizards built here. No step-type implementations (SW-2).
- No OAuth plumbing, no integration logic, no scheduled tasks (SW-6).
- Depends on: A3 (UI primitives + motion tokens), A5 (settings.get),
  A6 (logActivity)
- Consumes settings keys: wizards.expiry_days, wizards.resume_nudge_hours,
  wizards.max_resume_count, wizards.admin_idle_banner_days
  (ALL seeded by A5 — verify in preconditions, don't re-seed)
- Activity-log kinds added: wizard_started, wizard_step_completed,
  wizard_completed, wizard_abandoned (extend ACTIVITY_LOG_KINDS)
- Rollback: migration-reversible (down-migration included)
```

## 4. Skill whitelist

- `drizzle-orm` — 3 new tables + migration
- `tailwind-v4` — shell chrome styling
- `framer-motion` — shell progress-bar transitions (Tier 1 `houseSpring` only; no new choreography)
- (No new LLM work, no new sound keys.)

## 5. File whitelist (G2 scope discipline)

**New:**
- `lib/db/schema/wizard-progress.ts` — `wizard_progress` table
- `lib/db/schema/wizard-completions.ts` — `wizard_completions` table
- `lib/db/schema/integration-connections.ts` — `integration_connections` table
- `lib/db/migrations/0008_sw1_wizards.sql` — Drizzle-generated; must include down-migration
- `lib/wizards/types.ts` — `WizardDefinition<T>`, `WizardStepDefinition`, `CompletionContract<T>`, `VendorManifest`, `TabTitlePool`, `CapstoneConfig`
- `lib/wizards/registry.ts` — empty manifest + `registerWizard(def)` + `getWizard(key)` helpers
- `components/lite/wizard-shell.tsx` — `WizardShell` chrome (progress bar + cancel + help slot + step-slot children prop); `"use client"`; consumes `houseSpring`
- `tests/wizard-schema.test.ts` — schema-level: insert/read/unique-constraint on `wizard_progress(user_id, wizard_key) WHERE abandoned_at IS NULL`
- `tests/wizard-shell.test.ts` — shell chrome: progress-bar render, cancel hook, help affordance
- `tests/wizard-registry.test.ts` — register + lookup + duplicate-key rejection
- `sessions/sw-3-brief.md` — Wave 4 next-session brief (G11.b rolling cadence)

**Edited:**
- `lib/db/schema/index.ts` — export the 3 new schemas
- `lib/db/schema/activity-log.ts` — add `wizard_started`, `wizard_step_completed`, `wizard_completed`, `wizard_abandoned` to `ACTIVITY_LOG_KINDS`
- `sessions/sw-1-handoff.md` — write at close

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** `wizards.expiry_days`, `wizards.resume_nudge_hours`, `wizards.max_resume_count`, `wizards.admin_idle_banner_days` (all via `settings.get()` — no literals)
- **Seeds:** none (A5 seeded them in `0001_seed_settings.sql`; verify in G1)

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] BDA-4 closed cleanly — verify: `ls sessions/bda-4-handoff.md`
- [ ] A3 motion tokens + UI primitives available — verify: `grep "houseSpring" lib/design-tokens.ts`
- [ ] A5 `settings.get()` helper — verify: `grep "export.*function get" lib/settings.ts`
- [ ] A5 seeded wizard settings — verify: `grep "wizards.expiry_days" lib/db/migrations/0001_seed_settings.sql`
- [ ] A6 `logActivity` — verify: `grep "export.*logActivity" lib/activity-log.ts`
- [ ] No existing `wizard_progress` schema — verify: `ls lib/db/schema/wizard-progress.ts` returns "No such file"
- [ ] Migration slot 0008 free — verify: `ls lib/db/migrations/0008_* 2>&1 | grep "No such"`
- [ ] Latest migration is 0007 — verify: `ls lib/db/migrations/ | tail -1` returns `0007_bda1_brand_dna.sql`

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**migration-reversible.** Down-migration drops the 3 tables and rolls back the `ACTIVITY_LOG_KINDS` additions (no hard FK dependency yet — SW-2/SW-3 introduce consumers). `drizzle-kit drop` on migration 0008 restores pre-SW-1 state cleanly. No settings seed changes (A5 rows are left in place).

## 9. Definition of done

- [ ] 3 tables exist with correct columns + indexes (see spec §7)
- [ ] `wizard_progress` partial unique index `(user_id, wizard_key) WHERE abandoned_at IS NULL` present
- [ ] `WizardDefinition<T>` generic interface type-checks against a representative fake wizard written in the test
- [ ] `registerWizard()` rejects duplicate keys with a clear error
- [ ] `WizardShell` renders progress + cancel + help slots; consumes `settings.get('wizards.expiry_days')` for the expiry hint copy (no literal `30`)
- [ ] G4 literal-grep: no autonomy literals in the diff (expiry days, nudge hours, max resume count are all `settings.get()`)
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green (≥ 245 + new)
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] G-gates G0–G12 run end-to-end; handoff written; tracker updated; sw-3-brief.md written per G11.b

## 10. Notes for the next-session brief writer (SW-3)

SW-2 is already pre-compiled (`sessions/sw-2-brief.md`, written by BDA-4). SW-1 therefore owes **only SW-3's brief** at close — not two.

- **SW-3 (FEATURE, small):** vendor manifest schema + Observatory registration contract (`registerIntegration(manifest)` helper) + completion-contract enforcement (`verify()` runs against real vendor before marking complete). Depends on SW-2. Writes no new tables — just the helper + enforcement wiring.
