# Instagram Channel

**Status:** Brainstorm locked 2026-04-24
**Owner:** Andy
**Phase:** Post-v1.0 feature (build when Meta App Review clears)

## 1. What this is

Instagram account management inside Lite — metrics dashboard + AI-powered autonomous replies. First channel under a new "Channels" nav section. SuperBad's own account first, architected so client accounts slot in later without a rewrite.

## 2. Where it lives

- **Sidebar nav:** new "Channels" group, with "Instagram" as the first item
- **Route:** `/lite/admin/channels/instagram`
- **Future channels** (Facebook, email analytics, LinkedIn) sit alongside at `/lite/admin/channels/[channel]`

## 3. Metrics dashboard

### 3.1 Account growth (always visible)
- Follower count over time (line chart, 30/60/90 day toggle)
- Follows / unfollows per day
- Reach and impressions (daily, with trend)
- Profile visits

### 3.2 Content performance (always visible)
- Per-post card: thumbnail, engagement rate, saves, shares, comments
- Video posts: viewtime (total + average), retention curve if available
- Sortable by: date, engagement rate, reach, saves
- Best/worst performing posts highlighted

### 3.3 Audience insights (collapsed by default, toggle to expand)
- Age/gender distribution
- Top locations (city + country)
- Active hours (when followers are online)
- Collapsed state shows a one-line summary ("72% 25–44, mostly Melbourne")

### 3.4 Data freshness
- Three syncs per day aligned with cockpit brief slots: morning (~7am), midday (~12pm), evening (~6pm AEST)
- Each sync: ~15–20 API calls (account metrics, recent media list, individual media insights, stories)
- "Last synced" timestamp visible on dashboard
- No manual refresh button in v1 — syncs are frequent enough
- Reply polling runs on a separate, tighter loop (see §5.3)

## 4. Data model

### 4.1 `instagram_accounts` table
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

### 4.2 `instagram_metrics_snapshots` table
```
id                  text PK
account_id          text FK → instagram_accounts.id
snapshot_date       text NOT NULL (YYYY-MM-DD)
followers           integer
follows             integer
reach               integer
impressions         integer
profile_views       integer
synced_at_ms        integer NOT NULL
```

### 4.3 `instagram_media` table
```
id                  text PK
account_id          text FK → instagram_accounts.id
ig_media_id         text NOT NULL (Meta's media ID)
media_type          text NOT NULL ("IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL" | "STORY")
caption             text
permalink           text
thumbnail_url       text
published_at_ms     integer NOT NULL
engagement_rate     real
likes               integer
comments_count      integer
saves               integer
shares              integer
reach               integer
impressions         integer
video_views         integer
video_avg_watch_ms  integer
last_synced_at_ms   integer NOT NULL
```

### 4.4 `instagram_audience_snapshots` table
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

### 4.5 `instagram_replies` table
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
feedback            text (Andy's optional note — "too stiff", etc.)
feedback_sentiment  text ("positive" | "negative" | null)
created_at_ms       integer NOT NULL
```

### 4.6 `instagram_voice_corrections` table
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

## 5. Reply system

### 5.1 Tiered autonomy
- **Draft mode** (default on connect): every reply goes to a review queue. Andy approves, edits, or skips.
- **Autonomous mode**: AI sends replies automatically. Andy reviews a log after the fact.
- Comments and DMs graduate independently — comments might hit autonomous first (lower stakes).
- Graduation trigger: when edit rate drops below 15% over the last 50 replies for that type.
- Andy can manually flip the mode at any time (override auto-graduation or revert to draft).

### 5.2 Voice registers
- **Comments (public):** SuperBad brand voice — dry, punchy, observational. Short. One sentence preferred. Never explains the joke. This is a performance.
- **DMs (private):** Bartender register — still has personality but warmer, more conversational. Can ask follow-up questions. Feels human, not like a brand account.
- Both registers are defined in prompt files under `lib/ai/prompts/instagram-channel/`.

### 5.3 Reply polling
- Poll for new comments and DMs every 2–3 minutes via scheduled task.
- Each poll: check recent media for new comments + check conversations for new messages.
- Rate limit budget: ~80 calls/hour reserved for reply operations (out of 200/hour total).
- New inbound → classify → draft reply → queue (draft mode) or send (autonomous mode).

### 5.4 Classification and routing
- Every inbound message gets classified: lead, complaint, collab, question, praise, spam, simple.
- **Simple** (thanks, emoji, basic "where are you based?"): auto-handled in both modes.
- **Lead**: auto-create deal in pipeline (company = Instagram username, stage = "lead", source = "instagram_dm"). Flag for Andy.
- **Complaint**: escalate immediately, no auto-reply. Flag as urgent.
- **Collab**: acknowledge with holding reply ("appreciate it — Andy will take a look"), escalate.
- **Spam**: archive silently, no reply.
- **Question / Praise**: draft reply as normal.

### 5.5 Training and correction loop
- **Automatic corrections**: when Andy edits a draft before approving, the (AI draft → Andy's version) pair is saved to `instagram_voice_corrections`.
- **Explicit feedback**: approve/skip buttons plus optional quick note field ("less exclamation marks", "wouldn't use emoji here").
- **Prompt integration**: the reply prompt includes the 20 most recent corrections as few-shot examples, filtered by reply type (comment vs DM).
- **Graduation metric**: `corrections in last 50 / 50 < 0.15` → suggest autonomous mode.

## 6. Meta API integration

### 6.1 Required permissions (Meta App Review)
- `instagram_basic` — account info, media
- `instagram_manage_comments` — read/reply to comments
- `instagram_manage_messages` — read/reply to DMs (requires Business verification)
- `instagram_content_publish` — not needed for v1 (no posting from Lite)
- `pages_show_list` + `pages_read_engagement` — required for Instagram Graph API access
- `business_management` — for future client account connections

### 6.2 Auth flow
- OAuth 2.0 via Meta Login
- Short-lived token → exchange for long-lived token (60 days)
- Scheduled task refreshes token before expiry (runs weekly)
- Token stored encrypted in `instagram_accounts.access_token`
- Disconnect flow: revoke token, set status to "disconnected", stop polling

### 6.3 API client
- Centralised in `lib/channels/instagram/client.ts`
- All calls logged to `external_call_log` (COB-1 pattern)
- Rate limit tracking: count calls per rolling hour, pause if approaching 200
- Retry with backoff on 429 responses

## 7. LLM model registry entries
- `instagram-classify-inbound`: haiku (classification)
- `instagram-draft-comment-reply`: sonnet (needs brand voice but fast)
- `instagram-draft-dm-reply`: sonnet (same)
- `instagram-escalation-summary`: haiku (internal note for Andy)

## 8. Cockpit integration
- Attention rail item when there are pending replies in draft mode ("3 Instagram replies waiting")
- Daily brief includes Instagram highlight if a post performed notably well or poorly
- Cockpit AI assistant gets two new tools: `get_instagram_metrics` and `list_pending_replies`

## 9. Future: client accounts (v1.1+)
- Each client connects their own Instagram via OAuth from the portal
- Brand DNA profile feeds the reply voice prompt (instead of hardcoded SuperBad voice)
- Client-specific metrics dashboard accessible from client detail page
- Separate correction logs per client account
- Client portal shows their own metrics (read-only, no reply management)
- `instagram_accounts.company_id` FK already supports this

## 10. Build order
1. Schema + migrations (tables from §4)
2. Meta OAuth flow + token management
3. Metrics sync scheduled task + dashboard UI
4. Reply polling + classification
5. Draft reply queue UI
6. Voice prompt + correction loop
7. Autonomous mode + graduation logic
8. Cockpit integrations (attention rail, brief, assistant tools)

## 11. Dependencies
- Meta App Review approval (1–4 week external dependency)
- Meta Business account linked to SuperBad's Instagram
- `INSTAGRAM_APP_ID` + `INSTAGRAM_APP_SECRET` env vars
- Sidebar nav: "Channels" section added
