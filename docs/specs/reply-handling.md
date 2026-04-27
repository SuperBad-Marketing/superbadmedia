# Reply Handling & Drop-Off Sequence

**Owner:** Lead Generation pipeline (LG extension)
**Status:** Spec locked, ready to build
**Date:** 2026-04-27

## Purpose

When a prospect replies to an outreach email, classify the reply, draft an appropriate response, and manage the follow-up sequence if they go quiet after initial interest. Goal: convert positive replies into trial shoot bookings autonomously — Andy approves drafts but doesn't need to write them or jump on calls.

## Locked Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Reply handling model | Hybrid — LLM drafts for positive/question/objection, auto-handle negative + auto-responder |
| 2 | Reply speed target | Under 4 hours, always human-approved. Nothing sends without Andy's approval. |
| 3 | Context layers | 6: original email, their reply, viability profile + deep enrichment, standing brief, brand voice + examples, "don't" rules |
| 4 | Andy's nudge | Optional one-liner that reshapes the draft ("mention ProTraxx", "lead with the trial shoot") |
| 5 | Conversion goal | Trial shoot booking via https://superbadmedia.com.au/trial-shoot — not a sales call |
| 6 | Link inclusion | LLM judges when the booking link is relevant — not forced into every reply |
| 7 | Drop-off sequence | 3-step: nudge 1 (day 3), nudge 2 (day 7), soft close (day 14). Archive as warm-dormant. |
| 8 | Long-tail touch | Day 60 — genuinely new information, not "remember me." Archive fully if no response. |
| 9 | Price increase handling | When prices go up, warm-dormant leads get the old price honoured for 7 days via per-candidate discount code |
| 10 | Discount codes | Per-candidate, unique, 7-day expiry, embedded in booking link as `?code=XXXXX` |
| 11 | Fake urgency | Banned. Price holds reference real increases only. "Figured you'd want to know" not "don't miss out." |

## Reply Classification → Action Map

| Classification | LLM Draft? | Andy Approves? | Auto Action |
|---|---|---|---|
| **Positive** | Yes — warm, match energy, answer what they asked. Include booking link when LLM judges relevant. | Yes | — |
| **Question** | Yes — answer directly in 2-3 sentences, then soft CTA. Booking link if contextually relevant. | Yes | — |
| **Objection** | Yes — acknowledge honestly, don't argue. Leave door open. Booking link only if natural. | Yes | — |
| **Negative** | No | No | Auto-DNC, auto-archive, send "Done. Apologies for the interruption." |
| **Auto-responder** | No | No | Note return date on candidate. Re-queue touch for return date + 2 days. |

## Reply Draft Prompt — Context Layers

1. **The original outreach email** — subject, body, touch number, which gap/observation it used
2. **Their reply** — full text, classified intent
3. **Viability profile + deep enrichment** — full profile including website_content.distilled_brief, social presence, all signals
4. **Standing brief** — strategic context for who we're targeting
5. **Brand voice + outreach voice examples** — same anchors as outreach drafts
6. **Rules** — see below

## Reply Draft Rules (system prompt)

- Write as Andy. Same voice as the outreach — dry, observational, real.
- **Match their energy.** If they wrote two sentences, you write two sentences. Don't over-explain.
- **Answer their actual question first** before adding anything else.
- **Don't repeat the observation from the original email.** They read it. Move forward.
- **Don't pitch.** They showed interest — deepen the conversation, don't close the sale.
- **The booking link (https://superbadmedia.com.au/trial-shoot) is the primary CTA** but only include it when the LLM judges the moment is right. Don't force it.
- **Trial shoot info:** Two tiers — Session ($397, 60-90 min) and Production ($597, up to 2 hours). Both include a 6-week marketing plan. Don't push a tier — the booking page handles that.
- **If Andy added a nudge**, incorporate it naturally. The nudge overrides default behaviour.
- **For objections:** Acknowledge honestly before responding. Never dismiss, never redirect, never argue. If there's no natural reframe, just leave the door open and move on.
- **No follow-up language.** Never say "following up", "checking in", "bumping this", "as I mentioned."
- **No fake urgency.** Price holds reference real increases only. Never "limited spots" or "this week only."

## Reply Drop-Off Sequence

Triggered when Andy sends an approved reply and the prospect doesn't respond.

| Step | Timing | Content | Subject Style |
|---|---|---|---|
| **Nudge 1** | Day 3 after reply sent | New angle related to their original reply. Add something — don't just check in. | Conversational, standalone |
| **Nudge 2** | Day 7 | Different approach. If they asked about the shoot → proof from similar business. If curious about pricing → reframe value. | Name-anchor or observation |
| **Soft close** | Day 14 | "The offer's there whenever the timing's right." Booking link one last time. Warm exit. | Human — "no rush" or first name only |
| → Archive | Day 14 + no response | Status → `warm_dormant`. Not DNC. Not dead. | — |
| **Long-tail** | Day 60 | Genuinely new information. If price increased since contact: honour old price for 7 days with discount code. | Observation-lead — something new |
| → Final archive | Day 60 + no response | Status → `archived`. | — |

## Price-Hold Discount System

### When prices change:
1. Andy updates trial shoot pricing on the booking page
2. System detects all `warm_dormant` candidates whose `quoted_price` < current price
3. These candidates become eligible for the long-tail touch with price-hold messaging

### Per-candidate discount codes:
- Generated at draft time for the long-tail touch
- Format: `SB-{short-uuid}` (e.g. `SB-a3f8k2`)
- Stored in new `discount_codes` table: id, candidate_id, code, original_price_cents, expires_at_ms, redeemed_at_ms
- Embedded in booking link: `https://superbadmedia.com.au/trial-shoot?code=SB-a3f8k2`
- **7-day expiry** from email send date
- Booking page validates: code exists → not expired → not redeemed → apply old price

### LLM framing for price-hold emails:
- Only reference price increases that have actually happened (check current vs quoted)
- "We've raised our prices since we last spoke — Session is $X now. Happy to honour the $Y if you book in the next week. After that it's the new price."
- Frame as courtesy with a boundary, not pressure
- The hold is a real favour with a real deadline

## Database Changes

### New columns on `lead_candidates`:
- `quoted_session_price_cents` INTEGER — price shown at first contact (e.g. 39700)
- `quoted_production_price_cents` INTEGER — price shown at first contact (e.g. 59700)
- `reply_status` TEXT — null | 'awaiting_reply' | 'replied' | 'drop_off_1' | 'drop_off_2' | 'drop_off_3' | 'warm_dormant' | 'long_tail_sent' | 'archived'
- `last_reply_at_ms` INTEGER — when the prospect last replied
- `reply_draft_id` TEXT — FK to current pending reply draft

### New table: `discount_codes`
- `id` TEXT PK
- `candidate_id` TEXT FK → lead_candidates
- `code` TEXT UNIQUE
- `tier` TEXT — 'session' | 'production'
- `original_price_cents` INTEGER
- `expires_at_ms` INTEGER
- `redeemed_at_ms` INTEGER NULL
- `created_at_ms` INTEGER

### New table: `reply_drafts`
- `id` TEXT PK
- `candidate_id` TEXT FK → lead_candidates
- `in_reply_to_draft_id` TEXT — the outreach draft they replied to
- `prospect_reply_text` TEXT — their reply
- `prospect_reply_classification` TEXT — positive | question | objection | negative | auto_responder
- `subject` TEXT
- `body_markdown` TEXT
- `model_used` TEXT
- `prompt_version` TEXT
- `generation_ms` INTEGER
- `drift_check_score` INTEGER NULL
- `drift_check_flagged` INTEGER
- `andy_nudge` TEXT NULL
- `status` TEXT — 'pending_approval' | 'approved' | 'sent' | 'rejected'
- `approved_at_ms` INTEGER NULL
- `sent_at_ms` INTEGER NULL
- `created_at_ms` INTEGER

## LLM Jobs

| Job slug | Tier | Purpose |
|----------|------|---------|
| `lead-gen-reply-draft` | Opus | Draft reply to prospect's response |
| `lead-gen-reply-nudge` | Opus | Draft drop-off nudge (day 3, 7, 14) |
| `lead-gen-reply-long-tail` | Opus | Draft 60-day re-engagement with optional price hold |
| `lead-gen-reply-classify` | Haiku | Classify inbound reply intent |

## Files to Create/Modify

| File | Action |
|------|--------|
| `docs/specs/reply-handling.md` | This spec |
| `lib/lead-gen/reply-handler.ts` | NEW — classify, route, draft, notify |
| `lib/lead-gen/reply-drop-off.ts` | NEW — drop-off sequence scheduler |
| `lib/lead-gen/discount-codes.ts` | NEW — generate, validate, redeem codes |
| `lib/lead-gen/draft-generator.ts` | Extend with reply draft prompt |
| `lib/ai/models.ts` | Add 4 new job slugs |
| `lib/db/schema/reply-drafts.ts` | NEW — reply_drafts table |
| `lib/db/schema/discount-codes.ts` | NEW — discount_codes table |
| `lib/db/schema/lead-candidates.ts` | Add quoted_price, reply_status columns |
| `lib/db/migrations/0095_reply_handling.sql` | Schema migration |
| `app/api/webhooks/reply-inbound/route.ts` | NEW — inbound reply webhook from Resend |
| `app/lite/(admin)/leads/[id]/reply/page.tsx` | NEW — reply approval UI |
| `app/trial-shoot/page.tsx` | Extend to validate discount codes |
