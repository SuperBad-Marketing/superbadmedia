# Instagram Graph API Reference

Technical reference for Instagram publishing, insights, and account management via Meta's Graph API v21.0+.

## Authentication

### OAuth Flow
Instagram publishing requires a Facebook App with Instagram Graph API permissions.

**Required scopes:**
- `instagram_basic` — read profile info, media
- `instagram_content_publish` — publish images, carousels, reels
- `instagram_manage_insights` — read account and media insights
- `pages_show_list` — list Facebook Pages
- `pages_read_engagement` — read Page engagement data
- `ads_management` — create promoted posts / boosted posts
- `business_management` — manage business accounts

**Token type:** Long-lived Page Access Token (60-day expiry, auto-refreshable).

**Flow:**
1. User authorises Facebook Login with the required scopes
2. Exchange short-lived user token for long-lived user token (`GET /oauth/access_token?grant_type=fb_exchange_token`)
3. Get Page tokens from long-lived user token (`GET /me/accounts`)
4. Page tokens obtained from long-lived user tokens are automatically long-lived
5. Get Instagram Business Account ID from the Page (`GET /{page-id}?fields=instagram_business_account`)

### Token Refresh
Long-lived tokens expire after 60 days. Refresh before expiry:
```
GET /oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={existing-token}
```
Schedule a refresh task at day 50 to avoid expiry.

## Publishing

### Single Image Post

**Step 1: Create media container**
```
POST /{ig-user-id}/media
  image_url={public-image-url}
  caption={caption-text}
  location_id={optional-location-id}
  alt_text={alt-text}
```
The `image_url` must be publicly accessible. Use Cloudinary URLs (already in the pipeline from Content Studio renders).

**Step 2: Publish the container**
```
POST /{ig-user-id}/media_publish
  creation_id={container-id-from-step-1}
```

**Step 3: Check status**
The publish is async. Poll the container status:
```
GET /{container-id}?fields=status_code
```
Values: `FINISHED`, `IN_PROGRESS`, `ERROR`.

### Carousel Post

**Step 1: Create child containers (one per slide)**
```
POST /{ig-user-id}/media
  image_url={slide-image-url}
  is_carousel_item=true
  alt_text={alt-text}
```
Repeat for each slide (2-10 items).

**Step 2: Create carousel container**
```
POST /{ig-user-id}/media
  media_type=CAROUSEL
  caption={caption-text}
  children={child-id-1},{child-id-2},...
  location_id={optional}
```

**Step 3: Publish the carousel**
```
POST /{ig-user-id}/media_publish
  creation_id={carousel-container-id}
```

### Reel (Video Post)
```
POST /{ig-user-id}/media
  media_type=REELS
  video_url={public-video-url}
  caption={caption-text}
  share_to_feed=true
  alt_text={alt-text}
```
Then publish as normal. Video processing is async — poll status.

### Image Requirements
- JPEG format (PNG works but JPEG is recommended)
- Max file size: 8MB
- Aspect ratios: 1:1, 4:5, 1.91:1 (platform auto-crops outside these)
- Min resolution: 320px on shortest side
- Max resolution: no hard limit, but 1080px width is optimal

### Caption Limits
- Max length: 2200 characters
- Max hashtags: 30 (but use 0-2 per strategy)
- Max @mentions: 20
- Line breaks: use `\n` in the API string
- Emoji: supported in UTF-8 encoding

## Insights API

### Account-Level Insights
```
GET /{ig-user-id}/insights
  metric={metric-name}
  period={day|week|days_28|lifetime}
  since={unix-timestamp}
  until={unix-timestamp}
```

**Available metrics (period: day):**
- `impressions` — total times content was displayed
- `reach` — unique accounts that saw content
- `profile_views` — profile page visits
- `website_clicks` — taps on website link in bio
- `follower_count` — current follower count (period: day only)

**Available metrics (period: lifetime, on the account):**
- `audience_city` — top cities of followers
- `audience_country` — top countries
- `audience_gender_age` — gender + age breakdown
- `audience_locale` — language/locale breakdown
- `online_followers` — when followers are most active (hour of day)

### Media-Level Insights
```
GET /{media-id}/insights
  metric={metric-name}
```

**Image/Carousel metrics:**
- `impressions` — total views
- `reach` — unique accounts
- `engagement` — likes + comments + saves
- `saved` — saves count
- `likes` — likes count (since mid-2024 this is re-exposed)
- `comments` — comments count
- `shares` — shares count
- `carousel_album_engagement` — total engagement across all carousel slides
- `carousel_album_impressions` — total impressions across all carousel slides
- `carousel_album_reach` — total reach across all carousel slides

**Reel metrics:**
- `plays` — total plays
- `reach` — unique accounts
- `likes`, `comments`, `shares`, `saved`
- `total_interactions` — all interactions combined

### Follower Demographics
```
GET /{ig-user-id}/insights
  metric=follower_demographics
  period=lifetime
  metric_type=total_value
  breakdown={city|country|age|gender}
```
Returns the top values. Only available for accounts with 100+ followers.

## Rate Limits

### Publishing
- **25 posts per 24 hours** per Instagram account (images + carousels + reels combined)
- **50 API calls per hour** for content publishing endpoints
- Carousel child containers don't count against the 25-post limit until published

### Insights
- **200 calls per hour** per user token for insights endpoints
- Data availability: insights data has a 24-48 hour lag
- Historical data: available for the last 2 years

### General
- **200 calls per hour** per user per app for most endpoints
- Rate limit headers: `X-Business-Use-Case-Usage` in response

## Error Handling

### Common Error Codes
- `190` — invalid/expired access token. Trigger token refresh.
- `100` — invalid parameter. Check image_url accessibility and format.
- `9007` — publishing rate limit reached. Queue and retry after 24h.
- `36003` — media container expired (containers expire after 24h if not published)
- `2207026` — image too small. Min 320px on shortest side.

### Webhook Events (Optional)
Can subscribe to:
- `comments` — new comments on media
- `mentions` — when account is @mentioned
- `story_insights` — when story insights become available

Webhook URL must be HTTPS, respond to verification challenge.

## Locations API

### Search for Location
```
GET /search?type=place&q={query}&fields=name,location
```
Or use Facebook Places:
```
GET /search?type=place&center={lat},{lng}&distance=1000
```

### Attach Location to Post
Include `location_id` in the media container creation call. Location tags improve local discoverability.

## Promoted Posts (Boosting)

### Create a Promoted Post from Existing Media
```
POST /act_{ad-account-id}/adcreatives
  object_story_id={page-id}_{media-id}
  name={internal-name}
```

### Create Ad Set (Budget + Targeting)
```
POST /act_{ad-account-id}/adsets
  name={name}
  campaign_id={campaign-id}
  daily_budget={cents}  // e.g. 1000 = $10/day
  billing_event=IMPRESSIONS
  optimization_goal=POST_ENGAGEMENT
  targeting={targeting-spec}
  start_time={iso-datetime}
  end_time={iso-datetime}
  status=PAUSED  // set to ACTIVE to start
```

### Quick Boost (Simplified)
For simple boosts, use the Page Post Promotions endpoint:
```
POST /{page-post-id}/promotions
  budget={total-budget-cents}
  duration={days}
  audience={targeting-spec-or-automatic}
```
This creates a campaign, ad set, and ad in one call.

### Targeting Spec (Basic)
```json
{
  "geo_locations": { "countries": ["AU"] },
  "age_min": 25,
  "age_max": 55,
  "interests": [{ "id": "6003139266461", "name": "Small business" }]
}
```

For lookalike audiences (v1.1):
```
POST /act_{ad-account-id}/customaudiences
  subtype=LOOKALIKE
  origin_audience_id={source-audience-id}
  lookalike_spec={"type":"similarity","country":"AU"}
```
