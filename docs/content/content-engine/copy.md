# Content Engine — Copy

**Surface:** Content Engine admin + subscriber portal surfaces. **Spec:** `docs/specs/content-engine.md` §10, §16. **Author:** Claude (CMS-3). Voice register: dry, observational, slow burn. No "synergy", "leverage", "solutions". Never "SuperBad Lite" on subscriber-facing surfaces.

---

## Loading states

Per Andy's direction: dry observation for generation steps (heavier work earns more voice), deadpan terse for mechanical steps.

### Generation steps (dry observation)

| Step | Pool (random pick per occurrence) |
|------|------|
| Researching keywords | "reading what your competitors forgot to write about." · "finding the gaps. there are always gaps." · "asking the internet what people actually search for." |
| Writing your post | "writing {wordCount} words about {vertical}. the things we do." · "drafting something that sounds like you. not like a committee." · "turning an outline into something worth reading." |
| Generating newsletter | "rewriting your post for people who read email at 7am." · "making it scannable. nobody reads the whole thing first." · "condensing. the newsletter version is always better." |
| Creating visuals | "designing something that doesn't look like a stock photo." · "picking colours from your Brand DNA. they picked themselves, really." · "rendering. the Puppeteer is earning its keep." |
| Generating social drafts | "writing the same thing four different ways for four different platforms." · "deciding whether this is a carousel or a single. Claude's call." · "adapting. Instagram and LinkedIn want different things." |

### Mechanical steps (deadpan terse)

| Step | Copy (static, not pooled) |
|------|------|
| Publishing | "publishing." |
| Sending newsletter | "sending." |
| Saving | "saving." |
| Scheduling | "scheduled." |
| Importing contacts | "importing." |
| Verifying domain | "checking DNS." |
| Fetching ranking data | "checking your position." |

---

## Empty states

All rendered via `generateInVoice()` with these as calibration briefs. The generated copy must match this register — dry, not apologetic, not encouraging.

### No drafts yet

- **Heading:** `Nothing to review.`
- **Body:** `The engine's either still researching or you've already approved everything. Either way, you're ahead.`

### No topics in queue

- **Heading:** `The queue's empty.`
- **Body:** `Research runs weekly. Next batch lands {nextResearchDate}. The engine picks better when it's not rushed.`

### No published posts

- **Heading:** `Nothing published yet.`
- **Body:** `Approve a draft and it goes live. The engine does the rest — SEO, newsletter, social. You just say yes.`

### No social drafts

- **Heading:** `No social content yet.`
- **Body:** `Social drafts generate automatically when you approve a blog post. Approve one and this fills itself.`

### No subscribers (newsletter list)

- **Heading:** `No one on the list yet.`
- **Body:** `Import a CSV, drop the embed form on your site, or wait for the blog CTAs to do their thing. Three channels, all automatic once they're running.`

### No ranking data

- **Heading:** `No ranking data yet.`
- **Body:** `Snapshots start a week after your first post publishes. Google needs time. So does everyone.`

### No metrics

- **Heading:** `Nothing to measure yet.`
- **Body:** `Metrics appear once you've published and sent. The numbers need something to count.`

### Review queue — all caught up

- **Heading:** `All caught up.`
- **Body:** `Nothing waiting for your approval. The engine's working on the next one.`

---

## Fleet overview labels (admin — `/lite/content/subscribers`)

### Summary cards

- **Total active subscribers:** `{count} active`
- **Posts published this month:** `{count} published this month`
- **Aggregate list size:** `{count} newsletter subscribers across all engines`
- **Unreviewed drafts (churn signal):** `{count} drafts waiting` (red accent if > 0)

### Subscriber row status badges

| Status | Label | Colour hint |
|--------|-------|-------------|
| Healthy | `healthy` | muted green |
| Draft waiting | `draft waiting` | amber |
| Draft waiting > 48h | `draft stale` | red — churn signal |
| Domain not verified | `domain pending` | amber |
| List declining | `list shrinking` | red |
| Engine paused (subscription issue) | `paused` | grey |

### Fleet empty state

- **Heading:** `No subscribers yet.`
- **Body:** `When someone signs up for the Content Engine, they'll appear here. You'll see engine health, post counts, list sizes — the fleet at a glance.`

---

## Notification copy

All notifications routed through `sendEmail()` gate with `classification: 'transactional'`.

### Draft ready for review

- **Subject pool:** "new draft ready." · "something to read." · "your engine wrote a post."
- **Body lead:** `A new draft is ready for your review: "{postTitle}". Read it, approve it, or tell us what's wrong with it.`
- **CTA:** `Review now`

### Post published

- **Subject pool:** "published." · "it's live." · "new post at {domain}/blog/{slug}."
- **Body lead:** `"{postTitle}" is live at {url}. Newsletter and social drafts are generating in the background.`

### Newsletter sent

- **Subject pool:** "newsletter sent." · "sent to {recipientCount} people." · "{recipientCount} inboxes, one email."
- **Body lead:** `Your newsletter went out to {recipientCount} subscribers. Open rate and click data will appear in your metrics over the next 48 hours.`

### Domain verification incomplete (persistent gentle nudge)

- **Subject:** "your domain's not verified yet."
- **Body lead:** `The engine's ready to publish, but your domain DNS isn't set up yet. Until it is, blog posts can't go live on your site.`
- **CTA:** `Finish domain setup`
- **Cadence:** once on day 3, once on day 7, then weekly until verified. Stops after 4 sends. Does not resurface after completion.

### List milestone (sprinkle — §10.1 claimed)

- **Subject pool (at 100):** "100 subscribers. real ones." · "triple digits."
- **Subject pool (at 500):** "500. not bad for autopilot." · "half a thousand."
- **Subject pool (at 1,000):** "1,000 subscribers." · "four digits."
- **Subject pool (at 5,000):** "5,000. the engine earns its keep." · "five thousand."
- **Subject pool (at 10,000):** "10,000." · "ten thousand people who opted in."
- **Body template:** `Your newsletter list hit {milestone}. Every one of them opted in — no bought lists, no gimmicks. The engine keeps writing, they keep reading.`

---

## Cockpit integration signals

### Andy's own content

- **Unreviewed drafts:** `{count} Content Engine draft{s} waiting for review`
- **Next newsletter:** `Next newsletter scheduled {date} at {time}`
- **Ranking milestone — entered top 10:** `"{postTitle}" entered the top 10 for "{keyword}"`
- **Ranking milestone — hit #1:** `"{postTitle}" hit #1 for "{keyword}"`

### Fleet signals

- **Drafts waiting > 48h:** `{count} subscriber{s} with stale drafts (48h+)`
- **Domain verification failures:** `{count} subscriber{s} with unverified domains`
- **List health alerts:** `{count} subscriber{s} with declining list health`

---

## Browser tab titles

Static rotation per page, not dynamic.

| Page | Pool |
|------|------|
| `/lite/content` (Review tab) | "Content Engine — Review" · "SuperBad — what's waiting" |
| `/lite/content` (Social tab) | "Content Engine — Social" · "SuperBad — social drafts" |
| `/lite/content` (Metrics tab) | "Content Engine — Metrics" · "SuperBad — the numbers" |
| `/lite/content` (Topics tab) | "Content Engine — Topics" · "SuperBad — the queue" |
| `/lite/content` (List tab) | "Content Engine — List" · "SuperBad — subscribers" |
| `/lite/content/subscribers` | "Content Engine — Fleet" · "SuperBad — all engines" |
| Portal — Review | "Review — SuperBad" |
| Portal — Social | "Social — SuperBad" |
| Portal — Metrics | "How it's going — SuperBad" |
| Portal — Topics | "What's next — SuperBad" |
| Portal — List | "Your list — SuperBad" |

---

## Topic queue affordances

### Veto button

- **Label:** `Skip this one`
- **Confirmation:** none — single click, immediate. Undo available for 5 seconds.
- **Undo toast:** `Skipped. Undo?`

### Topic Strategy panel (optional, engaged subscribers)

- **Panel heading:** `Seed keywords`
- **Add keyword input placeholder:** `Add a topic seed`
- **Helper text:** `These steer future research. The engine uses them alongside what it learns from your Brand DNA and ranking data.`
- **Empty state:** `No seed keywords yet. The engine derives topics from your Brand DNA. Add seeds here to influence what it writes about.`

### Outline preview (in topic queue)

- **Sections label:** `Outline`
- **Word count label:** `~{wordCount} words`
- **Snippet flag (if featured snippet opportunity):** `snippet opportunity`
