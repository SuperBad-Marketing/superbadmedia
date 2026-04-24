# Instagram Channel

**Status:** Brainstorm locked 2026-04-24 (updated with posting, strategy engine, boosting)
**Owner:** Andy
**Phase:** Post-v1.0 feature (build when Meta App Review clears)

## 1. What this is

Full Instagram management inside Lite — publish content, track metrics, get AI-powered strategy recommendations, boost top-performing posts, and handle replies autonomously. SuperBad's own account first, architected so client accounts slot in later without a rewrite.

The flywheel: metrics → AI strategy → content ideas → Content Studio → Instagram → metrics.

## 2. Where it lives

- **Sidebar nav:** under "Content" group, alongside Studio
  ```
  Content
    ├─ Studio        (create)
    └─ Instagram     (distribute + measure)
  ```
- **Route:** `/lite/content/instagram`
- **Content Studio cross-link:** "Instagram" tab in `content-tabs.tsx` links to the dashboard
- **Content Studio integration:** "Post to Instagram" button appears on rendered posts
- **Future channels** (LinkedIn, TikTok) sit alongside at `/lite/content/[channel]`

## 3. Posting from Content Studio

### 3.1 Post button
After a Content Studio post is rendered, a "Post to Instagram" button appears on the preview card. Clicking opens the post-to-Instagram modal.

### 3.2 Post modal contents
- **Account selector** — dropdown defaulting to the only connected account. Multi-account ready.
- **Image preview** — the rendered output. Carousel posts show slide navigator.
- **Aspect ratio picker** — square (1:1), portrait (4:5), landscape (1.91:1). Defaults to 4:5 (best engagement). Content Studio already renders multiple ratios.
- **Caption** — auto-drafted by LLM from the brief + generated copy + Brand DNA voice rules. Editable. Brand-voice drift badge (same pattern as quote send modal).
- **Post type label** — "Single image" or "Carousel (N slides)" based on slide count. Informational.
- **Post button** — "Post now" in SuperBad red.

### 3.3 Caption generation
- LLM drafts caption using `instagram-draft-caption` job slug (Sonnet).
- Prompt includes: original Content Studio brief, generated copy from slides, SuperBad brand voice rules, content type context.
- Caption follows brand voice: opens with an observation, no hashtag walls, no emoji abuse, no question hooks.
- Hashtags: 0-2 max, only a brand tag (`#superbadmarketing`) if any. Included naturally in caption body, not as a separate block.
- Drift score displayed inline — same badge component and thresholds as quote send modal.
- Fallback: if LLM kill switch is off, use the Content Studio brief as caption verbatim.

### 3.4 Publishing flow
1. User selects ratio and reviews/edits caption
2. "Post now" triggers server action
3. Server action:
   a. Gets Cloudinary URL for the selected render (already uploaded by Content Studio)
   b. Creates media container(s) via Instagram Graph API
   c. For carousels: creates child containers first, then carousel container
   d. Publishes the container
   e. Polls for `FINISHED` status (async, up to 30 seconds)
   f. Saves `instagram_media` row linked to the Content Studio post
   g. Enqueues aggressive polling for the first 48 hours (see §4.4)
4. Success: toast confirmation, post appears in Instagram dashboard
5. Error: display error message in modal, don't close

### 3.5 Post tracking
- `instagram_media` row links to `content_studio_posts.id` via `source_post_id`
- Enables the strategy engine to correlate Content Studio content types with Instagram performance
- "View on Instagram" link from both Content Studio history and Instagram dashboard

## 4. Metrics dashboard

### 4.1 Account growth (always visible)
- Follower count over time (line chart, 30/60/90 day toggle)
- Follows / unfollows per day
- Reach and impressions (daily, with trend)
- Profile visits and website clicks
- Growth trajectory projection: "At this rate, you'll hit X followers by Y"

### 4.2 Content performance (always visible)
- Per-post card: thumbnail, engagement rate, saves, shares, comments, reach
- Composite engagement score: `(saves × 4 + shares × 3 + comments × 2 + likes × 1) / reach × 100`
- Sortable by: date, engagement score, reach, saves
- Best/worst performing posts flagged with visual indicator
- Content type breakdown chart: carousel vs single vs reel performance comparison

### 4.3 Audience insights (collapsed by default, toggle to expand)
- Age/gender distribution
- Top locations (city + country)
- Active hours (when followers are online — informs posting time recommendations)
- Collapsed state shows a one-line summary ("72% 25–44, mostly Melbourne")

### 4.4 Data freshness — hybrid polling
- **Account-level metrics:** daily sync (once per day, morning AEST)
- **Fresh posts (< 48 hours old):** hourly polling. This is where the interesting engagement data lives.
- **Mature posts (> 48 hours):** daily sync alongside account metrics
- **Real-time alerts** trigger during the 48-hour aggressive window (see §6.2)
- "Last synced" timestamp visible on dashboard
- No manual refresh button — syncs are frequent enough

## 5. Data model

### 5.1 `instagram_accounts` table
```
id                  text PK
instagram_user_id   text NOT NULL (Meta's user ID)
username            text NOT NULL
account_type        text NOT NULL ("own" | "client")
company_id          text FK → companies.id (null for own account)
access_token        text NOT NULL (encrypted long-lived token)
token_expires_at_ms integer
connected_at_ms     integer NOT NULL
status              text NOT NULL ("active" | "disconnected" | "revoked")
```

### 5.2 `instagram_metrics_snapshots` table
```
id                  text PK
account_id          text FK → instagram_accounts.id
snapshot_date       text NOT NULL (YYYY-MM-DD)
followers           integer
follows             integer
reach               integer
impressions         integer
profile_views       integer
website_clicks      integer
synced_at_ms        integer NOT NULL
```

### 5.3 `instagram_media` table
```
id                  text PK
account_id          text FK → instagram_accounts.id
ig_media_id         text NOT NULL (Meta's media ID)
media_type          text NOT NULL ("IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL" | "STORY")
source_post_id      text FK → content_studio_posts.id (null for posts not from Content Studio)
caption             text
permalink           text
thumbnail_url       text
published_at_ms     integer NOT NULL
engagement_score    real (composite: saves×4 + shares×3 + comments×2 + likes / reach × 100)
likes               integer
comments_count      integer
saves               integer
shares              integer
reach               integer
impressions         integer
video_views         integer
video_avg_watch_ms  integer
boost_status        text ("none" | "recommended" | "boosted" | "completed")
boost_budget_cents  integer
boost_start_ms      integer
boost_end_ms        integer
last_synced_at_ms   integer NOT NULL
```

### 5.4 `instagram_audience_snapshots` table
```
id                  text PK
account_id          text FK → instagram_accounts.id
snapshot_date       text NOT NULL
age_gender_json     text (JSON — { "25-34_M": 0.18, ... })
top_cities_json     text (JSON — [{ "name": "Melbourne", "pct": 0.32 }, ...])
top_countries_json  text (JSON)
online_hours_json   text (JSON — hourly activity distribution)
synced_at_ms        integer NOT NULL
```

### 5.5 `instagram_strategy_reports` table
```
id                  text PK
account_id          text FK → instagram_accounts.id
report_type         text NOT NULL ("weekly_digest" | "realtime_alert")
generated_at_ms     integer NOT NULL
period_start_ms     integer
period_end_ms       integer
summary_text        text NOT NULL
recommendations_json text (JSON — array of recommendation objects)
content_ideas_json  text (JSON — array of content idea objects with pre-filled briefs)
metrics_snapshot_json text (JSON — the metrics data the LLM read when generating)
```

### 5.6 `instagram_replies` table
```
id                  text PK
account_id          text FK → instagram_accounts.id
ig_comment_id       text (null for DMs)
ig_conversation_id  text (null for comments)
ig_message_id       text (null for comments)
reply_type          text NOT NULL ("comment" | "dm")
inbound_text        text NOT NULL
inbound_author      text
classification      text ("lead" | "complaint" | "collab" | "question" | "praise" | "spam" | "simple")
draft_text          text NOT NULL
final_text          text (null until sent — may differ from draft if Andy edited)
status              text NOT NULL ("pending_review" | "approved" | "sent" | "escalated" | "skipped")
sent_at_ms          integer
escalated_at_ms     integer
created_deal_id     text FK → deals.id (if classified as lead and auto-created)
feedback            text
feedback_sentiment  text ("positive" | "negative" | null)
created_at_ms       integer NOT NULL
```

### 5.7 `instagram_voice_corrections` table
```
id                  text PK
account_id          text FK → instagram_accounts.id
reply_id            text FK → instagram_replies.id
reply_type          text NOT NULL ("comment" | "dm")
ai_draft            text NOT NULL
andy_version        text NOT NULL
correction_note     text (optional explicit feedback)
created_at_ms       integer NOT NULL
```

## 6. AI strategy engine

### 6.1 Weekly digest
Every Monday, a scheduled task:
1. Reads the last 7 days of metrics (account + all media)
2. Reads the last 4 weeks for trend context
3. Calls LLM (`instagram-strategy-digest`, Sonnet) with:
   - Metrics data (follower growth, engagement trends, per-post performance)
   - Content type breakdown (which types performed best)
   - Audience data (demographics, active hours)
   - Brand DNA context (who SuperBad is, what they do)
   - Previous digest's recommendations (did the advice work?)
4. LLM generates:
   - **Summary** — 3-5 bullet points on what happened this week
   - **Content mix analysis** — which content pillars/types are performing, which aren't
   - **Best posting times** — based on audience activity data
   - **Growth trajectory** — current rate, projection, what would accelerate it
   - **Recommended actions** — 3-5 concrete next moves, specific and actionable
   - **Content ideas** — 3-5 pre-filled Content Studio briefs with content type, template suggestion, and brief text. Each has a "Generate this" button that drops into Content Studio with the brief pre-filled.
5. Digest surfaces as a card on the Instagram dashboard

### 6.2 Real-time alerts
During the 48-hour aggressive polling window, the system checks each fresh post against historical cohort averages:

**Boost recommendation alert:**
```
score = (
  save_rate_percentile × 0.30 +
  share_rate_percentile × 0.25 +
  engagement_rate_percentile × 0.25 +
  reach_velocity × 0.20
)
if score > 0.70: recommend boost
```
Surfaces as an alert card: "This post is outperforming — boost it?"

**Unusual activity alert:**
- Follower spike (>3x daily average) → "You gained X followers today — something's working"
- Engagement anomaly (>2x average on a post) → "This post is resonating — here's why"
- Negative signal (high unfollow rate) → "Unusual unfollows today — worth checking"

### 6.3 Content ideas flywheel
Strategy recommendations that include content ideas link directly to Content Studio:
- "Generate this" button creates a new Content Studio post with:
  - `content_type` set from the recommendation
  - `brief` pre-filled with the recommended topic
  - `template_id` suggested by the strategy engine
  - `source_recommendation_id` linking back to the strategy report
- Closes the loop: metrics → insight → idea → content → post → metrics

## 7. Boost / promoted posts

### 7.1 Boost recommendation
The strategy engine identifies posts worth boosting (see §6.2 scoring). Each recommendation includes:
- **Why:** "This post's save rate is in the top 10% of your content"
- **Who:** suggested audience targeting based on content type
- **How much:** suggested budget ($10-50 AUD) and duration (3-5 days)
- **Expected outcome:** projected reach based on similar boosts

### 7.2 One-click boost flow
1. Andy taps "Boost" on a recommendation or any published post
2. Modal shows: budget slider, duration picker, audience (auto-suggested with override)
3. "Boost" button creates a promoted post via Meta Ads API:
   - Creates ad creative from the existing media
   - Creates ad set with budget, targeting, and duration
   - Status set to ACTIVE (goes live immediately)
4. Boost status tracked on `instagram_media` row
5. Boost performance metrics synced daily while active

### 7.3 Boost targeting defaults
```json
{
  "geo_locations": { "countries": ["AU"], "cities": [{ "key": "melbourne", "radius": 50 }] },
  "age_min": 25,
  "age_max": 55,
  "interests": ["Small business", "Marketing", "Entrepreneurship"]
}
```
Editable in the boost modal. Saved as default for future boosts.

### 7.4 Boost performance tracking
- Cost per engagement (CPE)
- Incremental reach (boost reach - organic baseline)
- Profile visits attributed to boost
- Follower acquisition during boost period
- Kill triggers: CPE > $2.00 AUD or engagement rate < 1% → recommend stopping

## 8. Reply system

### 8.1 Tiered autonomy
- **Draft mode** (default on connect): every reply goes to a review queue. Andy approves, edits, or skips.
- **Autonomous mode**: AI sends replies automatically. Andy reviews a log after the fact.
- Comments and DMs graduate independently — comments might hit autonomous first (lower stakes).
- Graduation trigger: when edit rate drops below 15% over the last 50 replies for that type.
- Andy can manually flip the mode at any time.

### 8.2 Voice registers
- **Comments (public):** SuperBad brand voice — dry, punchy, observational. Short. One sentence preferred.
- **DMs (private):** Bartender register — still has personality but warmer, more conversational.
- Both registers defined in prompt files under `lib/ai/prompts/instagram-channel/`.

### 8.3 Reply polling
- Poll every 2-3 minutes via scheduled task
- Each poll: check recent media for new comments + check conversations for new messages
- Rate limit budget: ~80 calls/hour reserved for reply operations
- New inbound → classify → draft reply → queue (draft mode) or send (autonomous mode)

### 8.4 Classification and routing
| Classification | Action |
|---|---|
| Simple | Auto-handled in both modes |
| Lead | Auto-create deal in pipeline, flag for Andy |
| Complaint | Escalate immediately, no auto-reply |
| Collab | Acknowledge with holding reply, escalate |
| Spam | Archive silently |
| Question / Praise | Draft reply as normal |

### 8.5 Training and correction loop
- When Andy edits a draft, the (AI draft → Andy's version) pair saves to `instagram_voice_corrections`
- Reply prompt includes the 20 most recent corrections as few-shot examples
- Graduation metric: `corrections in last 50 / 50 < 0.15` → suggest autonomous mode

## 9. Meta API integration

### 9.1 Required permissions (Meta App Review)
- `instagram_basic` — account info, media
- `instagram_content_publish` — publish images, carousels, reels
- `instagram_manage_insights` — read account and media insights
- `instagram_manage_comments` — read/reply to comments
- `instagram_manage_messages` — read/reply to DMs (requires Business verification)
- `pages_show_list` + `pages_read_engagement` — required for Graph API access
- `ads_management` — create promoted posts / boosted posts
- `business_management` — for client account connections

### 9.2 Auth flow
- OAuth 2.0 via Meta Login (lives under renamed `meta` vendor, not `meta-ads`)
- Short-lived token → long-lived token (60 days)
- Scheduled task refreshes token before expiry (runs at day 50)
- Token stored encrypted in `instagram_accounts.access_token`
- Disconnect flow: revoke token, set status to "disconnected", stop polling

### 9.3 API client
- Centralised in `lib/channels/instagram/client.ts`
- All calls logged to `external_call_log` (COB-1 pattern)
- Rate limit tracking: count calls per rolling hour, pause if approaching 200
- Retry with backoff on 429 responses

## 10. LLM model registry entries
- `instagram-draft-caption`: sonnet (brand voice, needs quality)
- `instagram-classify-inbound`: haiku (classification, fast)
- `instagram-draft-comment-reply`: sonnet (brand voice)
- `instagram-draft-dm-reply`: sonnet (brand voice)
- `instagram-escalation-summary`: haiku (internal note)
- `instagram-strategy-digest`: sonnet (weekly analysis + recommendations)
- `instagram-realtime-alert`: haiku (simple pattern detection)
- `instagram-boost-rationale`: haiku (explain why a post is worth boosting)

## 11. Cockpit integration
- Attention rail item when there are pending replies in draft mode
- Daily brief includes Instagram highlight if a post performed notably well or poorly
- Cockpit AI assistant gets tools: `get_instagram_metrics`, `list_pending_replies`, `get_strategy_digest`
- Real-time alerts also surface in cockpit attention rail

## 12. Future: client accounts (v1.1+)
- Each client connects their own Instagram via OAuth from the portal
- Brand DNA profile feeds the reply voice prompt
- Client-specific metrics dashboard accessible from client detail page
- Separate correction logs per client account
- Client portal shows their own metrics (read-only, no reply management)
- `instagram_accounts.company_id` FK already supports this
- Posting from Content Studio supports per-client accounts via account selector

## 13. Build order
1. Schema + migrations (tables from §5)
2. Rename `meta-ads` vendor to `meta`, add OAuth scopes for publishing + insights + ads
3. Instagram API client (`lib/channels/instagram/client.ts`)
4. Account connection flow (OAuth, token management, `instagram_accounts` row)
5. **Posting flow** — Content Studio "Post to Instagram" button + modal + caption generation
6. Metrics sync — daily account metrics + 48-hour aggressive polling + `instagram_media` sync
7. Dashboard UI — account growth charts, content performance cards, audience insights
8. Strategy engine — weekly digest + real-time alerts + content ideas with "Generate this"
9. Boost flow — recommendation cards + one-click boost modal + Meta Ads API integration
10. Reply system — polling, classification, draft queue, voice prompts
11. Correction loop + autonomous mode graduation
12. Cockpit integrations (attention rail, brief, assistant tools)

## 14. Dependencies
- Meta App Review approval (1-4 week external dependency)
- Meta Business account linked to SuperBad's Instagram Professional account
- `INSTAGRAM_APP_ID` + `INSTAGRAM_APP_SECRET` env vars
- Cloudinary integration active (Content Studio renders provide the image URLs for publishing)
- Content Studio functional (posting is the bridge between creation and distribution)

## 15. Settings keys (for settings registry)

```
instagram.sync.daily_account_metrics_enabled    = true
instagram.sync.aggressive_polling_hours         = 48
instagram.post.default_aspect_ratio             = "4:5"
instagram.post.caption_llm_enabled              = true
instagram.post.max_hashtags                     = 2
instagram.strategy.weekly_digest_enabled        = true
instagram.strategy.weekly_digest_day            = "monday"
instagram.strategy.realtime_alerts_enabled      = true
instagram.strategy.boost_score_threshold        = 0.70
instagram.strategy.content_ideas_count          = 5
instagram.boost.default_budget_aud              = 20
instagram.boost.default_duration_days           = 3
instagram.boost.auto_kill_cpe_threshold_aud     = 2.00
instagram.reply.comment_mode                    = "draft"
instagram.reply.dm_mode                         = "draft"
instagram.reply.graduation_threshold            = 0.15
instagram.reply.graduation_window               = 50
instagram.reply.poll_interval_seconds           = 150
instagram.token.refresh_at_day                  = 50
```
