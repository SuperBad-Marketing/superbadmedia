# HP-7 Handoff — Hiring Pipeline: Apply Form + LLM Follow-up Question

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Public apply route — `app/apply/page.tsx`

Server-rendered page at `/apply` with SuperBad branding (not "Lite"). Fetches open role briefs and rate band settings at render time. Renders the `ApplyFormClient` component.

Metadata: "Work with SuperBad" title + OG tags.

### Apply form client — `app/apply/apply-form-client.tsx`

Client component with all form fields per spec §7.1:

1. Name (required)
2. Email (required, validated)
3. Role (dropdown from open role_briefs + "Other / general interest")
4. Portfolio URLs (1–3 inputs, at least 1 required, "add another link" button)
5. Location — city, free-text
6. Rate expectation — band dropdown from `hiring.apply.rate_bands` setting
7. Availability — hours/week dropdown (<5, 5–10, 10–20, 20+) + earliest start date
8. "Know someone who'd be good?" — optional free-text for referral URLs

Styling matches trial-shoot landing: dark background (neutral-900), atmosphere gradients, noise overlay, brand typography (narrative italic headers, label uppercase, body text). House spring on form and button. Error display with AnimatePresence.

On success, redirects to `/apply/confirmation`.

### Confirmation page — `app/apply/confirmation/page.tsx`

Static page at `/apply/confirmation`. SuperBad branding, centered layout. "Got it." header + brief message hinting at the follow-up email. `robots: { index: false }`.

### Server action — `app/apply/actions.ts`

`submitApplyFormAction()` — validates input via Zod schema, delegates to `processApplication()`. Returns `{ ok: true }` or `{ ok: false, reason }`.

### Apply business logic — `lib/hiring/apply.ts`

**`processApplication(input)`:**
- Normalizes email to lowercase
- Checks for existing candidate by email (via `findCandidateByEmail` — new private helper using email index)
- If existing Sourced/Invited candidate: transitions to Applied, updates fields
- If new candidate: creates with stage=Applied, source=applied, then updates followup_status to pending
- Logs `candidate_applied` activity with source metadata
- Parses "recommend someone" field for HTTP/S URLs → creates Sourced/referred candidates (max 3)
- Enqueues `hiring_apply_followup_send` task with 2-minute delay

**`generateAndSendFollowup(candidateId)`:**
- Guards: candidate must exist, stage=applied, has email, no existing followup question
- Ingests first portfolio URL via `ingestPortfolioUrl()` → saves signal + timestamp
- Scores candidate against brief (if linked) via `scoreCandidateAgainstBriefs()`
- Generates follow-up question via `hiring-followup-question-draft` (Haiku) — reads portfolio signal, role brief, form answers
- Strips surrounding quotes from LLM response
- Saves question to candidate record
- Sends email via `sendEmail()` with classification `hiring_followup_question`

**Email body:** bartender voice. "Hey {firstName}, thanks for putting your hand up. Had a look through your work — one thing I wanted to ask: {question}. No rush. Just reply to this email whenever."

### Follow-up question prompt — `lib/ai/prompts/hiring/followup-question-draft.ts`

`buildFollowupQuestionPrompt()` — takes candidate info + portfolio signal + brief context. Instructs Haiku to write one specific, short (<30 words) follow-up question based on their portfolio. Includes example questions per spec.

`buildFollowupQuestionSystem()` — creative director persona, dry + direct.

### Scheduled task handler — `lib/scheduled-tasks/handlers/hiring-apply.ts`

`handleHiringApplyFollowupSend` — gated by `llm_calls_enabled` kill switch. Reads candidate_id from task payload, calls `generateAndSendFollowup()`.

Registered as `HIRING_APPLY_HANDLERS` in the handler registry.

## New files

- `app/apply/page.tsx`
- `app/apply/apply-form-client.tsx`
- `app/apply/actions.ts`
- `app/apply/confirmation/page.tsx`
- `lib/hiring/apply.ts`
- `lib/ai/prompts/hiring/followup-question-draft.ts`
- `lib/scheduled-tasks/handlers/hiring-apply.ts`
- `tests/hp7-apply-form.test.ts` (19 tests)

## Edited files

- `lib/db/schema/scheduled-tasks.ts` — added `hiring_apply_followup_send` task type
- `lib/scheduled-tasks/handlers/index.ts` — registered `HIRING_APPLY_HANDLERS`
- `lib/hiring/index.ts` — barrel export for apply module

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 242 files, 2239 passed, 1 skipped (pre-existing)
- Browser check: form renders correctly, styled matching trial-shoot landing, all fields functional. Confirmation page renders. (Live email/LLM requires API keys; validated via typecheck + 19 new tests)

## Key decisions

- **Follow-up via scheduled task, not inline** — the form submission returns immediately (confirmation redirect). Portfolio ingestion + LLM question generation + email send happen ~2 min later via `hiring_apply_followup_send` task. Matches spec's "within ~2 minutes" requirement while keeping the form snappy.
- **Single portfolio URL ingested** — only the first portfolio URL is ingested for the follow-up question prompt. All URLs are stored in `portfolio_urls_json`. Full ingestion of all URLs can happen in a future session if needed.
- **Rate band parsing is lenient** — `parseRateBand` extracts the first integer from the band string (e.g., "$50" from "$50–80/hr"). Returns null for bands with no numbers (e.g., "Negotiable").
- **Referral URL parsing is simple** — regex extracts HTTP/S URLs from the "recommend someone" free-text. Max 3 referrals created per submission. Each gets a Sourced/referred candidate with the URL's hostname as a placeholder name.
- **No-reply check is deferred** — per BUILD_PLAN, `hiring_invite_followup_check` (the sweep that sets `followup_status = 'no_reply'` after N days) is HP-11 scope. This session sets status to `pending` at submission time.

## Rollback

- Git-revertable: all new files are additive. Edits to existing files are additive (new task type in enum, new handler in registry, new barrel export). No existing function signatures changed.

## Settings keys consumed

- `hiring.apply.rate_bands` — JSON array of rate band options for the form dropdown
- `hiring.apply.followup_reply_wait_days` — referenced in spec but not consumed in HP-7 (consumed by HP-11's no-reply sweep)
- `hiring.discovery.vimeo_enabled` — consumed indirectly via portfolio ingestion
- `hiring.discovery.behance_enabled` — consumed indirectly via portfolio ingestion

## Next session should know

- Reply matching is not yet wired — when a candidate replies to the follow-up email, it lands in Unified Inbox but doesn't automatically update the candidate's `application_followup_reply` and `followup_status`. That's a future HP session responsibility.
- The `hiring_invite_followup_check` sweep (HP-11 per BUILD_PLAN) handles the no-reply flagging after `hiring.apply.followup_reply_wait_days`.
- Brand-voice drift check is available via `checkBrandVoiceDrift()` but not wired into the follow-up question flow. If drift checking is desired, it can be added in a content calibration session.
- The form currently has no spam/rate-limit protection. For v1 this is acceptable (low traffic); a future session could add Turnstile or IP-based rate limiting.
- `ensureHiringDiscoveryEnqueued()` from HP-6 should be called after wizard completion (HP-2 built the wizard). Verify this is wired.
