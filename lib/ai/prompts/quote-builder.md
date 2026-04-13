---
spec: docs/specs/quote-builder.md
status: stub
populated-by: Quote Builder content mini-session (see SESSION_TRACKER.md)
---

# Quote Builder prompts

Seven prompts. Model tier noted per prompt; registry key is the slug.

## `quote-builder-draft-from-context`

**Tier:** Opus. **Intent:** populate a new quote draft from deal context, company profile, activity log, Brand DNA. **Input:** deal + company + last ~20 activity entries + Brand DNA profile. **Output:** structured JSON — structure, suggested terms, sections (`what_you_told_us`, `what_we'll_do`, `price_framing`, `terms_highlights`), confidence, flags. **Current inline location:** spec §6.1.

## `quote-builder-draft-intro-paragraph`

**Tier:** Opus. **Intent:** regenerate the "What you told us" paragraph on demand, with optional freeform Andy instruction. **Output:** paragraph text + source rank + drew_from_ranks + confidence + flags. **Current inline location:** spec §6.2.

## `quote-builder-draft-send-email`

**Tier:** Opus. **Intent:** draft the email delivering the quote link. **Output:** subject_line, body_paragraphs, sign_off. **Hard rules:** never include the URL in the body; never mention "attached PDF". **Current inline location:** spec §6.3.

## `quote-builder-draft-scope-summary`

**Tier:** Haiku. **Intent:** compress "What we'll do" section into ≤140-char line for the PDF header. Compression task, not reasoning. **Current inline location:** spec §6.4.

## `quote-builder-draft-pdf-cover-line`

**Tier:** Opus. **Intent:** generate one dry Playfair italic cover line for the PDF. Per-quote vs rotation-pool decision is content-session work. **Current inline location:** spec §6.5.

## `quote-builder-draft-settle-email`

**Tier:** Opus. **Intent:** post-accept transactional email, branches on billing mode (Stripe: payment ref + receipt link + first-deliverable date; Manual: invoice date + first-deliverable date). Same output shape as `quote-builder-draft-send-email`. **Current inline location:** spec §6.6.

## `quote-builder-draft-cancel-intercept-email`

**Tier:** Opus. **Intent:** pre-term cancel intercept check-in email from Andy to client. **Hard rules:** never defensive/begging; acknowledge position openly; offer 15-min call, not text-back-and-forth. **Current inline location:** spec §6.7.
