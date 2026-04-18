# Content Engine — Email Templates

**Surface:** System emails for Content Engine notifications and lifecycle. **Spec:** `docs/specs/content-engine.md` §10.1 (sprinkle claim — system email subject lines), §16. **Author:** Claude (CMS-3). All emails route through `sendEmail()` gate, `classification: 'transactional'`.

Voice: dry for subject lines, clear and warm for bodies. No corporate. No exclamation marks. Sign-off: "SuperBad" (SaaS product emails, not "Andy").

---

## Conventions

- **From name:** `SuperBad Content Engine`
- **From address:** `content@{subscriberDomain}` when domain verified, fallback `content@superbadmedia.com.au`
- **Sign-off:** `SuperBad` (Playfair italic, same as QB SaaS convention from CMS-2)
- **Footer:** `SuperBad Marketing · Melbourne` + unsubscribe link on newsletters, manage preferences link on transactional
- **Threading:** `In-Reply-To` / `References` headers for reply chains
- **Subject line voice:** dry, lowercase-feeling even in title case. Pool of variants per email type — random pick per send.

---

## Draft ready for review

Triggered when a new blog post draft enters `in_review` status.

**Subject pool:**
- `New draft ready`
- `Something to read`
- `Your engine wrote a post`

**Body:**

```
A new draft is in your review queue.

"{postTitle}"
{wordCount} words · targeting "{keyword}"

Read it, approve it, or tell us what's wrong with it.

[Review now →]

SuperBad
```

---

## Post published

Triggered on approval → publish.

**Subject pool:**
- `Published`
- `It's live`
- `New post at {domain}`

**Body:**

```
"{postTitle}" is live.

{publishedUrl}

Newsletter and social drafts are generating in the background.
They'll be ready by the time you finish reading this.

SuperBad
```

---

## Newsletter sent

Triggered after newsletter send completes.

**Subject pool:**
- `Newsletter sent`
- `Sent to {recipientCount} people`
- `{recipientCount} inboxes, one email`

**Body:**

```
Your newsletter went out.

{recipientCount} recipients · {postCount} post{s} included
Sent from {senderDomain}

Open rate and click data appear in your metrics over the next 48 hours.

SuperBad
```

---

## Domain verification reminder

Triggered on day 3, day 7, then weekly for up to 4 total sends. Stops permanently on verification.

**Subject:** `Your domain's not verified yet`

**Body:**

```
The engine's ready to publish, but your blog domain isn't set up yet.

Without DNS verification:
- Blog posts can't go live on your domain
- Newsletters can't send from your address
- The embeddable form won't work

It's a one-time setup. Takes about 10 minutes if you have DNS access,
or forward this to whoever manages your domain.

[Finish domain setup →]

SuperBad
```

---

## List milestone

Triggered at 100, 500, 1,000, 5,000, 10,000 subscribers. Claimed sprinkle from §10.1.

**Subject pools per milestone:**

| Milestone | Pool |
|-----------|------|
| 100 | `100 subscribers. Real ones.` · `Triple digits.` |
| 500 | `500. Not bad for autopilot.` · `Half a thousand.` |
| 1,000 | `1,000 subscribers.` · `Four digits.` |
| 5,000 | `5,000. The engine earns its keep.` · `Five thousand.` |
| 10,000 | `10,000.` · `Ten thousand people who opted in.` |

**Body (shared template, all milestones):**

```
Your newsletter list hit {milestone}.

Every one of them opted in. No bought lists, no gimmicks,
no "download our free PDF" gates. They read something you published
and wanted more.

The engine keeps writing, they keep reading.

SuperBad
```

---

## Permission pass (CSV import confirmation)

Triggered for each contact in a CSV import. Must click to confirm opt-in.

**Subject:** `Confirm your subscription to {businessName}`

**Body:**

```
{businessName} added you to their newsletter list.

Before we send you anything, we need a yes from you.

[Yes, subscribe me →]

If you didn't expect this, ignore this email. You won't hear from us again.

SuperBad
```

**Consent tracking:** `consent_source: 'permission_pass'`, `consented_at` = click timestamp.

---

## Bounce removal notice (admin-only, not sent to bounced address)

Logged to activity, visible in admin fleet overview. Not an email — an activity log entry.

- **Activity log message template:** `{email} removed from {businessName}'s list — {reason} ({bounceCount} bounce{es} / unsubscribed / 90-day inactive)`

---

## Weekly research summary (admin — SuperBad's own engine only)

Optional admin-only email, not subscriber-facing. Summarises the weekly keyword research run.

**Subject:** `Content research: {newTopicCount} new topics`

**Body:**

```
Weekly research complete.

{newTopicCount} new topics added to the queue
{totalQueuedCount} topics waiting
{nextDraftDueDescription}

Top keyword this week: "{topKeyword}" (rankability {score}/100)

[View queue →]

SuperBad
```

---

## Voice register notes (for Phase 5 build sessions + G10.5 reviewer)

- Subject lines are lowercase-feeling. "New draft ready" not "New Draft Ready!" or "Your New Blog Post is Ready for Review".
- Bodies are scannable: short lines, generous whitespace. Email clients butcher long paragraphs.
- The milestone emails are the most voiced — they're celebratory but in the dry register. "Real ones." does more than "Congratulations on reaching 100 subscribers!"
- Permission pass email is deliberately neutral — it's not SuperBad's voice moment, it's a compliance mechanism. Clear, not clever.
- No "unsubscribe" link on transactional emails (draft-ready, published, domain reminder). Manage-preferences link instead.
- Newsletter sends DO include unsubscribe per Spam Act.
