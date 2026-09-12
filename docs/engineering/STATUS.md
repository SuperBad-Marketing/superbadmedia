# Engineering quality v1.5: current commission and evidence

Updated 13 September 2026 (Australia/Melbourne). Engagement ENG-20260913-QUALITY-15. Owner: Andy. Repository: `superbadmedia`. Branch: `codex/commissioning-quality-v1-5`. This is the existing engineering-system ledger, not the register for future product builds. Historical implementation findings and evidence remain available in the [prior pinned ledger](https://github.com/SuperBad-Marketing/superbadmedia/blob/e0a4563f08438349fff7f0a20951ac324a6384af/docs/engineering/STATUS.md) and its linked PRs. They are not silently reclassified as new verification.

## Actual commission

Mode/outcome: implement the latest approved guideline recommendations, test them, and deliver a verified non-production candidate. Andy instructed “Continue to implement your recommendations.” No broader product rollout is commissioned.

Current truth: baseline `main` `e0a4563f08438349fff7f0a20951ac324a6384af` read live. SW-BUILD-SOT and SW-AUDIT-SOT were retrieved and updated in place from v1.4 to v1.5. Local `COMMISSIONING.md` is the accessible working snapshot. Existing AGENTS, failure-mode, source and package/CI contracts remain.

Scope/profile: bounded documentation adoption. Add risk-based commissioning, actual-session preflight, five explicit review verdicts and evidence origins; preserve all prior engineering responsibilities and autonomous progression. Do not copy the Ops Task implementation into this repository.

Authority: existing documents and owned local artifacts; bounded source/guard changes; new review branch, commit/PR and existing safe CI. Canonical application data, providers, production, settings, paid services, merge and deployment are not authorised. Earlier merge instructions applied to earlier delivered changes. Audit-only work under the resulting guideline still does not grant repair authority.

Architecture: extend the existing root working contract with one linked portable commissioning guide; retain all application-specific restrictions and quality commands. Prefer this bounded extension to a new generic framework.

Acceptance: AC-15-01 preserved instructions/autonomy/authority; AC-15-02 seven commissioning answers and three risk profiles; AC-15-03 actual-session preflight with safe independent continuation; AC-15-04 PASS/PASS_WITH_NOTES/FAIL/BLOCKED/NOT_ASSESSED with missing critical evidence never passed; AC-15-05 distinguish evidence origins; AC-15-06 existing full repository gate unchanged and passing at the exact candidate revision.

## Execution and evidence boundary

M0 sources/authority/baseline reconciled. M1 standards and portable guide prepared, prior responsibilities preserved. M2 source-only document adoption prepared; M3 requires actual candidate CI, bounded adversarial review and final evidence reconciliation. Final candidate revision, CI results, current blockers and readiness disposition are maintained in this branch's PR and GitHub check records. Do not infer a passing final head, merge or deployment from this commissioning snapshot.

Preflight observed: connector reads/writes available; local Node 22.16.0 and Git available; container DNS cannot resolve GitHub; candidate directories are partial source snapshots without installed application dependencies. They are not full clones. No local application build or complete-upstream Git diff is claimed. Changes use parent-based Git trees, exact file hashes and changed-path review to preserve unrelated source. Installed dependency/full-gate verification uses the existing GitHub runner. No sandbox setting was changed.

Required command remains `npm run check`, including the unchanged diagnostic-aware root debt ratchet. The historical 26 failure identities and 40 skipped assertions are contained debt, not passes; new runs must be inspected rather than assuming those numbers. The separately packaged `video-editor/` remains outside root verification and unchanged. No debt baseline, dependency, application, test or CI file is changed here.

Residual limits: existing dependency/engine findings require separate applicability triage; root green is not provider, editor or application readiness. Fresh independent review, enforced branch protections and longitudinal agent behaviour are not claimed.

The authorised endpoint is a verified unmerged candidate and refreshed handoff. Continue eligible testing and in-scope repair automatically. Complete reviews may contain FAIL or BLOCKED conclusions without authorising unrelated fixes. Release and broader quality rollout need their own authority.
