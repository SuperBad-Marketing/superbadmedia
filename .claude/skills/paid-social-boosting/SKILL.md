# Paid Social Boosting

Strategy and mechanics for promoting Instagram posts via Meta's Ads API — when to boost, how much to spend, who to target.

## When to Boost

Not every post deserves ad spend. Boost posts that show organic signal — the algorithm has already validated the content, and money amplifies what's working.

### Boost Indicators (Strong)
- **Save rate > 5%** — saves indicate reference value. Boosting extends the shelf life.
- **Share rate > 2%** — shares indicate viral potential. Money accelerates what's already spreading.
- **Engagement rate > 2x account average** — the post is outperforming. Give it fuel.
- **High reach-to-follower ratio** — the algorithm is already distributing beyond followers. Help it.
- **Profile visits spike** — people are curious about the account after seeing the post. Convert that curiosity.

### Boost Indicators (Moderate)
- **Strong comments** — not just emojis, but genuine replies and questions. Indicates resonance.
- **Portfolio/showcase posts** — these are sales tools. Boosting them is lead gen.
- **Testimonial/social proof posts** — credibility content converts when seen by the right audience.

### Don't Boost
- Posts with low organic engagement — if followers didn't care, strangers won't either.
- Personal/behind-the-scenes content — this is for existing audience, not cold traffic.
- Posts more than 7 days old — the freshness signal matters for ad delivery.
- Anything that violates Meta's ad policies (before/after medical images, certain health claims).

## Budget Framework

### For a Small Business / Solo Operator
- **Per-post boost:** $10-50 AUD for 2-5 days. Enough to test and amplify without risk.
- **Monthly budget:** $200-500 AUD across 5-10 boosted posts. Not every post, just the winners.
- **Testing threshold:** $10 minimum to get meaningful data (at least 1,000 impressions).

### Budget Allocation Heuristics
```
Daily budget = total_budget / days
Suggested days:
  - High-engagement post: 3-5 days (ride the wave)
  - Evergreen content: 5-7 days (slow burn)
  - Time-sensitive content: 1-2 days (urgency)
```

### When to Increase Budget
- Engagement rate on the boosted post > 5% — the content is resonating with the paid audience too
- Cost per engagement < $0.50 AUD — efficient delivery
- Profile visits from the boost > 2% of reach — conversion signal

### When to Kill the Boost
- Cost per engagement > $2.00 AUD — too expensive, the content isn't connecting
- Engagement rate < 1% — cold audience isn't interested
- Negative feedback (hide post, report) — stop immediately

## Targeting

### Default Targeting (Good Starting Point)
```json
{
  "geo_locations": {
    "countries": ["AU"],
    "cities": [{ "key": "melbourne", "radius": 50, "distance_unit": "kilometer" }]
  },
  "age_min": 25,
  "age_max": 55,
  "interests": [
    "Small business",
    "Entrepreneurship",
    "Business owner",
    "Marketing"
  ]
}
```

### Targeting by Content Type

**Portfolio / Showcase:**
- Target: business owners in relevant verticals
- Interests: the specific industry (dental, financial planning, hospitality) + "small business"
- Location: Melbourne + 50km (for services) or national (for SaaS)

**Authority / Observation:**
- Target: marketers and business owners (broader)
- Interests: marketing, digital marketing, social media marketing, advertising
- Location: national or broader (authority content travels)

**Social Proof / Testimonials:**
- Target: similar businesses to the testimonial client
- Interests: the client's industry + business management
- Location: match the service geography

### Audience Progression
1. **Month 1-2:** Interest-based targeting (cold traffic)
2. **Month 3-4:** Add retargeting — website visitors, Instagram engagers, video viewers
3. **Month 5+:** Lookalike audiences from best-performing retarget segments
4. **Ongoing:** Exclude existing followers from most boosts (don't pay to reach people who already follow you)

## Promoted Post vs Full Campaign

### Promoted Post (Boost)
- Quick, simple: pick a post, set budget and duration, go
- Limited targeting options
- Optimises for engagement by default
- Best for: amplifying organic winners, local awareness

### Full Ad Campaign
- Full targeting, placement, and optimisation control
- Multiple ad sets for A/B testing
- Custom conversion objectives (website traffic, lead forms, etc.)
- Best for: strategic campaigns, lead gen, launches

**For SuperBad's current stage:** boosted posts are the right tool. Full campaigns come when there's a specific campaign objective (launching a product, promoting a specific offer). The one-click boost feature should create promoted posts, not full campaigns.

## Measuring Boost Performance

### Key Metrics
- **Cost per engagement (CPE):** total spend / total engagements. Below $0.50 AUD is good.
- **Cost per profile visit:** total spend / profile visits from boosted post. Below $2.00 AUD is good.
- **Boost reach vs organic reach:** how much incremental reach did the spend generate?
- **Follower acquisition cost:** if new followers came during the boost period, what's the implied cost per new follower? Below $3.00 AUD is good.

### Attribution Window
- Instagram attributes engagements during the boost period to the boost
- Organic engagements that would have happened anyway get mixed in
- Rule of thumb: compare boosted post engagement to your organic average. The delta is the boost's contribution.

### Learning Phase
- Meta's ad system needs ~50 engagements to exit the "learning phase" and optimise delivery
- For low-budget boosts ($10-20), this means the full budget might be spent in the learning phase
- Don't judge performance until at least 500 impressions have been delivered

## Compliance & Policy

### Meta Advertising Policies (Key Restrictions)
- **Medical/health:** no before/after images for cosmetic procedures, no implied health outcomes
- **Financial services:** disclaimers required, no guaranteed returns language
- **Alcohol:** age-restricted targeting required
- **Political/social issues:** additional authorisation and disclaimer requirements

### For SuperBad's Verticals
- **Medical aesthetics clients:** no boosting before/after posts. Boost the clinic's branding, team, process — not the results photos.
- **Financial planning clients:** include appropriate disclaimers. "General information only" etc.
- **Allied health:** less restricted, but avoid specific health outcome claims.

### Rejection Recovery
If a boost is rejected:
1. Read the rejection reason (usually in the Ads Manager or API response)
2. Edit the caption to remove the flagging content (often a health claim or restricted term)
3. Resubmit
4. If still rejected, the image itself may be the issue (text overlay, medical imagery)

## AI Recommendation Logic

When the strategy engine evaluates whether to recommend boosting a post:

```
score = (
  save_rate_percentile × 0.30 +
  share_rate_percentile × 0.25 +
  engagement_rate_percentile × 0.25 +
  reach_velocity × 0.20
)

if score > 0.70:
  recommend boost
  suggested_budget = base_budget × (1 + score - 0.70)
  suggested_days = 3 if score > 0.85 else 5
  
if score 0.50-0.70:
  mention as "worth considering" but don't push
  
if score < 0.50:
  don't mention
```

The recommendation should include:
1. **Why:** "This post's save rate is in the top 10% of your content"
2. **Who:** suggested audience based on content type
3. **How much:** suggested budget and duration
4. **Expected outcome:** "Based on similar boosts, expect ~X reach for $Y"
