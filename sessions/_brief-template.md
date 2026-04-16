# `<id>` — `<short title>` — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0 + §G0.5.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session (amended 2026-04-17).
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references before proceeding.

---

## 1. Identity

- **Session id:** `<wave-letter><number>` (e.g. `A5`, `B1`, `BDA-2`)
- **Wave:** `<n>` — `<wave name>` (e.g. `1 — Foundation A`)
- **Type:** one of `INFRA` · `FEATURE` · `UI` · `E2E` · `AUDIT`
- **Model tier:** `/quick` (Haiku) · `/normal` (Sonnet) · `/deep` (Opus) — set this command at session start (per §"Model tiering").
- **Sonnet-safe:** `yes` / `no` — if `yes`, the session may continue on Sonnet during an Opus → Sonnet plan-level fallback. Default `no` (per §"Plan-level fallback").
- **Estimated context:** `small` / `medium` / `large` — informs G3 70% checkpoint discipline.
- **G0.5 input budget estimate (added 2026-04-17):** `<k tokens>` for fixed inputs (this brief + spec excerpts in §2 + mockups in §2a + skills in §4 + last 2 handoffs). Target ≤35k; hard ceiling 50k. If the brief-writer's estimate is >35k, split the session or trim references before this brief locks.

## 2. Spec excerpts (amended 2026-04-17)

Inline the 5–50 lines of spec prose the session actually needs, **verbatim**. The session does **not** read the full spec files at G0 — the excerpt IS the spec for this session. If the excerpt proves insufficient mid-build, read the named section (not the whole file), patch the excerpt below, and continue. Rationale: the 2026-04-17 amendment to AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" makes excerpts mandatory to keep G0.5 input budget under 35k tokens.

### Excerpt 1 — `<topic>`

Source: `docs/specs/<spec>.md` §`<heading>`

```
<verbatim 5–50 lines from the spec>
```

### Excerpt 2 — `<topic>` (repeat as needed)

Source: `docs/specs/<spec>.md` §`<heading>`

```
<verbatim 5–50 lines from the spec>
```

**Audit footer (full spec paths for traceability; not read at G0):**

- `docs/specs/<spec>.md` §`<heading>` — `<one-line why relevant>`
- ...

## 2a. Visual references (required for `UI` type)

If **Type** above is `UI`, list every visual reference the session must match. Specs describe *what*; mockups encode *feel*. A session that cites only the spec will produce a generic result — the mockup is the ground truth for tokens, colours, typography, ambient environment, motion, and micro-interactions.

Required for `UI` sessions, omit for `INFRA` / `AUDIT`:

- `<path>.html` — `<which surface this mockup covers, which sections of it apply>`
- `docs/superbad_brand_guidelines.html` — brand palette + typography (always cite for client-facing surfaces)
- `docs/superbad_voice_profile.html` — voice reference (cite when session writes any user-visible copy)

At G0 the session **must open every mockup listed here** and treat it as binding. Divergence from the mockup is a G2 scope breach unless the brief explicitly calls it out below.

**Intentional divergences from the mockup (if any):** `<list, with reason>`

## 3. Acceptance criteria (verbatim)

Paste the spec's own "success criteria" / "done means" block verbatim. No paraphrasing — paraphrase drift is how scope walks.

```
<verbatim block>
```

## 4. Skill whitelist

2–5 skills only. Per §"Per-session skill whitelist", anything outside this list requires a brief patch + restart.

- `<skill-name>` — `<why this session needs it>`
- ...

## 5. File whitelist (G2 scope discipline)

Paths the session is allowed to create / edit. Anything outside requires brief patch (G2). Use globs sparingly — prefer explicit paths.

- `<path>` — `<why>` (`new` / `edit` / `migration`)
- ...

## 6. Settings keys touched

Per §G4 — list every `settings.get(key)` consumer this session adds and every key it seeds. Each must already exist in `docs/settings-registry.md` or be added to it (and to A5's seed migration) in this session.

- **Reads:** `<key>`, ...
- **Seeds (new keys):** `<key>` — `<default>` — `<why>`
- ...

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

Each row must be runnable as `Read` / `ls` / `grep` against the repo at session start. If any fails: stop, do not build.

- [ ] `<file path>` exists — verify: `ls <path>`
- [ ] `<table name>` table defined in schema — verify: `grep "<table name>" lib/db/schema/*.ts`
- [ ] `<helper>` exported from `<module>` — verify: `grep "export .* <helper>" <module>`
- [ ] `<settings key>` seeded — verify: `grep "<settings key>" docs/settings-registry.md`
- [ ] `<env var>` declared — verify: `grep "<env var>" .env.example`
- ...

## 8. Rollback strategy (G6 — exactly one)

Pick **one** and justify in ≤1 line:

- [ ] `migration reversible` — down-migration shipped; rollback = `drizzle-kit migrate:down`.
- [ ] `feature-flag-gated` — kill-switch named `<flag>` in `lib/kill-switches.ts`; rollback = flip the flag.
- [ ] `git-revertable, no data shape change` — UI/helper only; rollback = `git revert`.

## 9. Definition of done

Concrete, verifiable list. Each item must be confirmable via grep / curl / typecheck / browser walk. No "looks good" — every item is a checkbox the next reviewer can run.

- [ ] `<artefact>` exists — verify: `<command>`
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green (X / Y).
- [ ] `npm run build` → clean.
- [ ] (UI work) dev server boots on `:3001`, `<route>` returns 200.
- [ ] (UI work) G10 mockup parity check complete — side-by-side screenshots of built route vs each §2a mockup in the handoff.
- [ ] **G10.5 fidelity gate (amended 2026-04-17)** — UI briefs: external reviewer sub-agent verdict is `PASS` or `PASS_WITH_NOTES`; verdict attached verbatim to handoff. Non-UI briefs (`INFRA` / `FEATURE` / `E2E` / `AUDIT`): in-context fidelity grep — acceptance-criterion keywords present in diff, no file-whitelist violations, no memory-alignment violations — returns zero hits. FAIL in either path = session closes as FAILED handoff. Notes logged to `PATCHES_OWED.md`.
- [ ] **Memory-alignment declaration** — handoff lists every applied memory with a one-line "how applied" per G11.
- [ ] G-gates run end-to-end (G0 → G12) with a clean handoff written.

## 10. Notes for the next-session brief writer (G11 extension)

When this session closes, the closing handoff also writes the next session's brief. Anything the next session will need to know — interface contract surprises, kill-switches landed but disabled, settings keys seeded with placeholder defaults, deferred consumers — is captured here so the next brief can land in one pass.

- ...
