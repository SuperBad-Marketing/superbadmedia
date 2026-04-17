# Quote Builder — Catalogue Seed Content

> Canonical source for catalogue taxonomy, seed items, retainer tiers,
> and starter templates. Phase 5 build session seeds `catalogue_items`
> and `quote_templates` tables from this file.
>
> Prices are GST-inclusive defaults (AUD cents in schema, AUD dollars
> here for readability). Andy overrides per-client — these are starting
> points, not public rates.

---

## 1. Categories

| Category | Description | Typical units |
|---|---|---|
| `creative_production` | Shoot days, video editing, motion graphics, colour grading | day, piece |
| `ad_management` | Meta Ads, Google Ads, campaign setup, reporting | month, project |
| `content` | Social media management, blog, newsletter, content planning | month, piece |
| `strategy` | Brand strategy, campaign planning, quarterly reviews, competitor analysis | hour, project |
| `photography` | Product, headshot, location, event photography | day |

---

## 2. Retainer tiers

| Tier name | `tier_rank` | Description | Typical monthly range |
|---|---|---|---|
| Core | 1 | Performance marketing fundamentals — ad management on one platform, monthly reporting, basic ad creative refresh | $2,500–$4,000 |
| Production | 2 | Above + regular creative production — monthly shoot day, social content on one platform, content calendar | $5,000–$7,000 |
| Full Service | 3 | The full operation — multi-platform ads, regular shoots, all social channels, blog, newsletter, strategy sessions, quarterly reviews | $8,000–$12,000 |

Tier names appear on: quote web page §3 heading, cancel-flow upgrade/downgrade
cards, PDF line-items summary. Keep them plain — the prose around them carries
the voice.

### Upgrade/downgrade copy rules

- Upgrade card: "{Tier name} — {one-line scope summary}. Starts at ${low_end}/month."
- Downgrade card: "{Tier name} — {one-line scope summary}. From ${low_end}/month."
- No tier below current: "You're already on the smallest retainer."

---

## 3. Seed items (30 items)

### Creative Production

| Name | Unit | Default price (inc GST) | Tier rank | Description |
|---|---|---|---|---|
| Half-day shoot | day | $1,650 | — | 4 hours, single crew. Studio or on-location. |
| Full-day shoot (1 crew) | day | $2,750 | — | 8 hours, single shooter/editor. |
| Full-day shoot (2 crew) | day | $4,400 | — | 8 hours, two-person crew. Flagship content. |
| Video edit — short-form | piece | $385 | — | Social-ready, under 60 seconds. |
| Video edit — long-form | piece | $880 | — | YouTube / brand content, 3+ minutes. |
| Motion graphics package | piece | $550 | — | Animated titles, lower thirds, transitions. |
| Colour grade | piece | $220 | — | Per deliverable. Cinematic grade. |
| Thumbnail & stills | piece | $110 | — | Extracted or purpose-shot. Per image. |

### Ad Management

| Name | Unit | Default price (inc GST) | Tier rank | Description |
|---|---|---|---|---|
| Meta Ads management | month | $1,320 | — | Campaign management, optimisation, audience building. |
| Google Ads management | month | $1,320 | — | Search + display, bid strategy, keyword management. |
| Ad creative production | piece | $440 | — | Per asset set (image + copy variants). |
| Campaign strategy & setup | project | $1,650 | — | New campaign architecture, audience research, creative brief. |
| Weekly ad reporting | month | $550 | — | Performance summary, spend tracking, recommendations. |

### Content

| Name | Unit | Default price (inc GST) | Tier rank | Description |
|---|---|---|---|---|
| Social management — Instagram | month | $1,100 | — | Content creation, scheduling, community management. |
| Social management — LinkedIn | month | $880 | — | Content creation, scheduling, engagement. |
| Social management — Facebook | month | $880 | — | Content creation, scheduling, community management. |
| Blog post — long-form | piece | $550 | — | 1,000+ words. SEO-optimised. |
| Newsletter management | month | $660 | — | Monthly send, list management, reporting. |
| Content calendar | month | $440 | — | Cross-platform planning and scheduling. |

### Strategy

| Name | Unit | Default price (inc GST) | Tier rank | Description |
|---|---|---|---|---|
| Brand strategy session | hour | $330 | — | One-on-one with Andy. Positioning, messaging, direction. |
| Quarterly review & planning | project | $880 | — | Performance review, next-quarter roadmap. |
| Competitor analysis | project | $990 | — | Market positioning, gap analysis, opportunity mapping. |
| Campaign planning | project | $1,320 | — | End-to-end campaign architecture and brief. |

### Photography

| Name | Unit | Default price (inc GST) | Tier rank | Description |
|---|---|---|---|---|
| Product photography session | day | $1,980 | — | Studio or styled. Full day. |
| Headshots & team portraits | day | $1,320 | — | On-location or studio. Full day. |
| Location / event photography | day | $2,200 | — | On-site, full day. |

### Retainer packages

| Name | Unit | Default price (inc GST) | Tier rank | Description |
|---|---|---|---|---|
| Core Retainer | month | $3,300 | 1 | Ad management (1 platform), monthly reporting, basic ad creative. |
| Production Retainer | month | $5,500 | 2 | Above + monthly half-day shoot, social content (1 platform), content calendar. |
| Full Service Retainer | month | $9,900 | 3 | Multi-platform ads, regular shoots, all social, blog, newsletter, strategy sessions. |

---

## 4. Starter templates

Three `quote_templates` rows for common retainer shapes. Each pre-loads
section scaffolds and default line items. Andy edits per-client.

### Template 1: "Performance Starter"

- **Structure:** retainer
- **Default term:** 3 months
- **Default line items:** Core Retainer, Meta Ads management, Weekly ad reporting
- **Section scaffolds:**
  - §1 *What you told us:* (empty — Claude drafts from context)
  - §2 *What we'll do:* "Ads management and reporting. One platform to start — we'll optimise from there."
  - §3 *The price:* (derived)
  - §4 *The terms:* (default terms link)

### Template 2: "Creative & Performance"

- **Structure:** retainer
- **Default term:** 6 months
- **Default line items:** Production Retainer, Meta Ads management, Half-day shoot, Social management — Instagram, Content calendar
- **Section scaffolds:**
  - §2 *What we'll do:* "Monthly shoots, social content, and ad management. The creative feeds the ads. The ads feed the business."

### Template 3: "Full Partnership"

- **Structure:** retainer
- **Default term:** 12 months
- **Default line items:** Full Service Retainer, Meta Ads management, Google Ads management, Full-day shoot (1 crew), Social management — Instagram, Social management — LinkedIn, Blog post — long-form (×2), Newsletter management, Quarterly review & planning
- **Section scaffolds:**
  - §2 *What we'll do:* "Everything. Shoots, social, ads, blog, newsletter, strategy. We run your marketing. You run your business."
