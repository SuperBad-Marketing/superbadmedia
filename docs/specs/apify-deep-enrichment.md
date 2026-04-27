# Apify Deep Enrichment

**Owner:** Lead Generation pipeline (LG-3 extension)
**Status:** Spec locked, ready to build
**Date:** 2026-04-27

## Purpose

After cheap enrichment + scoring qualifies a candidate, run 4 Apify actors in parallel to gather deep signals — website content, Facebook page, LinkedIn company profile, TikTok profile. These signals feed a soft score adjustment and provide richer context for outreach draft generation.

## Brainstorm Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Gate position | After cheap enrichment + scoring. Only qualified candidates get deep enrichment. |
| 2 | Actors | 4: website content crawler, Facebook page, LinkedIn company, TikTok profile |
| 3 | Google overlap | None — existing free Google APIs already cover Maps + Search signals |
| 4 | Instagram | Already in cheap enrichment via Business Discovery API — not duplicated |
| 5 | Scoring model | Soft adjustment only (±5 cap). No auto-disqualification. |
| 6 | Dead social signal | POSITIVE — business with reviews but no social media needs marketing help |
| 7 | Sole traders | Not a negative signal — could be high-revenue |
| 8 | API token | Single shared Apify token (stored via setup wizard, `getCredential("apify")`) |
| 9 | Execution | All 4 actors run in parallel per candidate, all candidates in parallel |
| 10 | Website distillation | Haiku LLM call extracts structured brief from raw website content |
| 11 | Draft integration | Deep enrichment context injected into outreach draft prompt |

## Pipeline Position

```
existing: discovery → dedup → ICP pre-filter → enrich (6 signals) → score → qualify
                                                                          ↓
new:                                                            deep enrich (4 Apify actors, parallel)
                                                                          ↓
                                                                re-score with soft adjustment
                                                                          ↓
                                                                contact discovery → candidate → draft
```

Deep enrichment runs on the `topCandidates` list (already scored, sorted, capped). Candidates that drop below the qualification floor after soft adjustment are removed.

## ViabilityProfile Extensions

New optional sections added to `ViabilityProfile`:

- `facebook` — page name, follower count, post recency, active flag
- `linkedin` — company name, employee count range, industry, follower count, active flag
- `tiktok` — follower count, video count, post recency, active flag
- `website_content` — services, USPs, audience signals, maturity signals, content quality, distilled brief
- `deep_enrichment` — metadata: timestamp, actors attempted/succeeded, soft adjustment, reasons

## Soft Adjustment Rules (±5 cap)

All adjustments are additive. Total clamped to [-5, +5].

| Signal | Adjustment | Rationale |
|--------|-----------|-----------|
| Active Google reviews + dead social media | +3 | Real business that needs marketing help |
| Website exists but content quality poor/basic | +1 | Needs professional content |
| LinkedIn shows 10+ employees | +1 | Can likely afford services |
| Premium pricing on website | +1 | Higher revenue business |
| Website mentions in-house marketing team | -2 | Less likely to buy external |
| All socials active + professional content | -2 | May not need help |
| TikTok active with high engagement | -1 retainer / +1 SaaS | Already doing creative; may want tools |

## LLM Jobs

| Job slug | Tier | Purpose |
|----------|------|---------|
| `lead-gen-deep-website-distill` | Haiku | Distill raw website content into structured brief |

## Cost Estimate (per candidate)

- 4 Apify actor runs: ~0.2 CU total (~$0.06 AUD)
- 1 Haiku LLM call: ~$0.002 AUD
- Total: ~$0.06 per qualified candidate
- At 5 candidates/day: ~$0.30/day, ~$9/month

Well within Apify Starter plan ($49/month, $5 platform usage included).

## Files

| File | Action |
|------|--------|
| `lib/lead-gen/types.ts` | Extend ViabilityProfile |
| `lib/lead-gen/sources/apify-runner.ts` | Shared Apify start/poll/fetch utility |
| `lib/lead-gen/sources/apify-website-crawler.ts` | Website content actor |
| `lib/lead-gen/sources/apify-facebook-page.ts` | Facebook page actor |
| `lib/lead-gen/sources/apify-linkedin-company.ts` | LinkedIn company actor |
| `lib/lead-gen/sources/apify-tiktok-profile.ts` | TikTok profile actor |
| `lib/lead-gen/enrich/deep-enrichment.ts` | Orchestrator + soft adjustment + LLM distill |
| `lib/ai/models.ts` | Add `lead-gen-deep-website-distill` job |
| `lib/integrations/vendors/apify.ts` | Add 4 new job entries |
| `lib/lead-gen/daily-search.ts` | Wire deep enrichment after scoring |
| `lib/lead-gen/draft-generator.ts` | Inject deep context into outreach prompt |
