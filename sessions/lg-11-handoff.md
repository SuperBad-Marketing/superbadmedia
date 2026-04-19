# `LG-11` — Case snippets + retargeting pixel + autonomy adjustment — Handoff

**Closed:** 2026-04-19
**Type:** FEATURE (medium)
**Model tier:** Sonnet

---

## What was built

### 1. `case_snippets` table + schema (`lib/db/schema/case-snippets.ts`)

New table with milestone_type (shoot_completion | retainer_90d), vertical, location, headline, paragraph, metrics_line, status (pending → approved | rejected), auto_approved flag. Indexes on status+vertical+created_at and company_id.

### 2. `generateCaseSnippet()` module (`lib/lead-gen/case-snippets.ts`)

Full module with:
- `generateCaseSnippet()` — Haiku-tier LLM generation from brand DNA + milestone context. Enqueues 48h auto-approve scheduled task on creation.
- `approveCaseSnippet()` / `rejectCaseSnippet()` — manual approval/rejection.
- `autoApproveCaseSnippet()` — checks status is still pending before flipping.
- `getBestMatchingSnippet()` — query for outreach draft consumption: same-vertical preferred, any-vertical fallback, most recent first.

### 3. Scheduled task handlers (`lib/scheduled-tasks/handlers/case-snippet.ts`)

Two handlers registered in the handler registry:
- `case_snippet_auto_approve` — fires 48h after creation, calls `autoApproveCaseSnippet()`.
- `case_snippet_retainer_90d` — stub handler for 90-day retainer milestone (full wiring requires Client Context + Brand DNA queries from future modules).

### 4. `classifyEdit()` function (`lib/lead-gen/classify-edit.ts`)

Levenshtein-based edit classification:
- `clean` — no body changes
- `minor` — subject unchanged, body diff ≤ `autonomy.minor_edit_char_threshold` (default 3) OR change ratio ≤ `autonomy.material_edit_ratio_threshold` (default 0.2)
- `material` — subject changed, or body substantially rewritten

Exports `levenshteinDistance()` for testing.

### 5. Autonomy state machine updates

- **Graduation threshold schema default:** 10 → 5 (column default + migration updating existing rows).
- **`minor_edit_approval` event type** added. Handled in same branch as `clean_approval` — does not break streak.
- **`approval_kind` enum** extended with `minor_edit_manual` and `edited_manual`.

### 6. Retargeting pixel redirect (`app/api/outreach/click/route.ts`)

GET endpoint at `/api/outreach/click?t=<hmac_token>`. Flow:
1. Validates HMAC token via `verifyClickToken()`.
2. Records click on `outreach_sends` (first_clicked_at, click_count).
3. Returns transparent HTML page that fires Meta Pixel (`fbq('track', 'Lead')`) and Google Ads tag (`gtag('event', 'conversion')`) if configured.
4. Redirects to target URL via `setTimeout(0)`.

### 7. Click token module (`lib/lead-gen/click-token.ts`)

HMAC-SHA256 signed tokens for outreach link wrapping. Same pattern as unsubscribe tokens. `wrapOutreachLink(sendId, targetUrl)` produces the full wrapped URL.

### 8. Migration (`0049_lg11_case_snippets.sql`)

- Creates `case_snippets` table + indexes.
- Updates existing `autonomy_state` rows: graduation_threshold 10 → 5.
- Seeds 6 new settings keys.

### 9. Settings keys (6 new)

| Key | Default | Type |
|---|---|---|
| `snippet.auto_approve_hours` | `48` | number |
| `retargeting.meta_pixel_id` | `null` | string \| null |
| `retargeting.google_conversion_id` | `null` | string \| null |
| `autonomy.graduation_threshold` | `5` | number |
| `autonomy.minor_edit_char_threshold` | `3` | number |
| `autonomy.material_edit_ratio_threshold` | `0.2` | number |

### 10. Enum extensions

- `ACTIVITY_LOG_KINDS` += 4 (`case_snippet_drafted`, `case_snippet_approved`, `case_snippet_auto_approved`, `case_snippet_rejected`)
- `SCHEDULED_TASK_TYPES` += 2 (`case_snippet_auto_approve`, `case_snippet_retainer_90d`)
- `OUTREACH_APPROVAL_KINDS` += 2 (`minor_edit_manual`, `edited_manual`)
- LLM model registry += 1 (`lead-gen-case-snippet` → haiku)

### New files (7)

| File | Purpose |
|---|---|
| `lib/db/schema/case-snippets.ts` | Case snippets table schema |
| `lib/lead-gen/case-snippets.ts` | Generate, approve, reject, query snippets |
| `lib/lead-gen/classify-edit.ts` | Levenshtein-based edit classification |
| `lib/lead-gen/click-token.ts` | HMAC click tracking tokens |
| `app/api/outreach/click/route.ts` | Retargeting pixel redirect endpoint |
| `lib/scheduled-tasks/handlers/case-snippet.ts` | Auto-approve + retainer 90d handlers |
| `lib/db/migrations/0049_lg11_case_snippets.sql` | Migration |

### Edited files (9)

| File | Change |
|---|---|
| `lib/db/schema/index.ts` | Export case-snippets |
| `lib/db/schema/activity-log.ts` | +4 kinds |
| `lib/db/schema/scheduled-tasks.ts` | +2 task types |
| `lib/db/schema/outreach-drafts.ts` | +2 approval kinds |
| `lib/db/schema/autonomy-state.ts` | Default 10→5 |
| `lib/settings.ts` | +6 settings keys |
| `lib/ai/models.ts` | +1 job slug |
| `lib/lead-gen/autonomy.ts` | +minor_edit_approval event |
| `lib/scheduled-tasks/handlers/index.ts` | Register case snippet handlers |

### Test files (4 new, 1 edited)

| File | Tests |
|---|---|
| `tests/lg11-classify-edit.test.ts` | 10 — Levenshtein + classification logic |
| `tests/lg11-click-token.test.ts` | 4 — Token creation, verification, wrapping |
| `tests/lg11-case-snippets.test.ts` | 2 — Schema exports |
| `tests/lg11-autonomy-minor-edit.test.ts` | 3 — Approval kinds, autonomy schema |
| `tests/lead-gen/lg1-schema.test.ts` | Updated assertion: 3→5 approval kinds |

## Key decisions

1. **`retainer_90d` handler is a stub.** It calls `generateCaseSnippet()` with empty context. Full wiring (reading Brand DNA profile + Client Context summary + deliverables count + audit scores) will happen when those modules are consumed in later waves.

2. **Settings-backed thresholds everywhere.** `classifyEdit()` reads `autonomy.minor_edit_char_threshold` and `autonomy.material_edit_ratio_threshold` via `settings.get()` — no hardcoded literals.

3. **Click token reuses unsubscribe token pattern.** Same HMAC-SHA256 approach, separate secret env var (`OUTREACH_CLICK_SECRET`) with fallback to `NEXTAUTH_SECRET`.

4. **Retargeting pixel fires via inline scripts, not redirects.** The endpoint returns an HTML page that loads Meta/Google scripts, fires events, then redirects via `setTimeout(0)`. Pixels are async; redirect is immediate to the user.

## What the next session should know

- **Case snippet consumption by outreach drafts** (§8.2 patch): `getBestMatchingSnippet()` is ready but not yet wired into `draft-generator.ts`. The draft generator's prompt needs a snippet section added. This is a one-line integration — add snippet to `buildSystemPrompt()` inputs.
- **`wrapOutreachLink()` not yet called by sender.** The link wrapping needs to be integrated into `lib/lead-gen/sender.ts` where outreach email body is prepared. Links in the markdown body (except unsubscribe) should be wrapped through the redirect.
- **Next up:** AT-1 (Free Audit Tool backend) per BUILD_PLAN Wave 13b.

## Verification

- `npx tsc --noEmit` — 0 errors (excluding pre-existing `.next/types` duplicates)
- `npm test` — 214 files, 1141 passed, 0 failures, 666 skipped
- No browser check required (backend-only session)

## Rollback strategy

**Git-revertable.** Additive schema (new table, new settings rows). No existing table columns modified. Autonomy threshold migration is data-only (UPDATE existing rows) — revertable by running `UPDATE autonomy_state SET graduation_threshold = 10`.
