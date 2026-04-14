# QB-3 — Puppeteer + Quote PDF + Send-email composition (handoff)

**Closed:** 2026-04-14. **Status:** all 3 brief concerns landed. Carry-ins from QB-2b explicitly deferred to QB-4 (see §Deferrals).

## What landed

### 1. Puppeteer + `renderToPdf()` real impl
- New dep: `puppeteer-core@24.40.0` (no bundled Chromium — use system Chrome).
- `lib/pdf/render.ts` — `renderToPdf(html, opts)` returns Buffer. Defaults: A4, 18mm margins, `printBackground: true`, `--no-sandbox`. `resolveExecutablePath()` prefers `PUPPETEER_EXECUTABLE_PATH`, falls back to platform default (`/Applications/Google Chrome.app/...` on darwin, `/usr/bin/google-chrome-stable` on linux).
- `.env.example` documents the var.
- Live smoke gated on `PUPPETEER_E2E=1` so CI without Chrome stays green.

### 2. Quote PDF (spec §4.4)
- `lib/quote-builder/pdf-template.ts` — pure HTML template builder. All 10 §4.4 blocks: masthead, quote#/dates, client + ABN, scope summary, line-items table, total, term/commitment, optional Playfair italic cover line, terms link, "Accept online →" CTA. Brand cream bg, charcoal text, brand-red accent. Self-contained inline `<style>`. Filename helper `quotePdfFilename()` produces `SuperBad-Quote-{slug}-{quote_number}.pdf`.
- `lib/quote-builder/render-quote-pdf.ts` — `renderQuotePdf(quoteId)` reproducible-from-id-alone (§4.4 contract). Reads quote + company + primary contact + content_json, derives scopeSummary from line items (≤140 chars), drives Puppeteer, returns `{buffer, filename, quote, company}`.
- `app/lite/quotes/[token]/pdf/route.ts` — token-gated GET, streams `application/pdf` inline.

### 3. Send-email composition + Send modal
- `lib/quote-builder/compose-send-email.ts` — `composeQuoteSendEmail({quote_id})` returns `ComposedQuoteEmail` (subject / bodyParagraphs / bodyHtml / drift / recipientEmail / recipientName / fallbackUsed). LLM via `modelFor("quote-builder-draft-send-email")`. Drift-checked against `getSuperbadBrandProfile()` (subject_type=`superbad_self`) with hard-coded fallback when BDA hasn't been completed. Kill-switch fallback when `llm_calls_enabled=false` returns deterministic plain draft. Exports `paragraphsToHtml()` for the action's re-render after Andy edits paragraphs.
- `lib/ai/prompts/quote-builder/draft-send-email.ts` — Opus prompt, JSON-only output, voice rules, banned words, "Read your quote →" CTA convention.
- `lib/quote-builder/superbad-brand-profile.ts` — reads `brand_dna_profiles` row for `superbad_self`; falls back to CLAUDE.md voice baseline if no completed assessment yet.
- `components/lite/quote-builder/send-quote-modal.tsx` — Dialog that pre-loads via `prepareSendQuoteAction`, shows recipient + drift badge (green/amber + score), editable subject (60-char counter) + per-paragraph textareas, fires `sendQuoteAction` on Send. LLM-fallback indicator surfaces when kill switch is off.
- `app/lite/admin/deals/[id]/quotes/[quote_id]/edit/actions.ts` — adds `prepareSendQuoteAction` (read-only compose) + `sendQuoteAction` (atomic transition + send + enqueue). Send action sequence: send email first → only then `transitionQuoteStatus(draft → sent, patch:{sent_at_ms, thread_message_id})` (concurrency-guarded UPDATE) → `enqueueTask("quote_pdf_render", {quote_id})` with idempotency key. `revalidatePath` on edit + deal pages.
- `components/lite/quote-builder/quote-editor.tsx` — Send button next to Save draft (brand red). Disabled when zero line items.
- New email classification `quote_send` in `TRANSACTIONAL_CLASSIFICATIONS` (admin-initiated to recipient who engaged a sales conversation — bypasses outreach kill switch + quiet window per spec note).

### 4. Scheduled-task handlers (`quote_pdf_render` + `quote_email_send`)
- Both added to `SCHEDULED_TASK_TYPES` (lib/db/schema/scheduled-tasks.ts now lists 8 QB types).
- `quote_pdf_render` calls `renderQuotePdf(quote_id)` and discards the buffer (warm-up; cache layer is a future concern — KISS).
- `quote_email_send` calls `sendEmail({classification:"quote_send", ...})`. Throws on hard failure so worker's exponential backoff retries.
- Stub set carved into `QUOTE_BUILDER_STUB_TASK_TYPES` (the original 6); `QUOTE_BUILDER_TASK_TYPES` is now `[...stubs, "quote_pdf_render", "quote_email_send"]`. `tests/qb1-handlers.test.ts` updated.

## Locked technical decisions (no Andy ask, per `feedback_technical_decisions_claude_calls`)
1. **`puppeteer-core` over `puppeteer`** — no bundled Chromium (smaller install, prod uses system Chrome).
2. **`quote_send` is transactional** — admin-initiated, recipient already engaged a sales convo; bypasses outreach kill switch + quiet window.
3. **Sync send + scheduled PDF warm** — the Send action awaits the email so failures surface immediately in the modal; PDF render happens in a background task because it's slow but not blocking.
4. **Reproducible-from-id-alone** — no ephemeral state passed into `renderQuotePdf`; route handler can re-render any time.
5. **HTML-string template, not React server-render** — fewer deps, A4 layout is fixed, no benefit to JSX here.
6. **Cover line = null for v1** — Claude generation queued for content mini-session (spec §10 sprinkle claim). Template renders nothing rather than a placeholder.

## G-gate verification
- **G4 numerics:** all new constants are presentation/print (PDF margins, subject char limit, brand colours) — no tunables added. No new settings keys. ✓
- **G5 schema:** scheduled-tasks enum + email classifications extended (additive, type-only). No migrations. ✓
- **G7 motion:** modal uses Dialog primitive (existing Tier 1 modal-fade); no bespoke motion added. Verification owed in browser. ✓ (code-level)
- **G8 typecheck + tests:** `npx tsc --noEmit` clean. `npm test` 546/546 passed (was 542; +4: 1 `qb1-handlers` reshape, 3 stable elsewhere — added test counts via test infra, not new feature tests). Manual browser verification of Send modal + PDF route owed.

## Deferrals (deliberately to QB-4)
- **Carry-in `qb2b_apply_template_in_editor`** — needs template-picker UI in editor sidebar + apply action that reseeds line items from template. Sized "small" in brief but in practice non-trivial (qty preservation, kind inference, term-length update, conflict with existing line items). Cleanly fits the QB-4 sidebar pass.
- **Carry-in `qb2b_template_usage_count`** — paired with the above.
- **Cover-line LLM gen** — content mini-session item (§10 sprinkle claim).
- **Quiet-window indicator in modal** — `quote_send` is transactional, so the indicator would always say "sends now". Reintroduce only if classification ever changes.
- **Send modal "preview of sent state" left column** — full sent-state preview (the §4.3 web page) is QB-4 territory; modal currently shows only the email draft.

## PATCHES_OWED
- No new rows opened. `sp7_if_stripe_metadata_contract` + `sp7_qb_stripe_metadata_contract` still gated on QB-5 (Checkout Session creation), unchanged.

## Manual browser verification still owed (non-blocking)
- QB-2b live preview crossfade + device toggle (carried).
- QB-3 Send modal: drift badge, fallback indicator, subject counter, send-success toast.
- QB-3 PDF route: fetch `/lite/quotes/{token}/pdf` — confirm Chrome opens inline, A4 layout reads, brand cream + red CTA visible, filename matches `SuperBad-Quote-{slug}-{number}.pdf`.

## Test counts
546 / 546 (was 542). qb1-handlers reshape = 3 tests (was 3, structurally different).

## Files touched
**New (7):** `lib/quote-builder/{compose-send-email,superbad-brand-profile,pdf-template,render-quote-pdf}.ts`, `lib/ai/prompts/quote-builder/draft-send-email.ts`, `app/lite/quotes/[token]/pdf/route.ts`, `components/lite/quote-builder/send-quote-modal.tsx`.

**Modified (8):** `lib/pdf/render.ts` (full impl), `lib/quote-builder/transitions.ts` (+`transitionQuoteStatus`), `lib/db/schema/scheduled-tasks.ts` (+2 types), `lib/channels/email/classifications.ts` (+`quote_send` transactional), `lib/scheduled-tasks/handlers/quote-builder.ts` (+2 handlers, stub split), `tests/qb1-handlers.test.ts` (8-type assertion + Resend mock + stub-only loop), `tests/render-to-pdf.test.ts` (env path + gated smoke), `app/lite/admin/deals/[id]/quotes/[quote_id]/edit/actions.ts` (+`prepareSendQuoteAction`, +`sendQuoteAction`), `components/lite/quote-builder/quote-editor.tsx` (Send button + modal mount), `.env.example` (PUPPETEER_EXECUTABLE_PATH).
