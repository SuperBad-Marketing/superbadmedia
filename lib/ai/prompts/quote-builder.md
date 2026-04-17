---
spec: docs/specs/quote-builder.md
status: calibrated
populated-by: CMS-2 content mini-session (2026-04-17)
content-source: docs/content/quote-builder/
---

# Quote Builder prompts

Six active prompts + one retired. Model tier noted per prompt; registry key is the slug. Voice calibration, example outputs, and hard rules live in `docs/content/quote-builder/emails.md`.

## `quote-builder-draft-from-context`

**Tier:** Opus. **Intent:** populate a new quote draft from deal context, company profile, activity log, Brand DNA. **Input:** deal + company + last ~20 activity entries + Brand DNA profile + catalogue vocabulary (full `catalogue_items` set — see `docs/content/quote-builder/catalogue.md`). **Output:** structured JSON — structure, suggested terms, sections (`what_you_told_us`, `what_we'll_do`, `price_framing`, `terms_highlights`), confidence, flags. **Spec location:** §6.1. **Calibration:** Claude MUST select line items only from the catalogue vocabulary provided. MAY override prices with explicit reasoning. Rank hierarchy per `feedback_client_doc_source_hierarchy`. Ban "synergy", "leverage", "solutions". No filler.

## `quote-builder-draft-intro-paragraph`

**Tier:** Opus. **Intent:** regenerate the "What you told us" paragraph on demand, with optional freeform Andy instruction. **Output:** paragraph text + source rank + drew_from_ranks + confidence + flags. **Spec location:** §6.2. **Calibration:** rank-1 wins conflicts; rank-4-only → `confidence: low` + flag; no invented specifics; no greeting/sign-off/we/our. Provenance hint copy: see `docs/content/quote-builder/copy.md` §8.

## `quote-builder-draft-send-email`

**Tier:** Opus. **Intent:** draft the email delivering the quote link. **Output:** subject_line (≤60 chars), body_paragraphs (2–4), sign_off ("Andy"). **Spec location:** §6.3. **Calibration:** see `docs/content/quote-builder/emails.md` §1 for full rules + example output. Never include URL in body. Never mention "attached PDF". Reference one specific deal detail.

## `quote-builder-draft-scope-summary`

**Tier:** Haiku. **Intent:** compress "What we'll do" section into ≤140-char line for the PDF header. Compression task, not reasoning. **Spec location:** §6.4.

## `quote-builder-draft-pdf-cover-line`

**Status:** RETIRED. CMS-2 locked **rotation pool** (not Claude-per-quote). The 20-line pool lives at `docs/content/quote-builder/pdf-cover-lines.md`. Phase 5 build loads the pool as a static array; no LLM call needed. Registry slug retained for future reactivation if rotation pool is ever swapped for per-quote generation.

## `quote-builder-draft-settle-email`

**Tier:** Opus. **Intent:** post-accept transactional email, branches on billing mode. Same output shape as `quote-builder-draft-send-email`. **Spec location:** §6.6. **Calibration:** see `docs/content/quote-builder/emails.md` §3 (Stripe) and §4 (manual) for full rules + example outputs.

## `quote-builder-draft-cancel-intercept-email`

**Tier:** Opus. **Intent:** pre-term cancel intercept check-in email from Andy to client. **Spec location:** §6.7. **Calibration:** see `docs/content/quote-builder/emails.md` §8 for full rules + example output. Never defensive/begging. Acknowledge position. Offer 15-min call.

## Additional email prompts (not in original stub)

The following emails are also Claude-drafted per-quote. Prompt calibration for each lives in `docs/content/quote-builder/emails.md`:

- **§2 — 3-day reminder** (Opus): fires from `quote_reminder_3d` handler
- **§5 — Expiry email** (Opus): fires from `handleQuoteExpire` handler
- **§6 — Supersede email** (Opus): fires on edit-after-send
- **§7 — Withdrawal email** (Opus): fires on explicit withdraw
- **§9 — Upgrade-intent email** (Opus): fires on post-term upgrade browsing
- **§10 — Downgrade-intent email** (Opus): fires on post-term downgrade browsing
- **§11 — Pause-ending heads-up** (Opus): fires 3d before SaaS pause ends
