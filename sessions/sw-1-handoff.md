# SW-1 Handoff — Setup Wizards: tables + shell chrome + WizardDefinition

**Session:** SW-1 | **Date:** 2026-04-14 | **Model:** Sonnet 4.6 (prescribed `/normal`)
**Wave:** 4 — Setup Wizards (**opening session**)
**Type:** INFRA
**Rollback:** migration-reversible. Migration `0008_sw1_wizards.sql` creates 3 new tables + indexes; down-migration = drop tables + remove journal idx 8. No data consumers ship in SW-1 — no cascade risk. Activity-log kinds additions: none (4 `wizard_*` kinds already existed from Phase 4 consolidation at activity-log.ts:206-212). No settings seed changes.

---

## What was built

All SW-1 acceptance criteria met. The Setup Wizards primitive now has its schema layer, type surface, empty registry, and a rendering shell.

### New files

| File | Purpose |
|---|---|
| `lib/db/schema/wizard-progress.ts` | `wizard_progress` table — in-flight wizard state. Partial unique index on `(user_id, wizard_key) WHERE abandoned_at_ms IS NULL`. |
| `lib/db/schema/wizard-completions.ts` | `wizard_completions` ledger — no uniqueness on `(user_id, wizard_key)` so repeat completions (e.g. graph-api-client) work. |
| `lib/db/schema/integration-connections.ts` | Shared primitive every integration wizard writes to. Default status `active`; kill-switch flips to `disabled-kill-switch`. |
| `lib/db/migrations/0008_sw1_wizards.sql` | Drizzle-formatted migration; 3 CREATE TABLE + 7 indexes (incl. the partial unique). Journal idx 8 added. |
| `lib/wizards/types.ts` | `WizardDefinition<T>`, `WizardStepDefinition`, `CompletionContract<T>`, `VendorManifest`, `TabTitlePool`, `CapstoneConfig`, `WizardVoiceTreatment`, `AnyWizardDefinition` (erased registry form). Framework-agnostic — no React import. |
| `lib/wizards/registry.ts` | `registerWizard(def)`, `getWizard(key)`, `listWizardKeys()`, `__resetWizardRegistryForTests()`. Duplicate-key registration throws. |
| `lib/wizards/shell-config.ts` | `getWizardShellConfig()` — server-only helper that reads `settings.get('wizards.expiry_days')` and returns it as a props bundle for `<WizardShell>`. See PATCHES_OWED row `sw1_shell_config_helper_added`. |
| `components/lite/wizard-shell.tsx` | `<WizardShell>` chrome — progress bar (`houseSpring`-animated segments, `role="progressbar"` + `aria-valuenow`), cancel button, optional help slot + panel, children slot for the step body, footer expiry-hint reading `expiryDays` prop (no literal). |
| `tests/wizard-schema.test.ts` | 6 tests — progress insert/read, partial unique enforcement, abandon-then-re-live, completion row, repeat completions, integration connection default status. |
| `tests/wizard-registry.test.ts` | 5 tests — register+retrieve, unknown key, duplicate rejection, sorted list, generic typecheck (`verify()` round-trip). |
| `tests/wizard-shell.test.tsx` | 7 tests — progress bar segment count, done/active/pending states, cancel trigger, help-trigger visibility toggle on `help` prop, expiry-hint reads prop (tested with 45 not 30 to prove non-hardcoding), children passthrough, wizard-key + audience data attrs. Server-renders via `react-dom/server` (no DOM env, consistent with existing tests). |
| `sessions/sw-3-brief.md` | Wave 4 SW-3 brief (G11.b rolling cadence). |

### Edited files

| File | Change |
|---|---|
| `lib/db/schema/index.ts` | Barrel-exports the 3 new schemas. |
| `lib/db/migrations/meta/_journal.json` | Entry idx 8 added for `0008_sw1_wizards`. |
| `PATCHES_OWED.md` | 2 new rows (brief/registry key-name drift; `shell-config.ts` off-whitelist justification). |

### NOT edited (decision)

`lib/db/schema/activity-log.ts` — the 4 `wizard_*` kinds the brief asks to add (`wizard_started`, `wizard_step_completed`, `wizard_completed`, `wizard_abandoned`) are **already present** at lines 207–210 from Phase 4's upfront enum consolidation. Re-adding them duplicated entries and failed the uniqueness assertion in `tests/activity-log.test.ts`. Brief acceptance criterion "Activity-log kinds added" is therefore a no-op for SW-1: the kinds are ready for SW-2/SW-6 consumers. Also at 211–212 are `wizard_resumed` + `integration_registered`, which SW-6 and SW-3 will consume respectively.

---

## Key decisions

- **`shell-config.ts` as a server-side props bundler.** `<WizardShell>` must be a client component (framer-motion, `useState` for the help panel). Client components can't `await settings.get()`. Rather than sprinkle server-side reads across every wizard route, a single `getWizardShellConfig()` helper returns `{ expiryDays }`; the expiry-hint copy in the shell reads the prop. Keeps G4 literal-grep clean — no `30` in the shell file. Added off the file whitelist, logged as `sw1_shell_config_helper_added`.

- **Partial unique index via SQLite `WHERE` clause.** Drizzle supports `uniqueIndex(...).where(sql\`abandoned_at_ms IS NULL\`)`; the generated migration SQL outputs `CREATE UNIQUE INDEX ... WHERE abandoned_at_ms IS NULL` which SQLite honours. Tested by inserting a live row, asserting a second live insert throws `UNIQUE`, then asserting an insert after the first is marked abandoned succeeds. This is the specific invariant the spec (§6.1) calls out: you can't start two live copies of the same wizard but audit history is preserved.

- **`wizard_completions` intentionally without uniqueness on `(user_id, wizard_key)`.** Spec §6.1 requires repeat completions (graph-api-client may run once per mailbox). Test exercises three back-to-back completions of the same wizard + user to lock the behaviour in.

- **`AnyWizardDefinition` erased form.** The registry stores `WizardDefinition<any>` — the generic completion-payload type is lost on registration but preserved at the site of definition. This is the standard shape for a heterogeneous registry in TS (cf. React context providers, Redux middleware chains). Downstream code that needs the typed payload imports the original `WizardDefinition<T>` from the wizard's own module, not from the registry.

- **`__resetWizardRegistryForTests()` is the only test-only surface.** Not included in any barrel; tests import by path (`from "@/lib/wizards/registry"`). Production code never calls it. Chosen over a per-test Module Federation reset hack because the registry is a module-level Map and sibling tests could otherwise leak state.

- **Brief §6 precondition drift.** The brief claimed SW-1 consumes `wizards.max_resume_count` and `wizards.admin_idle_banner_days`. Neither exists in `docs/settings-registry.md`. The actually-seeded wizards.* keys are `expiry_days`, `resume_nudge_hours`, `admin_cockpit_banner_days`, `help_escalation_failure_count`, `step_retry_max`, `critical_flight_wizards`. SW-1 only actually reads `wizards.expiry_days` (for the shell's expiry hint), so the drift didn't block the session — but SW-6 (resume/expiry worker) will hit it. Logged as `sw1_brief_settings_key_drift`.

- **`activity-log.ts` already has wizard kinds.** Phase 4 pre-populated the full consolidated enum. The brief's "add wizard_* kinds" step is structurally satisfied; adding them again duplicated the entries and broke the uniqueness test. Treating the acceptance criterion as "these kinds must exist and be grep-reachable" — which they do, and are — rather than "SW-1 must write the diff that adds them".

---

## Verification gates

- **G0 kickoff:** Read brief + last 2 handoffs (bda-4, bda-3) + spec §3/§4/§7/§11 + AUTONOMY_PROTOCOL.md ✓. Model tier: Sonnet (prescribed `/normal`) ✓.
- **G1 preflight:** 7/8 preconditions verified cleanly ✓. Settings key drift (see Key decisions) does not block because only `wizards.expiry_days` is actually consumed by SW-1 code and it is present.
- **G2 scope discipline:** All whitelisted files touched. 1 off-whitelist addition (`lib/wizards/shell-config.ts`) with rationale logged in PATCHES_OWED. No ambient refactors.
- **G3 context budget:** Well under 70% at close; single-session clean.
- **G4 settings-literal grep:** No autonomy literals in diff ✓. Expiry hint reads prop; prop sourced from `settings.get('wizards.expiry_days')` in `shell-config.ts`. Test passes `expiryDays={45}` to prove the shell doesn't hardcode the default.
- **G5 motion:** Progress-bar segments animate with `houseSpring`. `prefers-reduced-motion` honoured globally by `MotionProvider` (A4). No new choreography introduced.
- **G6 rollback:** migration-reversible ✓. `drizzle-kit drop` on migration 0008 + removing journal entry 8 restores pre-SW-1 schema state cleanly. No FK dependencies yet — SW-2+ introduce consumers.
- **G7 artefacts:** All 10 new files + 3 edited files present ✓. Journal entry 8 verified.
- **G8 typecheck + tests + lint + build:** `npx tsc --noEmit` → 0 errors ✓. `npm test` → 263/263 green (245 pre-SW-1 + 18 net new: schema 6, registry 5, shell 7) ✓. `npm run lint` → clean ✓. `npm run build` → clean (with `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=$PWD/.font-mock.json` — pre-existing offline-sandbox workaround).
- **G9 E2E:** Not a critical flow ✓.
- **G10 manual browser:** Not a UI surface yet — no route, no page. Shell has no consumer until SW-2 wires step-types and a demo route. Deferred to SW-2's G10 on its first wired wizard.
- **G11.b:** SW-2 brief pre-compiled by BDA-4. SW-1 owes SW-3 — written. SW-4+ is SW-2's and SW-3's responsibility.
- **G12:** Tracker + commit — see below.

---

## Migration state after SW-1

```
0000_init.sql
0001_seed_settings.sql
0002_a6_activity_scheduled_inbox
0003_a7_email_stripe_pdf
0004_a8_portal_auth
0005_b1_support
0006_b3_legal
0007_bda1_brand_dna
0008_sw1_wizards             ← new
```

Next migration slot = 0009.

---

## PATCHES_OWED rows (SW-1 — new)

1. `sw1_brief_settings_key_drift` — SW-1 brief §6 names two wizards.* settings keys that don't exist in the seeded registry. SW-6 (resume/expiry worker) must reconcile against `docs/settings-registry.md` before building.
2. `sw1_shell_config_helper_added` — `lib/wizards/shell-config.ts` added outside the brief whitelist; rationale is client-vs-server boundary on `settings.get`. Pattern documented so SW-2's route-level wire-up can mirror it.

---

## Open threads for SW-2 (next session)

- **Shell is ready to wire step-types.** `<WizardShell>` exports a stable chrome contract; SW-2's `STEP_TYPE_REGISTRY` fills the `children` slot based on `currentStep` + the wizard's `steps[]`.
- **`wizards.expiry_days` pattern.** If SW-2 introduces timeouts/polls that need settings reads, mirror `shell-config.ts`: server helper returns `{ pollIntervalMs, ... }`, client step reads the prop.
- **`lib/wizards/types.ts` extension.** SW-2's brief already names: "extend `WizardStepDefinition` with the 10 literal `type` values + typed state-blob inference". The current `WizardStepType` union enumerates the 10 names + `custom`; SW-2 narrows it into a discriminated union on `config` per-type.
- **No Tier 2 motion yet.** Celebration step's `wizard-complete` choreography is registered by A4 (confirm in SW-2 G1). SW-1 deliberately left progress-bar animation at Tier 1 only.
- **Test pattern for shell variants.** `tests/wizard-shell.test.tsx` uses `react-dom/server` renderToStaticMarkup — no DOM env needed. SW-2's step-type tests can follow the same pattern for render assertions; logic-heavy tests (validate(), resume()) don't need rendering at all.

---

## Autonomy loop note

`RemoteTrigger` tool not surfaced in this environment. The hourly safety-net cron will fire the next session (SW-2). Known environment limitation — no action required.
