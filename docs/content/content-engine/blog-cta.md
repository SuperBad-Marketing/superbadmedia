# Content Engine — Blog CTA Copy

**Surface:** Inline CTAs on Lite-hosted blog posts. **Spec:** `docs/specs/content-engine.md` §2.1 (Stage 5), §10.2, §16. **Author:** Claude (CMS-3).

---

## SuperBad's own blog CTA (claimed sprinkle — §10.1)

Appears inline at the bottom of every post published on `superbadmedia.com.au/blog/*`. One dry line acknowledging the Content Engine wrote it, linking to the demo page. The blog IS the product demo in action.

- **Line:** `This post was written by the SuperBad Content Engine. {demoLink}`
- **Link text:** `See what it would write about your business.`
- **Styling:** DM Sans, Retro Pink, small (14px equivalent). Inline with post body, not a banner. Feels like a footnote that noticed you reading.

### Variant pool (rotation, one per post)

1. `This post was researched, written, and published by our Content Engine. {demoLink}`
2. `The Content Engine wrote this while we were doing other things. {demoLink}`
3. `Written by a machine that read our Brand DNA first. {demoLink}`
4. `This was a Content Engine post. It handled the research, the writing, and the SEO. {demoLink}`

Link text always the same: `See what it would write about your business.`

---

## Standard newsletter opt-in CTA (all posts)

Appears at the bottom of every Lite-hosted blog post, below the body content. For SuperBad's posts, it sits below the SuperBad CTA line.

### Structure

- **Heading:** `Get the next one.`
- **Body:** `New posts go to your inbox {cadenceDescription}. No spam, easy unsubscribe.`
- **Email input placeholder:** `Your email`
- **Button:** `Subscribe`
- **Success message:** `You're in. First one lands on {nextSendDate}.`
- **Already subscribed:** `You're already on the list.`

### Cadence description (derived from owner's send window)

- Weekly: `every {dayOfWeek}`
- Fortnightly: `every other week`
- Monthly: `once a month`

### Styling

- Container: Warm Cream background, Dark Charcoal text, 1px SuperBad Red top border.
- Heading: Righteous, uppercase, letter-spaced.
- Body: DM Sans.
- Input + button: inline on desktop, stacked on mobile.
- Unobtrusive. Part of the post, not floating over it.

### Consent

- `consent_source: 'blog_cta'`
- Direct opt-in — no permission pass email.
- Unsubscribe link on every subsequent send.
- Spam Act compliant: sender identity visible, unsubscribe mechanism present.
