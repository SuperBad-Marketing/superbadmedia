# `cms-2` — Quote Builder + Setup Wizards content mini-session — Handoff

**Closed:** 2026-04-17
**Type:** Content mini-session (Batch A, item 2 of 2)
**Model tier:** Opus (creative — client-facing voice treatment)

---

## What was built

The **complete creative content layer** for Quote Builder and Setup Wizards. 13 files changed (11 new content docs, 2 prompt index updates, 1 model registry update).

### Quote Builder content (6 files)

1. **`docs/content/quote-builder/catalogue.md`** — 5 categories (creative_production, ad_management, content, strategy, photography), 30 seed items with GST-inclusive default pricing, 3 retainer tiers (Core/Production/Full Service at tier_rank 1/2/3), 3 starter templates (Performance Starter, Creative & Performance, Full Partnership).

2. **`docs/content/quote-builder/copy.md`** — Section headings (5: "What you told us" / "What we'll do" / "The price" / "The terms" / "Say yes"), accept flow copy, Payment Element fine-print (3 variants: Stripe/project/mixed), confirmation screens (2 variants), superseded/withdrawn/expired URL cards, loading states (5-line pool), empty states (6 surfaces), low-confidence warning, provenance hints (7 rank combinations), catalogue affordances, send modal copy, browser tab titles.

3. **`docs/content/quote-builder/emails.md`** — Prompt calibration + example outputs for 11 email types: send, 3-day reminder, settle (Stripe), settle (manual), expiry, supersede, withdrawal, cancel-intercept, upgrade-intent, downgrade-intent, pause-ending. Conventions locked: sign-off = "Andy" (first name only, Playfair italic), footer = "SuperBad Marketing · Melbourne", threading via In-Reply-To/References. SaaS emails sign off "SuperBad" not "Andy."

4. **`docs/content/quote-builder/cancel-flow.md`** — Pre-term retainer (3 option cards + paid-exit confirmation + success screen), pre-term SaaS (3 option cards + pause confirmation), post-term retention (upgrade/downgrade/cancel + "here's what you'd be losing" presentation rules), pause-status page, card-not-on-file edge case. Earned soft CTA on exit screens per `feedback_earned_ctas_at_transition_moments`.

5. **`docs/content/quote-builder/terms.md`** — Full honour-based commitment terms page in plain English. Covers: commitment, pricing (GST-inclusive canonical), early exit (3 options for retainer, 3 for SaaS), pausing, post-term flexibility, SuperBad's commitments, privacy pointer, governing law, change notification. Solicitor review before launch (not blocking).

6. **`docs/content/quote-builder/pdf-cover-lines.md`** — 20-line rotation pool. Decision locked: rotation pool, not Claude-per-quote. No LLM call needed at PDF generation time.

### Setup Wizards content (5 files)

7. **`docs/content/setup-wizards/outro-lines.md`** — 30 client-tone lines (stratified: integration 8, Brand DNA 6, onboarding 5, config 4, general 7) + 15 admin-tone lines (terse fragments).

8. **`docs/content/setup-wizards/capstone-and-tab-titles.md`** — Capstone line locked: "SuperBad is open for business." (no rotation, no alternatives). Tab-title pools: 5 phases × 2 audiences × 3 variants each = 30 tab titles.

9. **`docs/content/setup-wizards/kill-switch-messages.md`** — Generic templates (client + admin) + vendor-specific client variations (6 vendors: Graph API, Stripe, Pixieset, Meta Ads, Google Ads, Twilio) + vendor-specific admin variations (3 high-risk: Stripe, Graph API, Twilio) + mid-wizard kill-switch messages.

10. **`docs/content/setup-wizards/admin-setup-assistant-prompt.md`** — Full Opus system prompt + 7 synthetic failure scenarios calibrated (OAuth denied, invalid API key, webhook timeout, DNS propagation, vendor outage, insufficient permissions, token expired). Response format: 3 sections (What went wrong / What to try / If that doesn't work). Thread behaviour rules. v1 hard limit: read-only.

11. **`docs/content/setup-wizards/copy.md`** — Empty states (3 variants for `/lite/integrations`), Observatory summary templates (client + admin), wizard intro copy, cancel confirmation modal, help escalation affordance, progress indicator labels, critical-flight cockpit banner, 7d-idle health banner, generic step-type copy (review-and-confirm, async-check, celebration).

### Prompt and registry updates (2 files)

12. **`lib/ai/prompts/quote-builder.md`** — Updated from "stub" to "calibrated." `draft-pdf-cover-line` marked RETIRED (rotation pool). All prompts now reference `docs/content/quote-builder/` for voice calibration. Additional email prompts documented (reminder, expiry, supersede, withdrawal, upgrade, downgrade, pause-ending).

13. **`lib/ai/prompts/admin-setup-assistant.md`** — New prompt index entry for the `admin-setup-assistant` Opus job. References `docs/content/setup-wizards/admin-setup-assistant-prompt.md`.

14. **`lib/ai/prompts/INDEX.md`** — Count 60→61. `quote-builder-draft-pdf-cover-line` marked RETIRED. `admin-setup-assistant` added. Setup-wizards removed from prompt-free specs list.

15. **`lib/ai/models.ts`** — `admin-setup-assistant: "opus"` added to registry.

## Key decisions

1. **Retainer tiers: descriptive names.** Core / Production / Full Service. Tier names appear on client-facing surfaces — metaphorical names ("The Engine") force surrounding prose to work around them. Descriptive lets the voice breathe.

2. **PDF cover line: rotation pool.** 20 pre-approved lines, random pick. Safer, cheaper, higher quality ceiling than per-quote generation. LLM call eliminated.

3. **Withdrawal email: yes.** If Andy explicitly withdraws a quote, the client should know the link is dead. Brief and clear.

4. **SaaS emails sign off "SuperBad" not "Andy."** SaaS product emails are platform communications, not personal messages from Andy.

5. **Section heading refinements.** "Price" → "The price" (conversational). "Accept" → "Say yes" (human). Others kept as spec defaults.

6. **Capstone line: no rotation.** "SuperBad is open for business." is it. Black Han Sans, centred, holds for 3 seconds. The simplicity is the voice.

## What the next session should know

- **Nudge emails already existed.** `docs/content/setup-wizards/nudge-emails.md` was written by SW-8. Not touched by CMS-2.
- **Catalogue prices are defaults.** Andy overrides per-client. Don't treat seed prices as authoritative.
- **Terms page needs ABN inserted** before launch. Placeholder `[to be inserted]` in two spots.
- **Solicitor review** of terms + cancel flow copy recommended before launch (not blocking build).
- **CMS Batch A is now complete.** Both CMS-1 (Brand DNA) and CMS-2 (QB + SW) are closed. Resume Wave 12 remaining sessions (CE-11→CE-13).

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 163 files, 1312 passed, 0 failures, 1 skipped
- No build-breaking changes (content docs only + prompt index + model registry)

## PATCHES_OWED (raised this session)

- **`cms_2_terms_page_abn_placeholder`** — ABN must be inserted into `docs/content/quote-builder/terms.md` before launch. Two occurrences of `[to be inserted]`.
- **`cms_2_solicitor_review_terms`** — Terms + cancel flow copy should get a short solicitor review before launch. Not blocking build or Phase 5 sessions.

## Rollback strategy

`git-revertable`. No migration, no schema change. Reverting removes all content docs, prompt calibrations, and model registry addition. Would revert `lib/ai/models.ts` and prompt index to prior state.
