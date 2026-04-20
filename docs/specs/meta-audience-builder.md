# Meta Audience Builder

> **Status:** v1.1 brainstorm — not scoped for v1.0 build  
> **Depends on:** Ad Campaign Builder (not yet specced), Meta Marketing API access  
> **Related specs:** lead-generation, sales-pipeline, saas-subscription-billing, intro-funnel, client-management  
> **Related memories:** `project_lookalike_retarget_from_platform_data`, `project_outreach_retargeting_pixel`, `project_ad_builder_dual_use_and_creative`, `project_performance_pov`

---

## What this is

A feature that turns Lite's first-party data into Meta Custom Audiences and Lookalike Audiences — automatically, without Andy ever touching Ads Manager.

Every person who touches the platform (prospect, trial lead, SaaS subscriber, retainer client) generates behavioural and demographic data. That data is the highest-quality seed available for audience targeting — far better than interest-based cold targeting, because these are people who already engaged with SuperBad or its clients.

---

## Why it matters

SuperBad's performance POV is a compounding flywheel: entertainment content earns attention, engagement data enables precision retargeting, retargeted audiences convert at a fraction of cold CPC. This feature closes the loop between the platform and the ad engine. Without it, the flywheel leaks — platform data stays locked in a database instead of feeding the ad layer.

---

## Data sources (what the platform already collects)

### SuperBad's own audiences (marketing SuperBad itself)

| Source | Data available | Audience use |
|--------|---------------|--------------|
| **Outreach prospects** | Email, company, industry, ICP score, reply classification | Custom Audience seed; lookalikes from high-ICP prospects |
| **Outreach link clickers** | Pixel fire on click-through (plumbed from v1.0) | Retarget warm non-repliers |
| **Website visitors** | Meta Pixel on superbadmedia.com.au | Retarget all visitors; segment by page (pricing, services, portfolio) |
| **Intro Funnel leads** | Email, business details, funnel step reached | Custom Audience; lookalikes from converters vs. drop-offs |
| **Trial shoot bookings** | Full contact + business profile + Brand DNA answers | High-intent seed for lookalikes |
| **SaaS subscribers** | Email, tier, signup date, usage patterns | Lookalike from paying subscribers (the gold seed) |
| **Non-converters** | Portal access period, chat usage, plan downloads | Retarget with re-engagement creative |

### Client audiences (managed on behalf of retainer clients)

| Source | Data available | Audience use |
|--------|---------------|--------------|
| **Client's customer list** | Imported via onboarding / CRM sync | Custom Audience for the client's campaigns |
| **Client website visitors** | Client's own Meta Pixel (configured during setup wizard) | Client retargeting |
| **Content engagement** | Viewers of client content distributed through Lite | Lookalike from engaged viewers |

---

## Audience types to build

### Custom Audiences (exact match)

Upload hashed first-party data (email, phone) to Meta. These are deterministic matches — Meta finds these exact people on Facebook/Instagram.

- **All prospects** — broadest retarget pool
- **Warm prospects** — clicked outreach link or replied positively
- **Funnel drop-offs** — started but didn't complete trial booking
- **Trial completers** — booked and attended a trial shoot
- **Active subscribers** — current paying SaaS users
- **Churned subscribers** — cancelled or lapsed

### Lookalike Audiences (statistical match)

Meta finds new people who resemble the seed audience. Quality depends entirely on seed quality — a lookalike from 500 paying subscribers beats a lookalike from 50,000 cold website visitors.

- **Lookalike from converters** — people who actually paid (subscribers + retainer clients)
- **Lookalike from high-ICP prospects** — prospects the LLM scored highly, regardless of conversion
- **Lookalike from engagers** — 50%+ video viewers, content engagers, portal users
- **Tiered lookalikes** — 1% (tightest match), 3%, 5%, 10% (broadest reach)

---

## How it works inside Lite

### Automatic audience sync

Audiences are not manually created. The platform maintains a set of **audience definitions** — each one is a query against platform data plus a Meta audience ID. A background job runs daily (or on significant data change) to:

1. Query the local database for matching records
2. Hash PII (SHA-256, per Meta's requirements)
3. Push the hashed list to Meta via the Custom Audiences API
4. Meta matches against its user base and updates the audience

Andy never exports a CSV. Never opens Ads Manager. The audiences just exist and stay current.

### Audience health dashboard

A simple admin view showing:

- Each audience, its size, last sync time, match rate
- Seed quality indicator (converters > engagers > visitors > cold)
- Warnings when an audience is too small to be useful (<100 matched users)
- Suggested lookalike audiences based on available seeds

### Client audience isolation

Client data never mixes with SuperBad's own audiences. Each client's audiences live under their own Meta ad account (connected during setup wizard). The platform pushes to the right account based on the campaign context.

---

## v1.0 plumbing (build now, use in v1.1)

Even though the audience builder is v1.1, certain infrastructure must exist from v1.0:

1. **Meta Pixel on all SuperBad web surfaces** — already assumed in outreach spec
2. **Retargeting pixel on outreach links** — already specified (month 3-4 activation)
3. **Hashed-email-ready contact storage** — store a pre-computed SHA-256 hash alongside every contact email so audience sync doesn't need to hash on the fly
4. **Conversion events** — funnel step events, subscription events, and booking events must fire Meta Conversions API server-side (not just browser pixel) for accurate attribution
5. **Consent tracking** — every contact needs a record of how they entered the system and whether they've been informed about ad targeting (privacy compliance)

---

## Privacy and compliance

- **Australian Privacy Act** — commercial electronic messages require consent or existing business relationship. Outreach prospects who haven't opted in can still be in Custom Audiences (Meta handles the ad delivery consent), but this needs legal review.
- **Meta's Terms of Service** — Custom Audiences from customer lists require that data was collected with consent. The platform must track consent provenance per contact.
- **Data minimisation** — only hashed identifiers leave the platform. No raw PII is sent to Meta.
- **Opt-out** — if a contact requests removal (unsubscribe, GDPR-style request), they must be excluded from all audience syncs within 24 hours.

---

## Meta API requirements

- **Meta Business account** with an approved app
- **Custom Audiences permission** — requires Meta app review (lead time: 2-6 weeks)
- **Conversions API access** — for server-side event tracking
- **Rate limits** — audience updates are batched; Meta allows ~1 update per audience per hour
- **App review scope:** `ads_management`, `ads_read`, `business_management`

---

## Open questions for future brainstorm

1. **Google Ads equivalent** — Customer Match + Similar Audiences. Same pattern, different API. Scope as a fast-follow or build simultaneously?
2. **Audience exclusions** — should active retainer clients be excluded from acquisition campaigns automatically? (Probably yes.)
3. **Cross-client insights** — if SuperBad runs campaigns for multiple clients in similar industries, can anonymised aggregate data improve targeting? Legal and ethical minefield — probably not worth it for v1.1.
4. **Minimum viable seed size** — Meta recommends 1,000+ for Custom Audiences, 100+ for Lookalike seeds. What's the bootstrapping strategy when the platform is new and lists are small?
5. **Audience refresh cadence** — daily sync is the default, but high-velocity sources (outreach, funnel) might benefit from near-real-time updates via Meta's incremental API.
6. **Budget allocation by audience** — should the platform auto-suggest budget splits across audience tiers (retarget > lookalike 1% > lookalike 5%)? Or is that the ad builder's job?

---

## Relationship to other v1.1 features

- **Ad Campaign Builder** — the audience builder feeds the campaign builder. Campaigns select from available audiences; the builder doesn't create audiences itself.
- **Conversion Heatmap** — funnel drop-off data feeds both the heatmap visualisation and the "funnel drop-off" retarget audience.
- **Strategic Planning** — audience size and match rates become inputs to goal-setting and progress tracking.
- **Content Studio** — content engagement data (who watched, who clicked) becomes a lookalike seed source.
