# SaaS Subscription Billing — Usage Sticky Bar Copy

**Surface:** Persistent usage bar in subscriber product UI. **Spec:** `docs/specs/saas-subscription-billing.md` §5.2, §14. **Author:** Claude (CMS-4). Voice evolves with usage level — calm → neutral → dry → dead-pan.

---

## Format

`[dimension icon] {used} / {limit} {dimensionLabel} this month`

Multiple dimensions stack vertically (or horizontally on wide screens).

---

## Personality progression

All copy rendered via `generateInVoice()` with `ambient_copy_cache`. The generated copy must match this register.

### Low usage (0–40%)

Calm, factual. The bar is doing its job — showing a number. No commentary.

- `{used} of {limit} {dimension} used`
- No personality text. The number is the voice.

### Mid usage (41–70%)

Neutral. A gentle ambient awareness.

- `{used} of {limit}. On pace.`
- `{used} of {limit}. Steady.`

### Near cap (71–89%)

Dry observation. The bar notices you're getting close and says so without drama.

- `{used} of {limit}. Getting there.`
- `{used} of {limit}. Making sure the juice was worth the squeeze.`
- `{used} of {limit}. Room for a few more.`
- `{used} of {limit}. The finish line's in sight.`

### At cap (90–99%)

Dead-pan. One more and you're done.

- `{used} of {limit}. Almost.`
- `{limit - remaining} left. Choose wisely.`
- `{used} of {limit}. You're about to find out what happens next.`

### Hit cap (100%)

Dead-pan acknowledgment. No alarm. The upgrade prompt handles the action.

- `{limit} of {limit}. That's it for this month.`
- `{limit} of {limit}. The engine's earned its rest.`
- `You used all {limit}. {nextResetDate} is when the counter resets.`

---

## Dimension-specific variants (optional)

If dimension labels are too generic ("50 of 50 used"), the bar can append context:

| Dimension key | Near-cap variant |
|---|---|
| `published_posts` | `{used} of {limit} posts published. Each one earned its spot.` |
| `newsletter_subscribers` | `{used} of {limit} subscribers. The list is filling up.` |
| `outreach_sends` | `{used} of {limit} sends this month. Every one was personalised.` |

---

## Styling

- **Container:** full-width bar, fixed to top of product UI. Semi-transparent Dark Charcoal background (90% opacity), Warm Cream text. DM Sans, 14px.
- **Progress indicator:** thin bar (2px) under the text, Brand DNA accent colour, fills left-to-right proportional to usage.
- **At 80%+:** progress bar colour shifts to Retro Orange.
- **At 100%:** progress bar colour shifts to SuperBad Red.
- **No close/dismiss.** Always visible. Ambient, not interruptive.

---

## Voice register notes

- The personality progression must never feel like a game. It's not gamification — it's ambient awareness with character.
- Low usage gets NO personality text. Adding commentary at 10% feels desperate. Let the number breathe.
- "Making sure the juice was worth the squeeze" is the peak of the voice — it only works because it arrives at 70%+, not at 20%.
- The hit-cap copy must not feel punitive. "That's it for this month." is matter-of-fact, not scolding. The upgrade prompt (separate component) handles the commercial moment.
