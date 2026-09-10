<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SUPERBAD Codex Working Contract

These repository-wide rules govern Codex build, audit, debugging and remediation work. Apply them proportionately. More-specific `AGENTS.md` files may add local rules but must not silently weaken scope preservation, safety, verification or authority boundaries.

This repository contains substantial historical build/autonomy documentation (`AUTONOMY_PROTOCOL.md`, `BUILD_PLAN.md`, session handoffs and related records). Preserve it as evidence. Treat it as current execution authority only when the active approved engagement explicitly references it. Historical wave/session checkpoints are not automatic Codex continuation-approval gates under the current SUPERBAD software standards.

## 1. Read current truth before coding

For material work, read the active approved local build/audit/remediation pack and its required reading order before substantive changes. Read the current `PLAN`/`STATUS`/continuation record when present.

Inspect the actual repository, installed dependency versions, relevant tests/configuration and Git state. Do not rely on conversation memory, old handoffs or remembered framework behaviour.

For the behaviour being changed, trace proportionately:

`actor/user → entry point → validation/authority → canonical domain operation → persistence/data owner → jobs/providers → downstream UI/read models → tests/evidence`

Find the canonical owner before adding another path. Approved product specifications define intended behaviour; repository/runtime evidence defines current technical reality. Surface conflicts.

## 2. Work autonomously through authorised milestones

An authorised build/remediation is one commissioned delivery executed through internal milestones. Milestones are quality gates, not routine approval gates.

After a milestone passes, update the designated execution record and continue automatically to the next eligible milestone.

Do not stop because a milestone/session/wave finished, tests failed, refactoring is required, implementation is difficult or an ordinary reversible engineering choice is needed.

Stop only for a consequential unresolved product/permission/data/commercial decision, missing access that cannot be safely resolved, an action outside authorised security/data/spending/release boundaries, a genuine technical blocker after reasonable investigation, or an actual runtime/session limit.

If blocked, pause only dependent work and continue safe independent authorised work. Preserve any explicitly approved human acceptance or release boundary, but do not invent new approval pauses.

Never silently reduce scope, substitute an MVP, hide unfinished behaviour, use undisclosed mocks, weaken safeguards or call partial work complete.

## 3. Defend against context and memory loss

Treat conversational context as disposable. Durable current state belongs in the repository.

After compaction, resumption, a long debugging trail or uncertainty: reread applicable instructions and active status/plan; inspect current revision and Git status/diff; reopen the active source/tests; confirm completed evidence, open failures and next safe action.

At meaningful checkpoints persist concise resumable state: scope/authority version, revision/branch, active milestone, relevant worktree changes, completed verification, open blockers/attempted remedies, material implementation decisions and next safe action.

Do not load the enormous historical documentation set into context by default. Read only the currently applicable source sections plus enough adjacent context to avoid misinterpretation.

## 4. Prefer reuse, refactoring and deletion over additive code

Before creating a new exported function, helper, hook, component, service, route, schema, type, data-access path or configuration mechanism:

1. search for the responsibility already existing;
2. inspect related callers, types, tests and contracts;
3. decide whether the canonical implementation should be extended/refactored instead.

Prefer, where technically appropriate:

`reuse → modify/refactor → replace and delete → add genuinely new responsibility`

Do not force unrelated concerns into a generic abstraction just to avoid a new module.

When replacing behaviour, remove the superseded implementation, imports, exports, tests, configuration and documentation in the same authorised change when safe. Temporary parallel paths require an explicit migration/compatibility reason and retirement condition.

Do not leave commented-out implementations, debug/scratch files, unused imports/exports, obsolete wrappers, duplicate validation/transforms or temporary scaffolding whose purpose is over.

Deletion must be evidence-backed: check direct/indirect callers, dynamic routing/configuration, background jobs and public/compatibility contracts first.

Do not perform unrelated cleanup merely because you noticed it. Fix debt when it is caused by, blocks or materially improves the commissioned work; otherwise record it in the existing designated debt/backlog mechanism rather than creating another register.

## 5. Perform a subtractive code-health pass

Before passing each material milestone, review the resulting diff as a maintainer:

- Did this create a second owner for an existing responsibility?
- Can new code be removed by reusing an existing abstraction?
- Did temporary scaffolding survive?
- Is responsibility duplicated across layers?
- Are obsolete branches/helpers/flags/config/tests now removable?
- Did implementation changes make documentation false?

For material work record a concise disposition: new production responsibilities, canonical functions reused, superseded code removed, temporary code intentionally remaining and justified debt left outside scope. Do not use raw line count as a quality target.

## 6. Security is part of implementation

When a change touches a trust boundary, review security during implementation. Check as applicable: server-side authority, tenant/object isolation, trusted-layer input validation, injection/unsafe command/query construction, CSRF/SSRF/open redirects, unsafe files/URLs, secret exposure, replay/idempotency/races/partial writes, provider/webhook verification, rate/resource/cost abuse and relevant dependency advisories.

This repository integrates sensitive providers and data paths. Keep credentials server-side and out of code, client bundles, logs, tests and committed artifacts. Do not use live payments, communications, customer data or provider changes unless the active authority explicitly permits them.

Do not weaken access checks, validation, security tests or sandboxes merely to make a workflow pass. Scanner output is evidence to investigate, not automatic proof. A credible unresolved critical security/data-integrity risk blocks release.

## 7. Test the promise, not just the implementation

For defects, reproduce the failure before fixing it where practical and add meaningful regression protection.

During implementation run focused checks. For material work, run the repository full gate:

`npm run check`

This repository currently carries substantial pre-existing whole-repository lint debt. The merge gate therefore uses a lint ratchet: `lint:changed` rejects lint errors in JavaScript/TypeScript changed by the branch, then `npm run check` runs TypeScript, Vitest and the production build. `npm run lint` remains the whole-repository debt scan. Do not claim the legacy lint baseline is clean until it has actually been remediated, and do not introduce new lint debt in changed code.

`video-editor/` is a standalone Vite/Express workspace with its own `package.json`, lockfile and TypeScript configuration. The root Next.js lint/typecheck gate intentionally excludes that workspace so a root install does not falsely compile it without its own dependencies. When an engagement touches `video-editor/`, verify it from that directory using its own lockfile and documented build/test commands, and report its result separately. A green root CI run does not verify the editor.

Run relevant Playwright/E2E suites separately when the changed workflow and available safe environment require them; do not imply an external/provider flow is verified by unit tests or mocks alone.

A passing build does not prove the workflow. A screenshot does not prove persistence or authority. A mock does not prove a required provider integration.

After fixes rerun the original reproduction, relevant negative/failure/recovery scenarios, adjacent workflows and earlier evidence invalidated by later changes.

Never delete meaningful tests, weaken assertions or rewrite acceptance merely to obtain green results.

Do not merge material changes while the required quality run is pending or failing. If repository settings cannot enforce that mechanically, treat it as a process-level merge blocker.

## 8. Use one canonical execution ledger

Use the status/plan/issue records designated by the active engagement. Existing session trackers, handoffs and debt registers remain historical/current according to the engagement that owns them; do not create competing build logs, duplicate task registers or multiple `final` status files.

Update the canonical record at meaningful boundaries: baseline/reconciliation, milestone pass, genuine blocker, consequential implementation decision, context/session handoff and authorised endpoint. Record facts/evidence, not a narrative diary.

## 9. Keep the working tree deliberate

Before editing inspect Git status and existing diffs; identify and preserve pre-existing/unrelated changes. Never reset/clean/checkout away unrelated work merely to manufacture a clean tree.

Keep generated logs, screenshots, temporary fixtures, local secrets and scratch artifacts out of version control unless deliberately required.

Before checkpoint/final handoff: inspect `git status`, inspect the full relevant diff, run `git diff --check`, remove obsolete scratch/debug artifacts and account for every remaining change.

## 10. Fresh adversarial review for material work

Before final readiness on material work, use a genuinely fresh review context when available. Give it the original approved requirements/acceptance, relevant architecture/contracts, final diff and tests/evidence — not the implementing agent's narrative defence.

Challenge duplicated ownership, unnecessary abstraction, missing deletion, security boundaries, scope drift, hidden mocks, stale documentation, tautological tests, migration leftovers and ways the code can pass its checks while still fail the real user workflow.

Investigate credible findings and repair confirmed defects. If a fresh/independent review is unavailable, record that limitation rather than inventing one.

## 11. Completion means verified behaviour

Do not report `done` because code exists or the build is green. Report material requirements as `Verified`, `Implemented but unverified`, `Blocked` or `Not implemented` according to evidence.

Finish only at the authorised endpoint or a genuine blocker/runtime boundary. Leave the repository and current execution records safe for a fresh engineer or Codex session to resume.
