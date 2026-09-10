# Engineering-system v1.3 adoption — current execution record

Updated 11 September 2026 (Australia/Melbourne). Scope: implement named product/agent/verification failure contracts and audit/pressure-test the engineering process. Not a whole-application remediation, live release or video-editor certification. Governing sources: SW-BUILD-SOT and SW-AUDIT-SOT v1.3; local FAILURE_MODES.md. Authorised by Andy's instruction to implement and audit the system and continue the interrupted work.

Authority: documentation and bounded code repairs on `codex/failure-mode-controls-v1-3`, synthetic fixtures, existing CI and PR updates. No merge, deployment, production/provider/data changes or paid services. Independent fresh-agent execution was unavailable, not performed. Preserve unrelated work.

Baseline: main `3185217aea0d9120de37f21657d9279c8a3d4a8f`. PR #2. Verified code head: `e7908a41b3a87ef68e3ccf079d5dc8868ee4f033`. This final status-only commit does not change the verified guard/application/test/configuration files; it records their evidence. Recheck the final PR head status before merge. PR CI evidence is not post-merge or production evidence.

## Milestones and disposition

M0 current-source reconciliation — complete. Both SOTs contain v1.3. Earlier final text denying saved writes was contradicted by successful writes and current sources; it is not the baseline.
M1 AGENTS/local contract — implemented and inspected. All eleven original responsibilities are preserved, plus explicit failure controls; historical authority and standalone editor boundaries remain explicit.
M2 guard remediation — implemented and fixture-tested, with confirmed findings below.
M3 full candidate CI and system review — complete within the engineering-control scope. CI #31/run 34539704836/job 103079343055: npm ci and npm run check SUCCESS, associated head e7908a41b3a87ef68e3ccf079d5dc8868ee4f033. Earlier integrated candidate CI #30/run 34538467415 also passed; the later run re-verifies the second-pass fixes.
M4 evidence/handoff — complete at the unmerged candidate boundary. Merge and deployment remain not performed. No further product decision was needed to complete the eligible implementation work.

Evidence: https://github.com/SuperBad-Marketing/superbadmedia/actions/runs/34539704836

## Confirmed findings and repairs

ENG-01: previous changed-lint selection could compare origin/main to HEAD after a merge and inspect nothing. The revised selector uses explicit PR base/push-before SHA, rejects invalid/self bases, preserves NUL-delimited filenames and checks every selected ESLint result. Real-Git and delivered-CLI controls exercise committed, staged, unstaged and untracked paths, unusual filenames and erroneous/ignored/omitted outputs.

ENG-02: the identity-only ratchet could accept empty/incomplete outputs, abnormal exit codes with known failures, changed diagnostics beneath the same title and missing/skipped debt as apparent improvement. A custom installed-Vitest lifecycle report, nonce/revision, independent file inventory, strict exit/error matching and diagnostic-aware trusted-base comparison replace it. No new failure or skipped-test allowance is silently accepted.

ENG-03: initial CI #28/run 34491110624/job 102917770799 exposed getMelbourneHour returning 24 around midnight under Node 20/ICU. It was not in the permitted baseline. The canonical helper now specifies h23; nine explicit timestamps cover midnight, adjacent hours and DST transitions. Existing assertions remain. This bounded repair avoids waiting or rerunning until the clock makes the test pass; no calendar rewrite was made.

ENG-04: second-pass adversarial fixtures showed missing retry-status data, a skipped assertion retaining errors and a skipped module containing executed assertions were not explicitly rejected. Three red controls reproduced these parser gaps; the validator now rejects them. Local result changed from 38 pass / 3 fail / 1 installed-runner skip to 41 pass / 0 fail / 1 installed-runner skip; actual CI #31 exercises the installed runner as a required control.

ENG-05: a calibration unit test depended on the live baseline remaining at its initial exact size, which would obstruct future verified debt retirement. Replaced that coupling with synthetic rejection cases. The separately observed positive calibration is verified by actual CI #30/#31; normal v2 shrink-with-passing-repair remains explicitly tested. No duplicate permanent calibration ledger was introduced.

## Baseline calibration evidence

CI #29/run 34536969692/job 103070742405 captured unchanged application/tests/dependencies at PR merge `001a4ec2a7f42364c00c218c1ed1d5c4aef5c1b4`, head `8c7638c1c36921fa273ab492a53f6c93a2f527da`. Selected/reported 291 files; 2956 assertions: 2894 passed, 22 failed, 40 skipped; four module failures give the same 26 previously permitted failure identities. Extra/missing identities were both empty. That run deliberately failed for calibration review; it is not a green application test run.

The reviewed v2 data retains those 26 identities with diagnostic fingerprints and explicitly records 40 already-skipped assertions. This exposes existing skips; it does not skip additional tests. Initial migration is pinned to the original target and digest `5cede9ba5f7fe9eb789b5f853d96f4f099f43d389ad1d875a440098a6ed73fb4`. The midnight defect was repaired separately, never baselined. Temporary capture-only orchestration was removed. Future allowance removal needs passing repair/replacement evidence. Fingerprints represent supplied diagnostics, not proof that every possible underlying cause is identical.

## Verification scope

The engineering suite contains 43 Node test cases: 42 report/baseline/Git/CLI/reporter cases plus one full-chain failure-propagation case. Cases may exercise multiple isolated scenarios; do not inflate that into a count of verified application workflows. Actual installed Vitest controls check valid, failing, zero-selection and unhandled-error runs. Simulated ESLint/npm outputs exist only in labelled disposable fixtures; real ESLint and the root Vitest/build also ran in the full CI gate. All original quality stages are retained. Nine deterministic timestamp regression cases run in the normal root Vitest suite.

Direct container cloning/dependency install was unavailable because of DNS; local source snapshots are not full Git clones. Actual dependency/full-gate verification used the authorised GitHub runner. Parent-based Git writes and changed-path inspection preserve unrelated source. Do not claim a full local application build or local complete-repository git diff --check from those snapshots. Owned fixture resources use cleanup on success and failure; no customer data is involved.

## Whole-process pressure review and residual limits

Semantic self-review reconciled original scope, authority, system awareness, context recovery, canonical ownership, safe deletion, security, ledger uniqueness, worktree preservation, failure/recovery, acceptance, gate integrity and completion. Expected handling was challenged for stale plans, conflicting local contracts, forced reuse, dynamic callers, dirty trees, unknown external outcomes, prompt injection, skipped evidence and blocked dependent work. These are tabletop contract checks, not measured Codex behaviour.

No genuinely independent reviewer, long-session instruction-loading/compliance experiment or tamper-proof external policy was available. An actor able to alter checks and tests can bypass self-enforcement. Required-status settings are not claimed newly installed; pending/failed required runs remain process-level merge blockers. No keyword count or CI pass is evidence of future perfect agent adherence.

Known legacy debt remains: raw npm test is non-green; root green never verifies video-editor or real provider commissioning. Existing Node-engine mismatch and dependency advisories need applicability triage before an application-readiness/release claim; no blind upgrade occurred. This is a verified engineering-control candidate with explicit limits, not application user-readiness, zero security risk or production parity.

Next safe action: inspect final PR status and obtain the separate merge decision. After an authorised merge, verify the exact post-merge run. Preserve this record; future builds use their own designated execution ledger.
