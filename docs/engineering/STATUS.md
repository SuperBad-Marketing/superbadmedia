# Engineering-system v1.3 adoption — current execution record

Scope: implement named product/agent/verification failure contracts and audit/pressure-test the engineering process. Not a whole-application remediation or video-editor certification. Governing sources: SW-BUILD-SOT and SW-AUDIT-SOT v1.3; local FAILURE_MODES.md. Authorised by Andy's instruction to implement and audit the system, including this continuation.

Authority: documentation and bounded code repairs on `codex/failure-mode-controls-v1-3`, synthetic fixtures, existing CI and PR updates. No merge, deployment, production/provider/data changes, paid services or independent-agent invocation is authorised or claimed. Preserve unrelated work.

Baseline: main `3185217aea0d9120de37f21657d9279c8a3d4a8f`. PR #2. Latest code revision is the commit containing this record; CI must be matched to that head or its identified PR merge artifact, not stale prior results.

## Milestones

M0 — Current-source reconciliation: complete. Both SOTs already contain v1.3. Earlier final message claiming no writes was inconsistent with successful saved writes; current sources prevail.
M1 — AGENTS/local failure contract: implemented, including all eleven original responsibilities plus explicit failure-mode controls; historical authority and standalone editor boundaries preserved.
M2 — Mechanical gate remediation: implemented; verification below.
M3 — Full candidate CI and adversarial system reconciliation: pending against this candidate. Continue automatically; never accept the calibration-only failure as green.
M4 — Final evidence and PR readiness: pending. No routine user permission is needed to continue M3/M4. Merge remains outside authority.

## Confirmed findings and repairs

ENG-01: previous changed-lint selection could compare origin/main to HEAD after a merge, returning no files. The revised selector uses explicit PR base/push-before SHA, rejects invalid/self bases, preserves NUL-delimited filenames and checks every selected ESLint result. Local real-Git and CLI-output controls passed.
ENG-02: the previous identity-only ratchet could accept empty/incomplete outputs, abnormal exit codes with known failures, changed causes beneath the same title and missing/skipped debt as apparent improvement. A custom installed-Vitest lifecycle report, nonce/revision, independent file inventory, strict exit/error matching and diagnostic-aware trusted-base checks replace it.
ENG-03: initial CI #28 (34491110624/job 102917770799) additionally exposed getMelbourneHour returning 24 around midnight under Node 20/ICU. This was not in the permitted baseline. The canonical helper now specifies h23; nine explicit timestamps cover midnight, adjacent hours and DST transitions. Existing assertions are retained. This bounded repair prevents rerun-to-green behaviour; it is not a broad date/calendar rewrite.

## Baseline calibration evidence

CI #29/run 34536969692/job 103070742405 inspected unchanged application/tests/dependencies at PR merge `001a4ec2a7f42364c00c218c1ed1d5c4aef5c1b4`, head `8c7638c1c36921fa273ab492a53f6c93a2f527da`. Selected/reported 291 files; 2956 assertions: 2894 passed, 22 failed, 40 skipped; four additional module failures give the same 26 permitted failure identities. Extra/missing failure identities were both empty. This run deliberately failed for calibration review, not application regression.

The reviewed v2 data preserves exactly those 26 identities and adds fingerprints plus visibility of the 40 already-skipped assertions; it does not skip more tests. The initial migration is pinned to the original target and digest `5cede9ba5f7fe9eb789b5f853d96f4f099f43d389ad1d875a440098a6ed73fb4`. The midnight issue is repaired separately, never baselined. Temporary evidence-only calibration orchestration was removed. Future baseline shrinking requires passing repair evidence.

## Verification and limitations

Local source-snapshot controls: 38 report/baseline/real-Git/lint-CLI controls passed with Node 22.16.0. Installed-runner verification was unavailable locally because dependencies could not be retrieved in the container; CI must execute the mandatory real reporter controls and full gate. New chain test preserves and rejects failures at every actual check stage. Negative controls simulate tool outputs only inside labelled disposable fixtures; they are not application verification.

Semantic adversarial review covers scope preservation, canonical ownership, context recovery, deletion, trust boundaries, ledger uniqueness, worktree ownership, failure recovery, provenance and completion claims. No genuinely independent fresh reviewer or long-session compliance experiment occurred. Self-editable guards remain bypassable by an actor permitted to edit both checks and tests; independent control is a residual boundary, not a solved security property.

Known legacy debt remains: raw npm test is non-green; root success never verifies video-editor or real provider commissioning. Existing Node-engine mismatch and dependency advisories require applicability triage before any application-readiness/release claim; no blind upgrade was performed. Whole-suite success is not promised here.

Next safe action: inspect candidate CI, diagnose failures without weakening controls, re-run affected negative/valid checks, then update this record and PR with exact evidence. Continue safe independent repository/resource work while CI runs.
