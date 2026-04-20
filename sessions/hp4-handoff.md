# HP-4 Handoff — Hiring Pipeline: Quick-Add Primitive + Candidate Scoring

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Candidate scoring — `lib/hiring/score-candidate.ts`

`scoreCandidateAgainstBriefs(signal, briefs)` — scores a PortfolioSignal against one or more Role Briefs via `hiring-candidate-score` (Haiku). Returns `ScoringResult[]` sorted by score descending. Each result includes:
- `score` (0..1, clamped)
- `reasoning` (one-sentence LLM explanation)
- `name_guess` (LLM's best guess at the person's name from portfolio data, or null)

Scores all briefs in parallel. Handles malformed JSON gracefully (returns score 0 with explanation). Strips markdown fences from LLM response.

### Invite drafting — `lib/hiring/draft-invite.ts`

`draftInviteEmail(input)` — drafts a personalised invite email via `hiring-invite-draft` (Sonnet). Input includes candidate name, PortfolioSignal, role name, style summary, and extracted tags. Returns:
- `subject`, `body` — the draft email
- `confidence` (0..1) — LLM self-rating on fit + draft quality

Prompt enforces SuperBad voice rules (dry, observational, short sentences, no corporate speak). Handles malformed JSON by returning raw LLM text as body with confidence 0.

### Quick-Add server actions — `app/lite/admin/hiring/actions.ts`

Two new actions:

- `quickAddCandidateAction(url)` — the full §5.3 flow:
  1. Validates and normalises the URL (auto-prepends `https://` if needed)
  2. Calls `ingestPortfolioUrl()` for platform detection + signal
  3. Loads all open Role Briefs
  4. If open briefs exist, scores against all; attaches to highest-scoring role
  5. Extracts candidate name from URL slug; overrides with LLM name_guess if available
  6. Creates candidate in Sourced via `createCandidate()`
  7. Updates candidate with portfolio_signal_json + brief_match_score
  8. Logs `candidate_sourced` activity with full meta
  9. Drafts invite via `draftInviteEmail()`
  10. Returns full result (candidate, score, draft)

- `confirmQuickAddInviteAction(candidateId)` — moves candidate from Sourced → Invited via `transitionCandidateStage()`

### Quick-Add UI — `components/lite/hiring-pipeline/quick-add-bar.tsx`

Persistent URL input bar at the top of the hiring kanban page. Features:
- Single text field + "Add" button (spec §5.3: "one field")
- Loading spinner during ingestion/scoring/drafting
- Animated result panel (Framer Motion, houseSpring) showing:
  - Candidate name + platform chip
  - Matched role name + colour-coded score percentage
  - LLM scoring reasoning (italic narrative font)
  - Invite draft preview with subject + body + confidence label
- Two action buttons: "Send invite" (→ Invited) and "Keep in Sourced" (dismiss)
- Auto-focuses input after each action
- Follows design system tokens throughout (CSS vars, font families, spacing)

### Integration — `components/lite/hiring-pipeline/hiring-board.tsx`

QuickAddBar imported and rendered at the top of the HiringBoard, above role brief filter chips.

## New files

- `lib/hiring/score-candidate.ts`
- `lib/hiring/draft-invite.ts`
- `components/lite/hiring-pipeline/quick-add-bar.tsx`
- `tests/hp4-quick-add-scoring.test.ts` (27 tests)

## Edited files

- `app/lite/admin/hiring/actions.ts` — `quickAddCandidateAction()` + `confirmQuickAddInviteAction()` + type exports
- `components/lite/hiring-pipeline/hiring-board.tsx` — QuickAddBar integration
- `lib/hiring/index.ts` — barrel exports for score-candidate + draft-invite

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 239 files, 2171 passed, 1 skipped (pre-existing)
- Browser check: not applicable (LLM calls require live API keys; UI component validated via typecheck + test coverage)

## Key decisions

- **Name extraction from URL** — since spec requires "one field" (URL only), candidate names are extracted from the URL slug (e.g., `vimeo.com/jane-doe` → "Jane Doe"). The scoring LLM also returns a `name_guess` which overrides the URL-derived name when available. Full name extraction improves in HP-5/HP-6 when platform-specific API handlers return real profile data.
- **No actual email sending** — "Send invite" moves the candidate to Invited and shows a toast, but doesn't fire an email. Actual email sending is gated by the invite send gate (§8.2) which involves throttles, daily caps, confidence thresholds, and the email adapter — that wiring lands in a later HP session.
- **Parallel scoring** — all open briefs are scored in parallel via `Promise.all()`. Acceptable for v1 (unlikely to have more than 5-10 open briefs simultaneously).
- **Score stored on candidate** — only the best score is stored on `brief_match_score`. The full scoring results (all briefs) are not persisted — just used for the Quick-Add result UI.

## Rollback

- Git-revertable: all new files are additive. Action additions are additive. Board import is additive. Barrel exports are additive.

## Settings keys consumed

- None directly in HP-4. The scoring and drafting functions use the model registry (`hiring-candidate-score`, `hiring-invite-draft`) but don't read settings keys. Auto-invite threshold (`hiring.discovery.auto_invite_score_threshold`) and send gate thresholds (`hiring.invite.auto_send_confidence_threshold`) land with the discovery agent (HP-6) and invite send gate (HP-7 or similar).

## Next session should know

- HP-5/HP-6 should flesh out `ingestPortfolioUrl()` with real platform-specific API handlers (Vimeo metadata, Behance project extraction, Apify IG, vision model). The scoring and invite drafting quality will improve significantly with richer PortfolioSignal data.
- The invite send gate (§8.2) — auto-send on high confidence, drafts queue for low confidence, throttles, daily caps — is not yet wired. Quick-Add currently always queues to Sourced and lets Andy confirm manually.
- The `extractNameFromUrl` helper is private to the actions file. If other ingestion paths need it, consider extracting to `lib/hiring/portfolio.ts`.
- QuickAddBar renders at the top of HiringBoard. If the page layout needs adjustment, the bar is a self-contained component.
