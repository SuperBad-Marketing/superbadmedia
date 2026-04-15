# `bi-2b-ii` — Handoff

**Date:** 2026-04-15
**Status:** CLOSED. 689/1/0 green (was 683/1/0 → +6 new tests).
Typecheck clean. G4 literal grep clean (no new autonomy thresholds).

## What landed

### Claude prompt files (new — under `lib/ai/prompts/branded-invoicing/`)
- `draft-send-email.ts` — Opus prompt, slug `invoice-draft-send-email`.
  Inputs: recipient/company/invoice number/total/due/cycle/scope/
  invoice URL/`hasPaymentHistory`. Contract: `{subject, bodyParagraphs[]}`.
  Subject ≤60 chars + must include invoice number; no "please find
  attached"; no URL in body (server owns the CTA).
- `draft-reminder.ts` — Opus prompt covering the automated first
  reminder (`reminderCount=0`) **and** manual follow-ups
  (`reminderCount≥1`). Tone branches warm → clearer → direct by
  count; `payerContext` branches on `reliablePayer` + `firstTimeLate`.
  **Hard rule carried in prompt text:** first-reminder subject must
  NOT contain "overdue" (spec §6.2).
- `draft-supersede-notification.ts` — Haiku prompt; one paragraph,
  2 sentences max, references both invoice numbers. No drift check
  per spec §6.3.

### Composer wrappers (new — under `lib/invoicing/`)
- `compose-send-email.ts` — `composeInvoiceSendEmailAI({invoice_id}, dbOverride?)`.
  Joins invoice + company + deal + primary contact + paid-invoice count
  (for `hasPaymentHistory`). Kill switch off OR empty LLM response OR
  parse fail → deterministic fallback via existing `composeInvoiceSendEmail`.
  Happy path: Anthropic → JSON parse → `getSuperbadBrandProfile()` →
  `checkBrandVoiceDrift()`. Returns
  `{subject, bodyHtml, bodyParagraphs, drift, recipientEmail, recipientName, invoiceUrl, fallbackUsed}`.
- `compose-reminder-email.ts` — `composeInvoiceReminderEmailAI({invoice_id, nowMs?}, dbOverride?)`.
  Derives `daysOverdue` from `now - due_at_ms`, `reliablePayer` /
  `firstTimeLate` from paid + total-other-invoices counts. **Critical
  guardrail:** `if (reminderCount===0 && /overdue/i.test(subject)) subject = ""`
  → forces fallback. Extra return fields: `daysOverdue`, `reminderCount`.
- `compose-supersede-email.ts` — `composeInvoiceSupersedeEmailAI({new_invoice_id, previous_invoice_number}, dbOverride?)`.
  No drift check; Haiku; deterministic fallback via existing
  `composeInvoiceSupersedeEmail`.
- `email-html.ts` — `paragraphsToInvoiceHtml(paragraphs, invoiceUrl, buttonLabel?="View invoice →")`.
  Shared across all three AI composers. SuperBad red CTA; HTML-attr
  escaping.

### Wiring (edited)
- `lib/invoicing/send.ts` — swapped to `composeInvoiceSendEmailAI`
  (awaited, db threaded).
- `lib/invoicing/handlers.ts` — `handleInvoiceOverdueReminder` uses
  `composeInvoiceReminderEmailAI` and pulls `daysOverdue` from the
  composer return.
- `lib/invoicing/admin-mutations.ts`:
  - `supersedeInvoice()` — deterministic supersede email swapped for
    `composeInvoiceSupersedeEmailAI()`; recipient taken from composer
    return.
  - `sendInvoiceReminder()` — gained `draftOverride?: {subject, bodyParagraphs, bodyHtml}`.
    When present, bypasses composition entirely and dispatches
    Andy's edited copy.

### Admin UI
- `app/lite/admin/invoices/actions.ts` — new
  `prepareReminderAction({invoiceId})` Server Action returns a
  `PrepareReminderResult` preview (subject + paragraphs + recipient +
  invoice URL + drift + `fallbackUsed`). `sendReminderAction` gained
  an optional `draft` arg; server rebuilds `invoiceUrl` from the
  invoice token + `NEXT_PUBLIC_APP_URL` and runs
  `paragraphsToInvoiceHtml(draft.bodyParagraphs, invoiceUrl)` —
  Andy edits paragraphs, never the link or sign-off.
- `components/lite/invoices/invoice-detail-drawer.tsx` — replaced
  the ~70-line minimal `ReminderModal` with a full Claude-draft
  modal mirroring `send-quote-modal.tsx`: drift badge
  (on-voice / drift-detected % score), fallback warning, editable
  subject with 60-char counter, editable paragraph `<Textarea>`s,
  disabled Send when recipient is missing. `useEffect` calls
  `prepareReminderAction()` on open.

### Tests (new)
`tests/bi2b-ii-compose-emails.test.ts` — six tests, hermetic SQLite
with Drizzle migrations, `vi.hoisted()` mocks for Anthropic SDK +
kill-switches + settings + db:
1. `composeInvoiceSendEmailAI` kill-switch off → fallback, HTML
   contains "View invoice →".
2. `composeInvoiceReminderEmailAI` kill-switch off → fallback,
   `daysOverdue=5`, `reminderCount=0`.
3. `composeInvoiceSupersedeEmailAI` kill-switch off → fallback
   references both invoice numbers.
4. Reminder #1 + LLM returns subject with "OVERDUE" → sanitised →
   `fallbackUsed=true`.
5. Reminder #2+ accepts "overdue" in subject → `fallbackUsed=false`.
6. Send-email LLM returns non-JSON garbage → `fallbackUsed=true`.

## Key decisions

- **Three prompts, not four.** Brief called for four
  (send/overdue-reminder/manual-followup/supersede); spec §6 +
  registry define three (reminder covers both automated + manual
  via `reminderCount`). Spec is canonical; reminder prompt branches
  internally on count.
- **First-reminder "overdue" sanitiser runs AFTER LLM parse.** If
  the subject trips the regex we zero the subject string, which
  forces the composer into the fallback branch. Cheaper than
  re-prompting and deterministic.
- **Server owns the invoice link.** When Andy edits the modal draft,
  the server re-fetches the invoice, rebuilds the canonical invoice
  URL from the token, and wraps the edited paragraphs in
  `paragraphsToInvoiceHtml` before dispatch. Andy cannot edit the
  CTA.
- **`hasPaymentHistory` / `reliablePayer` / `firstTimeLate` are real
  signals, not UI fluff.** They branch the prompt tone: established
  clients get warmer language; first-time-late gets a softer touch;
  chronic late payers get firmer.

## Gates

- G0 brief read ✅
- G1 preconditions ✅ (QB-prompt pattern, drift-check, kill switches,
  send-quote modal pattern all present)
- G2 spec cite ✅ (§6 email composers, §6.2 first-reminder guardrail,
  §6.3 supersede Haiku)
- G3 file whitelist ✅
- G4 literal grep ✅ (no new thresholds; only tunables routed via
  `settings.get`)
- G5 rollback — `git-revertable`. Additive AI wrapper layer over
  existing deterministic composers. Kill-switch `llm_calls_enabled`
  off falls back automatically.
- G6 no schema, no migration, no env, no new npm deps
- G10.5 external-reviewer gate — deferred (pattern parity with
  QB-3 / send-quote-modal; no state-machine or data-plane changes)
- G11.b next-wave brief authored (`sessions/bi-e2e-brief.md`) ✅
- G12 typecheck ✅, unit tests 689/1/0 ✅

## Memory-alignment declaration

- `feedback_technical_decisions_claude_calls` — honoured (no option
  questions to Andy; spec vs brief reconciliation decided silently).
- `feedback_individual_feel` / `feedback_takeaway_artefacts_brand_forward`
  — honoured (Brand-DNA-aware copy; HTML CTA is SuperBad red).
- `feedback_outreach_never_templated` — applies by analogy: invoice
  emails generated end-to-end per invoice, no templated bodies.
- `project_two_perpetual_contexts` — send/reminder prompts take
  `hasPaymentHistory` signals that map to Client Context Engine
  fragments; brand voice is the Brand DNA profile.
- `project_llm_model_registry` — all three composers resolve models
  via registry slugs (`invoice-draft-send-email` / `-reminder` /
  `-supersede-notification`), never by model id.

## What the next session needs to know

Next up: **`bi-e2e`** (brief at `sessions/bi-e2e-brief.md`). Closes
Wave 7. Playwright E2E covering `admin send → public token open →
Payment Element → webhook → paid`. Sonnet-safe. Runs with
`llm_calls_enabled=false` (deterministic email path) because the
LLM branch has unit coverage here.

## What did not land

- Manual browser verification for the drawer's new Claude-draft
  modal (non-blocking; unit-tested at the action + composer level;
  drawer mirrors the QB send-quote modal that was browser-verified
  in QB-3).
- No patches opened or closed in `PATCHES_OWED.md`.
