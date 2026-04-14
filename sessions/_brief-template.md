# `<id>` — `<short title>` — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.

---

## 1. Identity

- **Session id:** `<wave-letter><number>` (e.g. `A5`, `B1`, `BDA-2`)
- **Wave:** `<n>` — `<wave name>` (e.g. `1 — Foundation A`)
- **Type:** one of `INFRA` · `FEATURE` · `UI` · `E2E` · `AUDIT`
- **Model tier:** `/quick` (Haiku) · `/normal` (Sonnet) · `/deep` (Opus) — set this command at session start (per §"Model tiering").
- **Sonnet-safe:** `yes` / `no` — if `yes`, the session may continue on Sonnet during an Opus → Sonnet plan-level fallback. Default `no` (per §"Plan-level fallback").
- **Estimated context:** `small` / `medium` / `large` — informs G3 70% checkpoint discipline.

## 2. Spec references

Bullet each spec the session implements, by file path **and** section heading. The brief is the only spec read at G0 — these refs scope what the session is allowed to consult later.

- `docs/specs/<spec>.md` §`<heading>` — `<one-line why>`
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
- [ ] G-gates run end-to-end (G0 → G12) with a clean handoff written.

## 10. Notes for the next-session brief writer (G11 extension)

When this session closes, the closing handoff also writes the next session's brief. Anything the next session will need to know — interface contract surprises, kill-switches landed but disabled, settings keys seeded with placeholder defaults, deferred consumers — is captured here so the next brief can land in one pass.

- ...
