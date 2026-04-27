# Outreach Strategy

**Owner:** Lead Generation pipeline
**Status:** Spec locked
**Date:** 2026-04-27

## Purpose

Defines how SuperBad's automated outreach earns replies and converts them into trial shoot bookings. Companion to `lead-generation.md` (pipeline mechanics) and `reply-handling.md` (post-reply behaviour).

## Core Principle

Every email earns its place by giving value before asking for anything. The system generates per-prospect emails using enrichment data — no templates, no variable substitution. Each email identifies a specific gap in the prospect's marketing and offers actionable advice they can use without SuperBad.

## Email Structure: Gap + Free Win + Soft CTA

1. **The gap** — A specific disconnect identified from enrichment data. Not flattery, not criticism. An observation that proves we looked.
2. **The free win** — Actionable advice matched to signal complexity:
   - Simple fix (under 30 min, no strategy needed) → be prescriptive
   - Complex issue (strategic, multiple approaches) → be directional
3. **The soft CTA** — Proportional to relationship level. "Worth a conversation if you're curious."

## 4-Touch Cold Sequence

| Touch | Timing | Content | Subject Style |
|---|---|---|---|
| 1 | Day 0 | Gap + free win from primary enrichment signal | Observation-lead: "87 reviews, 0 instagram posts" |
| 2 | Day 3-4 | Different signal, different observation, standalone | Name-anchor: "quick thought about [business]" |
| 3 | Day 8-10 | One-sentence proof from similar business + connection | Conversational: "something worth mentioning" |
| 4 | Day 18-21 | Breakup — honest exit, no guilt | Human: "last one from me" |
| 5 (bonus) | Day 30 | Only if opened but never replied. Self-aware, dry. | Just their first name |

After touch 4 with zero engagement (no opens): archive. Protect domain reputation.

## Subject Line Rules

- Lowercase, conversational. Like a text from someone you know.
- Vary style across touches (see table).
- **Banned:** fake "re:", fake "fw:", implied prior conversation, question hooks, exclamation marks, ALL CAPS, emoji.

## Conversion Goal

Trial shoot booking at https://superbadmedia.com.au/trial-shoot — not a sales call.

**Pricing (as of 2026-04-27):**
- Session: $397 (60-90 min, 1 video, 10-15 photos, 6-week plan)
- Production: $597 (up to 2 hours, 2 videos, 20-25 photos, 6-week plan)

In outreach, $397 is the anchor. Don't push a tier. Let the booking page convert.

## What Every Email Must NOT Do

- Reference prior emails ("as I mentioned", "following up")
- Use the word "follow-up" or "checking in"
- Apologise for emailing
- Use false scarcity or urgency
- Include more than one CTA
- Use any word from the brand voice banned list
- Include fake re:/fw: subjects
- Open with a question hook

## Voice

Load skills: `superbad-brand-voice`, `persuasive-copywriting`, `superbad-outreach-strategy`.

Voice examples seeded in `brand_voice_examples` table (surface: "outreach") — 5 examples covering all touch types.

## Standing Brief

Stored at `lead_generation.standing_brief`. Anchors every outreach email:

> Service businesses in Melbourne and greater Victoria with strong reputations but weak online presence. The kind of business where the owner is too busy doing the work to market it properly — great Google reviews, loyal customers, but their website and social media don't reflect what they actually deliver. Ideal revenue range: $300k–$2M+. Any vertical. If there's a story behind the business and they have ambition, they're a good fit. We're not looking for businesses that need saving. We're looking for good businesses that should be more visible than they are.
