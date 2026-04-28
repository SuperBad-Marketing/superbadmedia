# Instagram Competitive Strategy Engine

> Brainstorm locked: 2026-04-28. Owner: Andy Robinson.
> Extends: `instagram-channel.md` (§6 strategy engine), `instagram-strategy-plans.md` (plan slots + UI).

Competitive intelligence layer for Instagram strategy. Scrapes high-performing posts from hand-picked accounts via Apify, scores them by relative engagement, surfaces them as an inspiration feed with like/dislike filtering, and feeds liked posts into a granular weekly strategy that produces step-by-step post briefs — not vague direction. Solves the cold-start problem (no existing posts or metrics required). Replaces the "First digest generates after one week of data" empty state with a "Generate Strategy" button that works from day one.

---

## §1 Watched Accounts

### §1.1 What They Are
A curated list of Instagram accounts Andy wants to track for competitive intelligence. Not competitors in the threat sense — inspiration sources whose content, tone, or engagement patterns are worth studying.

### §1.2 Where They Live
Settings page: `/lite/admin/settings/instagram` (new section: "Watched Accounts").
- Simple list of Instagram handles with add/remove
- Each entry shows: username, follower count (populated on first scrape), last scraped date, post count scraped
- Target: 8–10 accounts. Platform warns above 15 (scraping cost and signal dilution)

### §1.3 Account Types to Watch
Three categories, roughly equal:

**Photography-led small agencies (3–4 accounts)**
Solo or tiny-team operators who shoot for businesses and use Instagram as their primary growth channel. 2k–30k followers. Direct tactical reference for content types, posting cadence, and hooks that work at SuperBad's scale.

**Content-forward marketing agencies (3–4 accounts)**
Slightly bigger operations (30k–200k followers) known for strong organic game. High save rates. Mix of educational, behind-the-scenes, and personality-driven posts. Shows what "done well one tier up" looks like.

**Wildcard tone matches (2–3 accounts)**
Not agencies at all. Brands or creators whose tone matches SuperBad's dry, observational voice — even if they're in a completely different industry. Keeps the strategy from becoming generic marketing advice.

### §1.4 Discovery Assist (v1.1)
On first setup, Andy provides 2–3 accounts he already follows and respects. Platform uses Apify to analyse their followers and tagged accounts, then suggests similar accounts as watch candidates. Not required for v1 — Andy adds handles manually.

---

## §2 Apify Scraping

### §2.1 New Actor
Add `apify.instagram_profile` to the Apify vendor manifest:
- **Input:** Instagram username
- **Output:** Profile data (username, followers, following, bio, profile pic URL) + last 50 posts (image URL, caption, likes, comments, timestamp, media type, permalink)
- **Band:** p95: 45s, p99: 70s
- **Cost estimate:** ~$0.05 AUD per profile scrape

### §2.2 Weekly Scrape Cadence
Sunday 06:00 AEST — runs before the 18:00 plan generation so results are fresh.

For each watched account:
1. Run `apify.instagram_profile` actor via existing `apify-runner.ts` pattern
2. Parse results into `instagram_competitor_posts` rows
3. Download top-scoring post images → upload to Cloudinary (`superbad/competitive-intel/{username}/`) for reliable in-platform display
4. Calculate performance scores (§3)
5. Surface top 10–15 posts across all watched accounts in the inspiration feed

### §2.3 Manual Scrape
"Refresh now" button on the Watched Accounts settings page triggers an immediate scrape of all watched accounts. Also triggered on first "Generate Strategy" click if no scrape data exists.

### §2.4 Image Caching
Instagram CDN URLs expire. Every surfaced post's image is cached to Cloudinary on scrape. The `instagram_competitor_posts` row stores the Cloudinary URL, not the Instagram CDN URL. Cloudinary folder: `superbad/competitive-intel/`.

---

## §3 Performance Scoring

### §3.1 Per-Post Engagement Rate
```
post_er = (likes + comments) / account_followers
```
Saves and shares aren't available via public scraping — score on publicly visible metrics only.

### §3.2 Account Baseline
```
account_avg_er = mean(post_er for all scraped posts from this account)
```
Calculated per scrape from the last 50 posts.

### §3.3 Performance Multiplier
```
performance_score = post_er / account_avg_er
```
A score of 1.0 = average for that account. The multiplier is what matters, not the absolute engagement rate.

### §3.4 Recency Weighting
```
recency_weight = 1.0  if post_age < 7 days
               = 0.9  if post_age 7–14 days
               = 0.7  if post_age 14–30 days
               = 0.5  if post_age > 30 days

final_score = performance_score × recency_weight
```

### §3.5 Thresholds
| Final Score | Classification | Surfaced? |
|---|---|---|
| ≥ 3.0 | Exceptional | Always |
| ≥ 2.0 | Strong | Yes |
| ≥ 1.5 | Above average | Only if < 10 higher scorers |
| < 1.5 | Average or below | Never |

### §3.6 Weekly Surface Cap
Top 10–15 posts across all watched accounts. Enough to give variety without overwhelming the feed.

---

## §4 Inspiration Feed

### §4.1 Where It Lives
New section on the Instagram dashboard (`/lite/content/instagram`), below the "Your Next Posts" section (§6). Collapsible, open by default when posts are awaiting reaction.

### §4.2 Card Layout
Compact grid: 2 columns on desktop (not 3–4 — needs room for metrics without getting cramped).

Each card:
- **Post image** (from Cloudinary cache, not Instagram CDN)
- **Account name** + follower count badge (small, muted)
- **Performance multiplier badge** — e.g. "3.2× avg" in accent colour
- **Content type indicator** — carousel / single / reel icon
- **Like / Dislike buttons** — prominent, one tap. Heart / X pattern.

### §4.3 Card Expansion
Click a card to expand (inline, not a modal):
- Full caption text
- Detailed metrics: likes, comments, engagement rate, performance multiplier
- **"Why this scored high"** — one-sentence LLM-generated explanation (Haiku, generated at scrape time and cached). E.g. "Carousel with a strong opening hook — 4.1× the account's average engagement, driven by comments."
- **Content type + format breakdown** — what made this post structurally (carousel with X slides, reel at Y seconds, etc.)
- Link to original post on Instagram (external link icon, opens in new tab)

### §4.4 Like / Dislike Behaviour
- **Like:** card gets a subtle accent border. Post feeds into this week's strategy generation.
- **Dislike:** card dims to 30% opacity. Post is excluded from strategy generation. Still visible (Andy might change his mind) but clearly dismissed.
- **No reaction:** post is excluded from strategy generation. Only explicitly liked posts influence the plan. Safe default.
- Reactions are stored permanently and feed taste learning (§5).

### ��4.5 Filter Bar
Above the grid: "All" / "Liked" / "Undecided" / "Dismissed" tabs. Default: "All".

---

## §5 Taste Learning

### §5.1 Signal Extraction
After 20+ reactions, the platform has enough signal to extract taste patterns. A Haiku call analyses the liked vs. disliked posts and extracts:
- Preferred content types (carousel vs. single vs. reel)
- Preferred visual styles (clean/minimal vs. busy/layered)
- Preferred tone (dry/observational vs. educational vs. hype)
- Preferred topics (behind-the-scenes, tips, portfolio, personal)
- Anti-patterns (what Andy consistently dislikes)

Stored as `taste_profile_json` on a new `instagram_taste_profiles` table, regenerated weekly after the scrape.

### §5.2 Pre-Scoring
Once a taste profile exists, newly scraped posts get a **taste alignment score** (0–1) in addition to the performance score. Posts that match Andy's demonstrated preferences bubble up higher in the inspiration feed. Posts that match known anti-patterns get a subtle "might not be your style" indicator but are still shown (the platform doesn't hide things — Andy always has the final say).

### §5.3 Strategy Influence
The taste profile is injected into the strategy generation prompt (§7) alongside liked posts. It steers content recommendations toward formats and tones Andy has consistently approved.

---

## §6 Enhanced Post Briefs — "Your Next Posts"

### §6.1 What Changed
The existing `ContentPlanSlot` (from `instagram-strategy-plans.md` §4) becomes richer. Instead of a topic + caption direction, each slot is a complete creation brief with step-by-step instructions.

### §6.2 Extended Slot Schema
```typescript
interface EnhancedContentPlanSlot {
  index: number;
  suggested_date: string;
  day_of_week: string;
  content_type: "carousel" | "single" | "reel" | "story";
  topic: string;
  caption_direction: string;
  creation_steps: Array<{
    step: number;
    instruction: string;
    is_manual: boolean;
  }>;
  requires_manual_input: boolean;
  manual_input_description: string | null;
  status: "pending" | "approved" | "created" | "posted";
  task_id: string | null;
  ig_media_id: string | null;
  inspiration_post_ids: string[];
  estimated_minutes: number;
}
```

**New fields:**
- `creation_steps` — ordered step-by-step instructions. Each step flags whether it needs manual input (`is_manual: true` for "Record a 30–60s talking head video about X") or can be done in Content Studio (`is_manual: false` for "Create a carousel in Studio using the Editorial layout").
- `requires_manual_input` — derived: `true` if any step has `is_manual: true`. Determines the card's lead time and visual treatment.
- `manual_input_description` — plain-English summary of what Andy needs to do himself. E.g. "Record a short video at your desk talking about why most marketing advice is garbage."
- `status` — replaces `approved: boolean`. Four states: pending → approved → created → posted.
- `ig_media_id` — set when the post is published to Instagram. Links to `instagram_media` row.
- `inspiration_post_ids` — which liked competitor posts informed this brief. Shown as "Inspired by" links on the card.
- `estimated_minutes` — rough creation time. Studio-only posts: 10–20 min. Manual input: 30–90 min.

### §6.3 Backward Compatibility
Existing plans with the old slot format (using `approved: boolean`) are read as: `approved: true` → `status: "approved"`, `approved: false` → `status: "pending"`. Missing fields default to empty arrays / null / false.

### §6.4 "Your Next Posts" UI
Primary section on the Instagram dashboard, above the Inspiration feed.

**Card list (not a grid — sequential, numbered):**
Each post is a card showing:
- **Number** (1–5) + **content type badge** (carousel / single / reel / story)
- **Topic headline** — one line, the hook
- **Due date** + **days remaining** countdown
- **Status pill:** grey (pending) → amber (approved) → blue (created) → green (posted)
- **Manual input indicator** — if `requires_manual_input`, a camera/mic icon and short description visible on the card face
- **"Inspired by" thumbnails** — tiny circular images of the liked competitor posts that informed this brief (max 3, with +N overflow)

**Card expansion (click to open):**
- Full creation steps as a numbered checklist
- Each step shows its instruction + manual/studio badge
- Caption direction
- "Create in Studio" button (for studio-only content types)
- "Mark as Created" button (for manual input posts — Andy confirms he's done the recording/shooting)
- "Post to Instagram" button (only appears when status = "created")

### §6.5 Lead Time Assignment
Due dates assigned by the strategy generator based on complexity:
- **Studio-only posts** (`requires_manual_input: false`): 1–2 day lead time. Scheduled toward end of week.
- **Manual input posts** (`requires_manual_input: true`): 4–5 day lead time. Scheduled toward start of week so Andy has runway.
- Posts naturally sort with harder stuff first, quick wins last.

---

## §7 Strategy Generation

### §7.1 Inputs
The strategy LLM call (Sonnet, `instagram-competitive-strategy` job slug) receives:

**Always available (cold-start safe):**
- Brand DNA profile (tags + prose portrait + first impression)
- Liked inspiration posts from the current scrape cycle (images described, captions, metrics, why they scored high)
- Taste profile (if 20+ reactions exist)
- Braindump content ideas from the last 14 days (content categories + script pillars from `parse-braindump.ts`)
- Mood/energy signal from latest braindump (when braindump learning system exists — separate spec)
- Account basic info (username, follower count, bio)

**Available after first week of own data:**
- Own metrics (follower growth, engagement trends, per-post performance)
- Content type breakdown (which types performed best for SuperBad)
- Audience data (demographics, active hours)
- Previous strategy's recommendations + whether they were followed

### §7.2 Output
The LLM generates:
1. **Week theme** — one sentence framing the week's content direction
2. **5 post briefs** — each with: topic, caption direction, content type, creation steps, manual input flag, estimated minutes, inspiration references
3. **Strategic rationale** — 2–3 sentences explaining why these 5 posts, in this order, with these formats. References liked inspiration and Brand DNA.
4. **Posting schedule** — suggested dates with lead time logic applied

### §7.3 Cold-Start Mode
When no own-metrics data exists (first use, or < 7 days of data):
- Strategy relies entirely on competitive intelligence + Brand DNA + braindump content ideas
- LLM prompt explicitly states this is a cold-start and should recommend a diagnostic mix of content types to establish baseline performance data
- First plan includes at least one of each: carousel, single, and reel — to gather engagement data across formats

### §7.4 Weekly Refresh
Every Sunday at 18:00 AEST (same trigger as existing plan generation):
1. Read latest scrape results (from 06:00 scrape)
2. Read liked inspiration posts
3. Read own-metrics if available
4. Read taste profile if available
5. Read braindump content ideas from last 14 days
6. Generate strategy + 5 post briefs
7. Store as `instagram_strategy_reports` row (report_type: "weekly_digest")
8. Create `instagram_content_plans` row with enhanced slots
9. Auto-create tasks for each slot (see §8)

### §7.5 Manual "Generate Strategy" Button
Appears on the Instagram dashboard when:
- No current-week plan exists, OR
- Andy wants to regenerate (replaces the current plan after confirmation)

Triggers the same flow as §7.4 but immediately. If no scrape data exists, triggers a scrape first (§2.3).

---

## §8 Task Integration

### ��8.1 Auto-Created Tasks
When a plan is generated, tasks are created automatically for each slot (not waiting for manual approval — the plan IS the approval surface now). Tasks use the existing task creation pattern:
- **Title:** "Instagram: {topic}"
- **Body:** caption direction + content type + creation steps summary
- **Kind:** `admin`
- **Status:** `todo`
- **Priority:** `normal` (manual input posts) or `low` (studio-only posts)
- **Due date:** from the slot's `suggested_date`
- **Meta:** `source_plan_id`, `source_slot_index`

### §8.2 Bidirectional Status Sync
- **Task completed → slot status "created":** When Andy marks a task as done in the task list, the linked slot's status updates to "created". The post card on the Instagram dashboard reflects this.
- **Slot "posted" → task archived:** When Andy posts to Instagram from the post card, the linked task auto-archives with a note: "Posted to Instagram on {date}".
- **Task deleted → slot reverts to "pending":** If Andy deletes a task, the slot's `task_id` clears and status reverts. A new task can be created.

### §8.3 Slot Status Machine
```
pending → approved → created → posted
                  ↑        ↑
            (task created) (task completed)
```
- `pending`: plan generated, task created, not started
- `approved`: Andy has reviewed and confirmed the brief (optional — tasks exist either way, but approval signals intent)
- `created`: content exists (task marked done, or "Mark as Created" clicked on the card)
- `posted`: published to Instagram ("Post to Instagram" button clicked and API call succeeded)

---

## §9 Data Model — New Tables

### §9.1 `instagram_watched_accounts`
```
id                  TEXT PK
username            TEXT NOT NULL UNIQUE
display_name        TEXT
category            TEXT ("photography_agency" | "content_agency" | "wildcard")
followers           INTEGER
bio                 TEXT
profile_pic_url     TEXT (Cloudinary cached)
last_scraped_at_ms  INTEGER
posts_scraped       INTEGER DEFAULT 0
avg_engagement_rate REAL
added_at_ms         INTEGER NOT NULL
status              TEXT NOT NULL DEFAULT "active" ("active" | "paused" | "removed")
```

### §9.2 `instagram_competitor_posts`
```
id                  TEXT PK
watched_account_id  TEXT FK → instagram_watched_accounts.id NOT NULL
ig_permalink        TEXT
media_type          TEXT ("IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL")
caption             TEXT
image_url           TEXT NOT NULL (Cloudinary cached URL)
likes               INTEGER NOT NULL
comments            INTEGER NOT NULL
post_er             REAL NOT NULL (engagement rate for this post)
performance_score   REAL NOT NULL (multiplier vs account baseline)
recency_weight      REAL NOT NULL
final_score         REAL NOT NULL (performance_score × recency_weight)
why_high            TEXT (Haiku-generated one-sentence explanation, nullable)
published_at_ms     INTEGER NOT NULL
scraped_at_ms       INTEGER NOT NULL
```

### §9.3 `instagram_inspiration_reactions`
```
id                  TEXT PK
competitor_post_id  TEXT FK → instagram_competitor_posts.id NOT NULL
reaction            TEXT NOT NULL ("like" | "dislike")
reacted_at_ms       INTEGER NOT NULL
```
Unique constraint on `competitor_post_id` — one reaction per post (latest wins on change).

### §9.4 `instagram_taste_profiles`
```
id                  TEXT PK
generated_at_ms     INTEGER NOT NULL
reaction_count      INTEGER NOT NULL (how many reactions informed this profile)
preferred_types_json     TEXT (JSON — e.g. {"carousel": 0.6, "reel": 0.3, "single": 0.1})
preferred_styles_json    TEXT (JSON — e.g. {"minimal": 0.7, "bold_typography": 0.5})
preferred_topics_json    TEXT (JSON — e.g. {"behind_the_scenes": 0.8, "tips": 0.4})
anti_patterns_json       TEXT (JSON — e.g. ["busy_infographics", "emoji_heavy_captions"])
raw_analysis_text        TEXT (Haiku's full analysis, for debugging)
```

### §9.5 `ContentPlanSlot` Extension
See §6.2. The `slots_json` column in `instagram_content_plans` now stores `EnhancedContentPlanSlot[]`. Backward-compatible — old format reads with defaults.

---

## §10 LLM Registry Entries

```
instagram-competitive-strategy    sonnet    Strategy generation from competitive intel + Brand DNA + braindump ideas
instagram-post-why-high           haiku     One-sentence explanation of why a competitor post scored high
instagram-taste-analysis          haiku     Extract taste patterns from like/dislike history
```

---

## §11 Apify Manifest Addition

Add to `lib/integrations/vendors/apify.ts`:
```typescript
{
  name: "apify.instagram_profile",
  defaultBand: { p95: 45000, p99: 70000 },
  unit: "ms",
}
```

---

## §12 Settings Keys

```
instagram.competitive.scrape_enabled              = true
instagram.competitive.scrape_day                   = "sunday"
instagram.competitive.scrape_hour_local            = 6
instagram.competitive.max_watched_accounts         = 15
instagram.competitive.max_posts_surfaced           = 15
instagram.competitive.performance_threshold        = 1.5
instagram.competitive.exceptional_threshold        = 3.0
instagram.competitive.taste_profile_min_reactions  = 20
instagram.strategy.cold_start_enabled              = true
instagram.strategy.auto_create_tasks               = true
instagram.strategy.manual_input_lead_days          = 5
instagram.strategy.studio_only_lead_days           = 2
```

---

## §13 Activity Log Kinds

Add to `ACTIVITY_LOG_KINDS`:
```
"instagram_competitive_scrape_completed"
"instagram_inspiration_liked"
"instagram_inspiration_disliked"
"instagram_taste_profile_generated"
"instagram_cold_start_strategy_generated"
"instagram_post_published"
```

---

## §14 Cross-Spec Impacts

- **`instagram-channel.md` §6:** Strategy digest generation now includes competitive intelligence as an input source. The `instagram-strategy-digest` job slug is supplemented by `instagram-competitive-strategy` for plans that use competitive intel. Cold-start mode bypasses the "needs 7 days of metrics" requirement.
- **`instagram-strategy-plans.md` §4:** `ContentPlanSlot` extended to `EnhancedContentPlanSlot`. Status model changes from `approved: boolean` to four-state enum. Plan card UI updated to show creation steps and status progression.
- **`instagram-strategy-plans.md` §6:** Approval flow changes — tasks auto-create on plan generation, not on manual approval. Approval becomes a review/confirmation step, not a task-creation trigger.
- **`instagram-strategy-plans.md` §3.1:** Plan card replaced by "Your Next Posts" card list (§6.4).
- **`daily-cockpit.md`:** Cockpit attention rail source `instagram_plan` updated to reflect new status model. "X posts to create this week" instead of "plan awaiting review".
- **`task-manager.md`:** Bidirectional sync between tasks and plan slots (§8.2). Task completion triggers slot status change.
- **`lib/integrations/vendors/apify.ts`:** New `apify.instagram_profile` actor entry.

---

## §15 Build Order

1. **Schema:** new tables (`instagram_watched_accounts`, `instagram_competitor_posts`, `instagram_inspiration_reactions`, `instagram_taste_profiles`) + migration
2. **Apify actor:** add `apify.instagram_profile` to vendor manifest + scraper implementation in `lib/channels/instagram/competitive-scrape.ts`
3. **Performance scoring:** `lib/channels/instagram/score-posts.ts` — scoring logic from §3
4. **Cloudinary image caching:** download + upload pipeline for competitor post images
5. **Watched Accounts UI:** settings page section — add/remove handles, display scrape status
6. **Inspiration Feed UI:** grid cards with like/dislike, expansion, filter bar
7. **"Generate Strategy" button:** cold-start trigger on Instagram dashboard
8. **Strategy generation LLM:** `instagram-competitive-strategy` prompt template, cold-start + ongoing modes
9. **Enhanced plan slots:** extend `ContentPlanSlot` interface, backward-compat reader
10. **"Your Next Posts" UI:** card list with creation steps, status progression, manual input indicators
11. **Task auto-creation:** create tasks on plan generation
12. **Bidirectional task sync:** task completion ↔ slot status
13. **"Post to Instagram" on cards:** publish action that updates slot to "posted"
14. **Taste learning:** Haiku analysis after 20+ reactions, taste profile storage, pre-scoring
15. **Weekly cadence wiring:** Sunday 06:00 scrape → 18:00 strategy generation with competitive intel

---

## §16 Success Criteria

1. "Generate Strategy" button works from day one with zero posts and zero metrics
2. Watched accounts are scrapeable and produce scored, image-cached posts
3. Inspiration feed shows top posts with working like/dislike
4. Only liked posts appear in the strategy generation prompt
5. 5-post plan contains step-by-step creation instructions, not vague direction
6. Manual-input posts have longer lead times and clear instructions for what Andy needs to do
7. Tasks auto-create with correct due dates and bidirectional status sync works
8. Completing a task marks the post card as "created"
9. "Post to Instagram" marks as "posted" and publishes via Instagram API
10. Taste profile generates after 20+ reactions and influences future inspiration ranking
11. Cold-start → first-week → ongoing transition is seamless (no manual switch)

---

## §17 Non-Goals

- Auto-posting without human review (every post goes through Content Studio or manual creation, then explicit "Post" action)
- Scraping private accounts (public profiles only)
- Copying competitor content (inspiration informs strategy direction, never copy or caption text)
- Replacing the existing strategy digest (this supplements it with competitive intelligence — the digest still runs for own-metrics analysis once data exists)
- Mood-aware task nudging (mood signal is an input to strategy generation only; full nudging system is a separate spec)
- AI-generated images from competitor inspiration (Content Studio is the creation surface)
