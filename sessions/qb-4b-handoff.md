# QB-4b Handoff — Intro-Paragraph Synthesis + Template Apply + Reminder Enqueue

## What was built
- `lib/ai/prompts/quote-builder/draft-intro-paragraph.ts` — Opus prompt builder; rank 1–4 source hierarchy (client docs / deal notes / meaningful activity / brand profile). Exports `buildDraftIntroParagraphPrompt`, types `IntroParagraphSource`, `DraftIntroParagraphOutput`.
- `lib/quote-builder/compose-intro-paragraph.ts` — `composeIntroParagraph({quote_id, freeformInstruction})`; gathers rank-2 `activity_log` notes, rank-3 meaningful activity (feedback_received / email_received / trial_shoot_completed), rank-4 `brand_dna_profiles.prose_portrait`. Empty sources → empty paragraph + `confidence: "low"` + `flags.empty`. `killSwitches.llm_calls_enabled=false` → same shape + `flags.kill_switch`. Otherwise calls Opus via the LLM registry and runs drift-check against `getSuperbadBrandProfile()`. Also exports `checkIntroRedraftThrottle(quoteId, nowMs?, db?)` — reads `quote.intro_paragraph_redraft_hourly_cap`, counts `activity_log` rows with `meta.kind='quote_intro_redrafted'` for this quote in the trailing hour.
- `app/lite/admin/deals/[id]/quotes/[quote_id]/edit/actions.ts`:
  - **`redraftIntroParagraphAction`** — throttle check → composer → logs a `kind='note'` activity with `meta.kind='quote_intro_redrafted'` (avoids enum widening per SP-4/SP-5 precedent). Returns paragraph + provenance + confidence + drift for the editor to preview.
  - **`applyQuoteTemplateAction`** — resolves `default_line_items_json` → catalogue snapshot → `QuoteLineItem[]`; preserves §1 `whatYouToldUs`; atomic `sql\`${usage_count} + 1\`` on the template row.
  - **`sendQuoteAction`** — now enqueues `quote_reminder_3d` at `Date.now() + quote.reminder_days * 86400000` with idempotency `quote_reminder_3d:{quote_id}`; skipped if `reminderAt >= expires_at_ms`. Pairs with QB-4a `markQuoteViewed` → flip-to-skipped via same key.
- `components/lite/quote-builder/quote-editor.tsx` — `§1` freeform-instruction input + Redraft button + confidence Badge (amber on `low`); `isRedrafting` / `isApplying` transitions; template-picker Select in sidebar.
- `app/lite/admin/deals/[id]/quotes/[quote_id]/edit/page.tsx` — queries `quote_templates` (non-deleted, id/name/structure/term_length_months) and passes to editor.
- `lib/settings.ts` + `lib/db/migrations/0017_qb4b_intro_paragraph_and_reminder.sql` + `meta/_journal.json` — 2 new keys: `quote.intro_paragraph_redraft_hourly_cap = 5`, `quote.reminder_days = 3`.
- `docs/settings-registry.md` — 86 → 88 total, QB count 2 → 4.
- `tests/settings.test.ts` — 86 → 88 (3 sites).
- `tests/qb1-schema.test.ts` — expected array expanded to all 4 quote.* keys.
- `tests/qb4b-intro-paragraph.test.ts` — 5 tests (empty path, kill-switch, throttle cap, per-quote isolation, reminder-idempotency-key dedupe); uses mocked `@/lib/db` with a migrated in-file sqlite (pattern from qb4a).

## Verification
- `npx tsc --noEmit`: clean.
- `npm test`: **556 passed (+5), 1 skipped**, 77 files.
- Manual browser verify: not run (mirrors qb-4a — needs dev reset; deferred alongside 4a's owed check).

## Carry-ins to QB-4c
- Stripe Payment Intent route + proxy allowlist.
- Payment Element + Tier-2 morph (`layoutId="quote-primary-action"`).
- `legal_doc_versions` enforcement on tickbox submit.
- Accept side-effects: transitionDealStage → won, settle email, Stripe Subscription for retainer/mixed, `sound:quote_accepted`, confirmation screen, webhook handlers.

## Notes
- Rank-1 client-supplied docs not yet implemented in the codebase — prompt accepts the slot but composer passes empty for now.
- Throttle bookkeeping rides `activity_log` + `meta.kind` (no new table).
- Template usage increment is atomic SQL — no read-modify-write race.
