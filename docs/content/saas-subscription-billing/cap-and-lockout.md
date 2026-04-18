# SaaS Subscription Billing — Cap Hit Screen + Payment Failed Lockout

**Surface:** Usage cap screen + payment failure lockout. **Spec:** `docs/specs/saas-subscription-billing.md` §5.3 (cap), §4.6 + §7.4 (lockout), §14. **Author:** Claude (CMS-4).

---

## Usage cap hit screen

Renders inline when `checkUsageLimit()` returns `allowed: false`. The capped action's button is disabled and this component renders in its place.

### Already on highest tier

- **Heading:** `You've used all {limit} {dimensionLabel} this month.`
- **Body:** `You're on the largest plan. The counter resets on {nextResetDate}. If you need more before then, email us.`
- **Contact:** `andy@superbadmedia.com.au`
- **No CTA button.** There's nothing to upgrade to. The contact line is the fallback.

### Upgrade available

- **Heading:** `{limit} of {limit} {dimensionLabel} used.`
- **Body:** `You're on {currentTierName}. {nextTierName} gives you {nextTierLimit} — that's {difference} more.`
- **Price line:** `${proratedAmount}/mo more for the rest of this cycle. ${fullAmount}/mo from next month.`
- **CTA:** `Upgrade to {nextTierName}`
- **Secondary:** `Or wait until {nextResetDate} when the counter resets.`

### Voice

Dry acknowledgment, not corporate limit-reached copy. The heading is factual. The body gives options. No "oops" or "you've reached your limit!" or "upgrade now to unlock more."

---

## Payment failed lockout screen

Replaces the product interface when a subscription is in payment-failed state. Honest, with character, not sterile.

### Layout

```
┌──────────────────────────────────────────┐
│                                          │
│  Heading                                 │
│                                          │
│  Body (what happened, what to do)        │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  Card update form               │    │
│  │  (Stripe Payment Element)       │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Data safety assurance                   │
│                                          │
│  Issues line                             │
│                                          │
└──────────────────────────────────────────┘
```

### Copy

- **Heading:** `Payment didn't go through.`
- **Body:** `Your card was declined on {failureDate}. Could be expired, could be a limit, could be a bank having a day. Update your card below and we'll try again immediately.`
- **Data safety line:** `Your data's safe. Nothing's been deleted. Fix the card and you're back where you left off.`
- **Issues line:** `Still stuck? andy@superbadmedia.com.au`

### After successful card update

- **Heading:** `You're back.`
- **Body:** `Card updated. Payment went through. Everything's where you left it.`
- **CTA:** `Continue to {productName}`

### Escalation state (3+ failures in 7–10 days)

After the data-loss warning email has been sent, the lockout screen adds urgency without guilt:

- **Additional line (below data safety):** `We've been trying to reach you. If this isn't sorted in the next few days, we'll need to talk about what happens to your data.`

### Voice register

- "Payment didn't go through" beats "Payment failed" or "Billing error." It's conversational, not system-error.
- "Could be expired, could be a limit, could be a bank having a day" — three quick possibilities normalise the situation. Not their fault, not our fault, just a thing.
- The data safety line is non-negotiable. First thing someone worries about after a payment failure is whether they've lost work.
- No voice suppression on this screen — it's not a payment flow (that's the card update form inside it, which IS suppressed). The surrounding copy carries voice.
