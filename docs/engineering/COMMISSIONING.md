# Build commissioning and launch preflight

Portable working snapshot: SW-BUILD-SOT / SW-AUDIT-SOT **v1.5**. Apply this guidance to the active engagement, not to every historic task. The full canonical standards define the method; the approved product pack defines this build. This file is a reusable field guide, not an active scope, approval, task register or readiness certificate.

## Bind one actual commission

Put the following answers in the engagement's existing README/PLAN/STATUS or equivalent. Link existing answers rather than duplicating them. For a bounded fix, a short combined record is sufficient. A review archive is evidence, not an executable build assignment.

1. **Mode and outcome:** build, repair, review-only or an expressly authorised combination; actors and observable completion. Audit-only does not permit repairs.
2. **Current truth:** scope/source versions, applicable instruction paths, repository/branch/revision and worktree differences, relevant architecture; inspected versus deployed relationship. Resolve from current records before asking Andy.
3. **Scope and applicability:** included/excluded requirements, acceptance IDs, decided policies and the risk profile below. Small diffs do not make permission or data changes low risk.
4. **Authority and environment:** allowed source/report/scratch writes, installs and script hooks, local/sandbox/provider access, data rules, commit/push/PR/merge/deploy permissions and spending. Distinguish read-only source from permitted disposable test copies. Missing authority is not supplied by a template.
5. **Architecture:** canonical owners and verified reference paths; responsibilities extended versus genuinely new responsibilities; simplest sufficient alternative and material tradeoff. Reuse examples only where their guarantees match.
6. **Acceptance:** each required outcome/failure scenario, actual commands and fixtures, environment, required evidence and blocked prerequisites. Record applicability and exceptions, not arbitrary coverage percentages.
7. **Execution and endpoint:** dependency-aware milestones, one current ledger, stopping/recovery rules, candidate/review/release endpoint and any expressly required business acceptance.

No unresolved placeholders in a declared build-ready commission. Existing approval is reused, not requested again. A verified candidate can be the authorised endpoint; it is not a live release.

## Choose the minimum sufficient profile

| Profile | Required application |
|---|---|
| Bounded, low risk | Inspect the affected path, preserve scope/authority, make the correction, run relevant checks and leave concise evidence. No new multi-file pack is required. |
| Material feature/refactor | Complete workflow and architectural-impact contract, requirement-derived tests, relevant integration/browser and adjacent evidence, code-health review and exact full-gate result. |
| Consequential boundary | Apply all relevant material-change controls plus direct evidence for affected permissions, client isolation, persistence/concurrency, migration, deletion, publication or external effects. A one-line change can qualify. |

Profiles select relevant controls; they do not waive existing acceptance or security requirements. In mixed work apply stronger controls to the affected boundary without burdening unrelated changes. Record a reason for non-applicability. Reassess when scope or risk changes; ordinary engineering choices remain delegated.

## Preflight in the actual execution session

Before dependent edits or commands, confirm the repository/root and instruction chain this session loaded; scope, baseline and existing dirty work; available runtimes/dependencies/browser/database tools; reviewed setup scripts and lifecycle hooks; safe writable paths and fixture ownership; network/provider isolation; actual sandbox/approval restrictions; permitted remote actions; required checks and endpoint. Record facts and safe metadata, never secret values.

A remote AGENTS file or a chosen prose permission does not configure the running sandbox. Do not disable isolation or expand credentials to reduce prompts. Recheck affected preflight evidence after a restart, context loss, environment change or scope change, not after every tool call. Resolve safe setup within the existing authority. If a prerequisite is unavailable, mark its dependent work BLOCKED and continue safe independent work. A successful preflight leads straight into execution without another approval pause.

## Evidence and review verdicts

Record evidence origin with each material conclusion: historical report; source inspected; original execution evidence inspected; independently reproduced in this engagement. Also record source/revision, environment, steps/result, scope and limitations. These origins are not interchangeable. A passing pack checksum is not an engineering verdict.

Use **PASS / PASS_WITH_NOTES / FAIL / BLOCKED / NOT_ASSESSED** for review conclusions. PASS and PASS_WITH_NOTES require all applicable mandatory evidence for that dimension. Notes are genuinely non-blocking, not missing critical checks or unapproved scope deferrals. FAIL means a demonstrated acceptance failure. BLOCKED means a known access, authority or critical-verification prerequisite prevents a conclusion. NOT_ASSESSED means work has not yet been examined. A reasoned NOT_APPLICABLE can disposition a dimension but is not a blanket verdict.

Report dimensions separately. Never average a failure, blocked critical check or unassessed required area into a pass. A completed review can report FAIL/BLOCKED without being an incomplete review. It does not authorise fixing its findings. For already-authorised implementation/remediation, diagnose and repair in-scope failures, reverify and automatically advance through all eligible milestones. Routine test failures are not user judgement calls.

## Preserve the acceptance, not a test count

Bind mandatory acceptance/failure scenarios to meaningful executable test identities and required environments. Reject missing or substituted scenarios even when a file remains and totals are green. Additional valid tests are allowed. A rename/replacement/retirement must preserve or explicitly disposition the underlying requirement with evidence and applicable authority; do not silently lower the denominator or edit both requirement and test to excuse a failure. A self-editable scenario map improves detection but is not independent or tamper-proof enforcement.

## A bounded finish

Finish when the authorised requirements and review dimensions are accounted for at their required evidence level, or when genuine blockers/runtime limits are accurately handed off. Record escaped defects, avoidable interventions, missed requirements and rework in the existing engagement closeout as real deliveries occur. Do not invent longitudinal success rates or run an unrelated benchmark programme merely because this guide exists.
