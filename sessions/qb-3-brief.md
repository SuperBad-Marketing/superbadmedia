# QB-3 — Puppeteer + PDF render + Send-email composition (brief)

**Wave:** 6 (Quote Builder). Opens after QB-2b (closed 2026-04-14).
**Prior handoffs (read first):** `sessions/qb-2b-handoff.md`, `sessions/qb-2a-handoff.md`, `sessions/qb-1-handoff.md`.
**Spec reads:** `docs/specs/quote-builder.md` §§ 3.2, 4.2 (send modal), 4.4 (PDF content blocks — A4 portrait), 8.3 (scheduled-task slots).
**Protocol:** G0–G12 per `AUTONOMY_PROTOCOL.md`.

## Scope (three concerns, one session)

1. **Puppeteer landing.** New npm dep — per CLAUDE.md "never install an npm package without flagging the reason". Recommendation: `puppeteer-core` + system-Chrome in prod, bundled Chromium in dev. Decision belongs in this session (flag it and make the call per `feedback_technical_decisions_claude_calls`). Wire into `lib/rendering/renderToPdf()` (stubbed at A7 with `NotImplementedError`). A4 portrait, print CSS, respects reduced-motion-free static output.
2. **Quote PDF template.** Render route or in-process component that maps `QuoteContent` + totals + company + `quoteNumber` to §4.4 content blocks. Reuse `preview-pane` structural layout where it cleanly maps; strip animation. Brand-forward per `feedback_takeaway_artefacts_brand_forward`: cover page, named filename `SuperBad-Quote-<SB-YYYY-NNNN>-<company>.pdf`.
3. **Send-email composition.** Claude-drafted per `project_llm_model_registry` (route via registry job name, never model id). Drift-checked against Brand DNA + Client Context (the two perpetual contexts). Send modal (§4.2) wires the QB-2a editor's Send button → `transitionQuoteStatus(draft → sent)` + enqueue PDF render + email send.

## Drop-in points

- `lib/rendering/renderToPdf()` — stub from Wave 1 A7; fill with real impl.
- `lib/scheduled-tasks/handlers/` — QB-1 seeded handler slots; `quote_pdf_render` + `quote_email_send` land here.
- QB-2a `quote-editor.tsx` sidebar Send button — currently inert; this session wires it.
- `lib/ai/prompts/draft-quote-email.md` — new prompt file (content mini-session owed from QB-1 still queued; author inline if not yet landed).

## Carry-ins from QB-2b

- `qb2b_apply_template_in_editor` — natural moment to also add "apply template" affordance to the editor sidebar (sidebar already growing with Send). Small; lands cleanly here or defer explicitly.
- `qb2b_template_usage_count` — increments when apply-template fires.
- `sp7_if_stripe_metadata_contract` + `sp7_qb_stripe_metadata_contract` — **gate on QB-5 (Checkout Session creation), not QB-3.** Do NOT close here.

## Key constraints

- Puppeteer is the only new dep in the session — flag clearly in the handoff.
- LLM drafts route through the model registry (`lib/ai/models.ts`), not hard-coded.
- PDF must be reproducible from a quote id alone (no ephemeral state).
- Send action is admin-gated + idempotent on `quote.status` (already-sent → reject with typed error, matches `QuoteNotDraftError` pattern).
- G4: any new numerics (PDF margins, retry delays) are either UI print-CSS constants (inline, pinned by spec) or scheduled-task tunables (via `settings.get()`).

## Rollback

Git-revertable so long as no new settings keys or migrations are added. Puppeteer uninstall if decision reverses. If `puppeteer-core` lands, document the Chrome-channel assumption in `.env.example`.

## Not in scope

- QB-4 (Stripe Checkout Session creation on acceptance) — separate session.
- QB-5 (Checkout Session metadata contract closing the two SP-7 PATCHES_OWED rows).
- QB-E2E critical-flow spec.
